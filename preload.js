const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  openAudioFile: () => ipcRenderer.invoke("dialog:openAudioFile")
});
