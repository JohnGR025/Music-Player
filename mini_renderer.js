const miniTitle = document.getElementById("miniTitle");
const miniSeek = document.getElementById("miniSeek");
const miniTime = document.getElementById("miniTime");
const miniVol = document.getElementById("miniVol");
const miniPrevBtn = document.getElementById("miniPrevBtn");
const miniPlayPauseBtn = document.getElementById("miniPlayPauseBtn");
const miniNextBtn = document.getElementById("miniNextBtn");
const closeMiniBtn = document.getElementById("closeMiniBtn");
const playIcon = miniPlayPauseBtn.querySelector(".play-icon");
const pauseIcon = miniPlayPauseBtn.querySelector(".pause-icon");

// True while the user is actively dragging a slider, so an incoming state
// update doesn't yank the handle out from under their cursor.
let seekBeingDragged = false;
let volBeingDragged = false;

function pad2(n) { return String(n).padStart(2, "0"); }
function fmtTime(sec) {
  if (!Number.isFinite(sec)) return "0:00";
  sec = Math.max(0, Math.floor(sec));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${pad2(s)}`;
}

// The main window pushes state every time something changes (track change,
// play/pause, timeupdate, volume change). This window never reads or writes
// the actual <audio> element itself.
window.miniApi.onPlayerState((state) => {
  miniTitle.textContent = state.title || "No track loaded";

  if (state.paused) {
    playIcon.classList.remove("hidden");
    pauseIcon.classList.add("hidden");
  } else {
    playIcon.classList.add("hidden");
    pauseIcon.classList.remove("hidden");
  }

  if (!seekBeingDragged && Number.isFinite(state.duration) && state.duration > 0) {
    miniSeek.value = String((state.currentTime / state.duration) * 100);
  }
  miniTime.textContent = `${fmtTime(state.currentTime)} / ${fmtTime(state.duration)}`;

  if (!volBeingDragged && typeof state.volume === "number") {
    miniVol.value = String(state.volume);
  }
});

miniPrevBtn.addEventListener("click", () => window.miniApi.sendCommand({ type: "prev" }));
miniNextBtn.addEventListener("click", () => window.miniApi.sendCommand({ type: "next" }));
miniPlayPauseBtn.addEventListener("click", () => window.miniApi.sendCommand({ type: "playPause" }));

miniSeek.addEventListener("mousedown", () => { seekBeingDragged = true; });
miniSeek.addEventListener("input", () => {
  window.miniApi.sendCommand({ type: "seek", value: parseFloat(miniSeek.value) });
});
miniSeek.addEventListener("mouseup", () => { seekBeingDragged = false; });

miniVol.addEventListener("mousedown", () => { volBeingDragged = true; });
miniVol.addEventListener("input", () => {
  window.miniApi.sendCommand({ type: "volume", value: parseFloat(miniVol.value) });
});
miniVol.addEventListener("mouseup", () => { volBeingDragged = false; });

closeMiniBtn.addEventListener("click", () => window.miniApi.close());