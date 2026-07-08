const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  // Single-file open (kept from before)
  openAudioFile: () => ipcRenderer.invoke("dialog:openAudioFile"),

  // Folder import flow
  openFolder: () => ipcRenderer.invoke("dialog:openFolder"),
  importFolder: (folderPath) => ipcRenderer.invoke("library:importFolder", folderPath),

  // Library ("database") access
  getLibrary: () => ipcRenderer.invoke("library:getAll"),

  // Progress updates while a folder is being scanned
  onImportProgress: (callback) => {
    ipcRenderer.on("library:importProgress", (_event, data) => callback(data));
  }
});
