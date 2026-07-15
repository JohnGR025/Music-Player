const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  // Single-file open (kept from before)
  openAudioFile: () => ipcRenderer.invoke("dialog:openAudioFile"),

  // "Open File" button — pick a single audio file or an .m3u/.m3u8 playlist
  openAudioOrPlaylist: () => ipcRenderer.invoke("dialog:openAudioOrPlaylist"),
  importFileOrPlaylist: (filePath) => ipcRenderer.invoke("library:importFileOrPlaylist", filePath),

  // Folder import flow
  openFolder: () => ipcRenderer.invoke("dialog:openFolder"),
  importFolder: (folderPath) => ipcRenderer.invoke("library:importFolder", folderPath),

  // Library ("database") access
  getLibrary: () => ipcRenderer.invoke("library:getAll"),

  // Progress updates while a folder is being scanned
  onImportProgress: (callback) => {
    ipcRenderer.on("library:importProgress", (_event, data) => callback(data));
  },

  // Mini player
  openMiniPlayer: () => ipcRenderer.invoke("miniplayer:open"),

  // Push the current playback state out to the mini window (if open)
  sendPlayerState: (state) => ipcRenderer.send("player:state", state),

  // Receive a control command that was pressed in the mini window
  onPlayerCommand: (callback) => {
    ipcRenderer.on("player:command", (_event, command) => callback(command));
  }
});
