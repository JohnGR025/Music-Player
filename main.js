const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const fs = require("fs/promises");
const mm = require("music-metadata"); // npm install music-metadata

const AUDIO_EXTENSIONS = [".mp3", ".wav", ".flac", ".m4a", ".aac", ".ogg"];

function createWindow() {
  const win = new BrowserWindow({
    width: 1000,
    height: 650,
    minWidth: 800,
    minHeight: 500,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  win.loadFile("index.html");
}

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

// ---------------------------------------------------------------------------
// File dialogs
// ---------------------------------------------------------------------------

ipcMain.handle("dialog:openAudioFile", async () => {
  const result = await dialog.showOpenDialog({
    title: "Select audio file",
    properties: ["openFile"],
    filters: [{ name: "Audio", extensions: ["mp3", "wav", "flac", "m4a", "aac", "ogg"] }]
  });

  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
});

ipcMain.handle("dialog:openFolder", async () => {
  const result = await dialog.showOpenDialog({
    title: "Select a music folder",
    properties: ["openDirectory"]
  });

  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
});

// ---------------------------------------------------------------------------
// Folder scanning
// ---------------------------------------------------------------------------

// Recursively walks a folder and returns every audio file path found inside it.
async function scanFolderRecursive(folderPath) {
  const results = [];

  async function walk(currentPath) {
    let entries;
    try {
      entries = await fs.readdir(currentPath, { withFileTypes: true });
    } catch (err) {
      console.warn(`Could not read directory ${currentPath}:`, err.message);
      return;
    }

    for (const entry of entries) {
      // Skip hidden files/folders (., .., .DS_Store, etc.)
      if (entry.name.startsWith(".")) continue;

      const fullPath = path.join(currentPath, entry.name);

      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (AUDIO_EXTENSIONS.includes(ext)) {
          results.push(fullPath);
        }
      }
    }
  }

  await walk(folderPath);
  return results;
}

// Reads ID3/metadata tags for a single file. Falls back to the filename
// when tags are missing.
async function extractMetadata(filePath) {
  const parsedName = path.parse(filePath);
  let title = parsedName.name;
  let artist = "Unknown Artist";
  let album = "Unknown Album";
  let genre = "";
  let year = null;
  let track = null;
  let duration = 0;
  let picture = null;

  try {
    const metadata = await mm.parseFile(filePath, { duration: true });
    const common = metadata.common || {};
    const format = metadata.format || {};

    if (common.title) title = common.title;
    if (common.artist) artist = common.artist;
    if (common.album) album = common.album;
    if (common.genre && common.genre.length) genre = common.genre.join(", ");
    if (common.year) year = common.year;
    if (common.track && common.track.no) track = common.track.no;
    if (format.duration) duration = format.duration;

    if (common.picture && common.picture.length) {
      const pic = common.picture[0];
      picture = `data:${pic.format};base64,${Buffer.from(pic.data).toString("base64")}`;
    }
  } catch (err) {
    console.warn(`Could not read metadata for ${filePath}:`, err.message);
    // Fallback: try to pull "Artist - Title" out of the filename.
    const match = parsedName.name.match(/^(.+?)\s*-\s*(.+)$/);
    if (match) {
      artist = match[1].trim();
      title = match[2].trim();
    }
  }

  return { title, artist, album, genre, year, track, duration, picture };
}

// ---------------------------------------------------------------------------
// Library "database" (simple JSON file keyed by file path)
// ---------------------------------------------------------------------------

const DB_PATH = path.join(app.getPath("userData"), "library.json");

async function loadDb() {
  try {
    const raw = await fs.readFile(DB_PATH, "utf-8");
    return JSON.parse(raw);
  } catch (err) {
    return {}; // no library yet, or file is corrupt/missing
  }
}

async function saveDb(db) {
  await fs.writeFile(DB_PATH, JSON.stringify(db, null, 2), "utf-8");
}

function trackToClientShape(filePath, entry) {
  return {
    id: filePath,
    filePath,
    fileUrl: `file:///${filePath.replace(/\\/g, "/")}`,
    title: entry.title,
    artist: entry.artist,
    album: entry.album,
    genre: entry.genre,
    year: entry.year,
    track: entry.track,
    duration: entry.duration,
    picture: entry.picture
  };
}

// Scans a folder, extracts metadata only for new/changed files (checked via
// mtime), merges the results into the JSON database, and returns the full
// library as an array ready for the renderer to display.
ipcMain.handle("library:importFolder", async (event, folderPath) => {
  // Each import replaces the whole library. We still keep the previous
  // db around purely as a cache: if a file's path + mtime match an entry
  // we already parsed, we reuse that metadata instead of re-reading tags.
  const previousDb = await loadDb();
  const newDb = {};

  const filePaths = await scanFolderRecursive(folderPath);

  let processed = 0;
  for (const filePath of filePaths) {
    const stat = await fs.stat(filePath);
    const cached = previousDb[filePath];

    if (cached && cached.mtimeMs === stat.mtimeMs) {
      newDb[filePath] = cached;
    } else {
      const meta = await extractMetadata(filePath);
      newDb[filePath] = { ...meta, mtimeMs: stat.mtimeMs };
    }

    processed++;
    event.sender.send("library:importProgress", { current: processed, total: filePaths.length });
  }

  await saveDb(newDb);

  return Object.entries(newDb).map(([filePath, entry]) => trackToClientShape(filePath, entry));
});

// Returns whatever is already in the library database (used on app startup
// so the user doesn't have to re-import every time).
ipcMain.handle("library:getAll", async () => {
  const db = await loadDb();
  return Object.entries(db).map(([filePath, entry]) => trackToClientShape(filePath, entry));
});