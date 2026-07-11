const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const fs = require("fs/promises");
const mm = require("music-metadata"); // npm install music-metadata

const AUDIO_EXTENSIONS = [".mp3", ".wav", ".flac", ".m4a", ".aac", ".ogg"];
const PLAYLIST_EXTENSIONS = [".m3u", ".m3u8"];

function createWindow() {
  const win = new BrowserWindow({
    width: 1000,
    height: 650,
    minWidth: 800,
    minHeight: 500,
    backgroundColor: "#000000",
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

// Used by the "Open File" button — accepts either a single audio file or an
// .m3u/.m3u8 playlist file.
ipcMain.handle("dialog:openAudioOrPlaylist", async () => {
  const result = await dialog.showOpenDialog({
    title: "Select an audio file or playlist",
    properties: ["openFile"],
    filters: [
      { name: "Audio & Playlists", extensions: [...AUDIO_EXTENSIONS.map(e => e.slice(1)), "m3u", "m3u8"] },
      { name: "Audio Files", extensions: AUDIO_EXTENSIONS.map(e => e.slice(1)) },
      { name: "Playlists", extensions: ["m3u", "m3u8"] }
    ]
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
// Playlist parsing (.m3u / .m3u8)
// ---------------------------------------------------------------------------
// Reads an M3U/M3U8 playlist and returns the absolute paths of every audio
// file it references. Blank lines, comments (#EXTM3U, #EXTINF, ...) and
// remote (http/https) entries are skipped — only local audio files that
// still exist on disk are kept. Relative paths inside the playlist are
// resolved against the playlist's own folder.
async function parseM3U(playlistPath) {
  const raw = await fs.readFile(playlistPath, "utf-8");
  const baseDir = path.dirname(playlistPath);
  const lines = raw.split(/\r?\n/);

  const filePaths = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    if (/^https?:\/\//i.test(line)) continue; // streaming URLs aren't supported

    const resolved = path.isAbsolute(line) ? line : path.resolve(baseDir, line);
    const ext = path.extname(resolved).toLowerCase();
    if (!AUDIO_EXTENSIONS.includes(ext)) continue;

    try {
      await fs.access(resolved);
      filePaths.push(resolved);
    } catch {
      console.warn(`Playlist entry not found on disk, skipping: ${resolved}`);
    }
  }

  return filePaths;
}

// ---------------------------------------------------------------------------
// Library "database" (simple JSON files keyed by file path)
// ---------------------------------------------------------------------------
// Two separate stores, on purpose:
//   DB_PATH       — the full folder-scanned library. Rewritten wholesale on
//                    every "Open Folder" import.
//   QUICK_DB_PATH — tracks/playlists added one at a time via "Open File".
//                    Folder imports never touch this, so quick-added tracks
//                    that live outside the imported folder don't get lost.
// Both are still cross-checked for cache hits (by path + mtime) so the same
// file is never re-parsed twice just because it showed up via a different
// import path.
const DB_PATH = path.join(app.getPath("userData"), "library.json");
const QUICK_DB_PATH = path.join(app.getPath("userData"), "quickImports.json");

async function loadDb(dbPath = DB_PATH) {
  try {
    const raw = await fs.readFile(dbPath, "utf-8");
    return JSON.parse(raw);
  } catch (err) {
    return {}; // no library yet, or file is corrupt/missing
  }
}

async function saveDb(db, dbPath = DB_PATH) {
  await fs.writeFile(dbPath, JSON.stringify(db, null, 2), "utf-8");
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
  // Each import replaces the whole folder library. We still keep the
  // previous library db AND the quick-imports db around purely as caches:
  // if a file's path + mtime match an entry we already parsed — whether
  // that parse happened during a previous folder scan or via "Open File" —
  // we reuse that metadata instead of re-reading tags. Only DB_PATH gets
  // rewritten here; quick imports are left untouched.
  const previousDb = await loadDb(DB_PATH);
  const quickDb = await loadDb(QUICK_DB_PATH);
  const newDb = {};

  const filePaths = await scanFolderRecursive(folderPath);

  let processed = 0;
  for (const filePath of filePaths) {
    const stat = await fs.stat(filePath);
    const cached = previousDb[filePath] || quickDb[filePath];

    if (cached && cached.mtimeMs === stat.mtimeMs) {
      newDb[filePath] = cached;
    } else {
      const meta = await extractMetadata(filePath);
      newDb[filePath] = { ...meta, mtimeMs: stat.mtimeMs };
    }

    processed++;
    event.sender.send("library:importProgress", { current: processed, total: filePaths.length });
  }

  await saveDb(newDb, DB_PATH);

  return Object.entries(newDb).map(([filePath, entry]) => trackToClientShape(filePath, entry));
});

// Returns whatever is already in the library database (used on app startup
// so the user doesn't have to re-import every time).
ipcMain.handle("library:getAll", async () => {
  const db = await loadDb(DB_PATH);
  return Object.entries(db).map(([filePath, entry]) => trackToClientShape(filePath, entry));
});

// Handles whatever the user picked with the "Open File" button. Unlike
// importFolder, this does NOT replace the library — it merges into it,
// since the user is adding one file/playlist at a time.
//
// Returns one of:
//   { type: "track", track }      — a single audio file was selected
//   { type: "playlist", tracks }  — an .m3u/.m3u8 was selected
//   null                          — unsupported file type, or nothing usable found
ipcMain.handle("library:importFileOrPlaylist", async (event, filePath) => {
  const ext = path.extname(filePath).toLowerCase();

  // Quick imports live in their own db so a later folder import can never
  // wipe them out. We still read the folder library as a read-only cache
  // source, so a file that's already in your main library doesn't get
  // re-parsed just because you opened it individually.
  const quickDb = await loadDb(QUICK_DB_PATH);
  const libraryDbCache = await loadDb(DB_PATH);

  // Imports (or reuses the cached entry for) a single audio file, writing
  // the result into quickDb.
  async function importSingleFile(fp) {
    let stat;
    try {
      stat = await fs.stat(fp);
    } catch (err) {
      console.warn(`File not found: ${fp}`, err.message);
      return null;
    }

    const cached = quickDb[fp] || libraryDbCache[fp];
    if (cached && cached.mtimeMs === stat.mtimeMs) {
      quickDb[fp] = cached; // make sure quickDb tracks it too, so it persists
      return trackToClientShape(fp, cached);
    }

    const meta = await extractMetadata(fp);
    const entry = { ...meta, mtimeMs: stat.mtimeMs };
    quickDb[fp] = entry;
    return trackToClientShape(fp, entry);
  }

  if (PLAYLIST_EXTENSIONS.includes(ext)) {
    const filePaths = await parseM3U(filePath);
    const tracks = [];

    let processed = 0;
    for (const fp of filePaths) {
      const track = await importSingleFile(fp);
      if (track) tracks.push(track);
      processed++;
      event.sender.send("library:importProgress", { current: processed, total: filePaths.length });
    }

    await saveDb(quickDb, QUICK_DB_PATH);
    return { type: "playlist", tracks };
  }

  if (AUDIO_EXTENSIONS.includes(ext)) {
    const track = await importSingleFile(filePath);
    await saveDb(quickDb, QUICK_DB_PATH);
    return track ? { type: "track", track } : null;
  }

  console.warn(`Unsupported file type selected: ${filePath}`);
  return null;
});