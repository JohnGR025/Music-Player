const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");

function createWindow() {
  const win = new BrowserWindow({
    width: 935,
    height: 600,
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

ipcMain.handle("dialog:openAudioFile", async () => {
  const result = await dialog.showOpenDialog({
    title: "Select audio file",
    properties: ["openFile"],
    filters: [{ name: "Audio", extensions: ["mp3", "wav", "flac", "m4a", "aac", "ogg"] }]
  });

  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
});
