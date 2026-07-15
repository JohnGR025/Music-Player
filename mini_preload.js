const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("miniApi", {
  // Receive playback state pushed from the main window
  onPlayerState: (callback) => {
    ipcRenderer.on("player:state", (_event, state) => callback(state));
  },

  // Send a control command back to the main window (playPause, next, prev, seek, volume)
  sendCommand: (command) => ipcRenderer.send("player:command", command),

  // Ask main process to close this window (and restore the main window)
  close: () => ipcRenderer.send("miniplayer:close")
});
