//Variables
const audio = document.getElementById("audio");
const openBtn = document.getElementById("openBtn");
const playBtn = document.getElementById("playBtn");
const pauseBtn = document.getElementById("pauseBtn");
const seek = document.getElementById("seek");
const vol = document.getElementById("vol");
const title = document.getElementById("title");
const timeEl = document.getElementById("time");
const trackListEl = document.getElementById("trackList");
const importStatusEl = document.getElementById("importStatus");
const coverImg = document.getElementById("coverImg");

const DEFAULT_COVER = "cover.jpg";

// In-memory copy of the library so clicks can reference tracks by id
// without re-querying the main process every time.
let library = [];
let currentTrackId = null;

function pad2(n) { return String(n).padStart(2, "0"); }
function fmtTime(sec) {
  if (!Number.isFinite(sec)) return "0:00";
  sec = Math.max(0, Math.floor(sec));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${pad2(s)}`;
}

// ---------------------------------------------------------------------------
// Track list rendering
// ---------------------------------------------------------------------------

function renderTrackList(tracks) {
  trackListEl.innerHTML = "";

  if (!tracks.length) {
    const empty = document.createElement("div");
    empty.className = "trackEmpty";
    empty.textContent = "No tracks imported yet. Click \"Open Folder\" to import a music folder.";
    trackListEl.appendChild(empty);
    return;
  }

  for (const track of tracks) {
    const row = document.createElement("div");
    row.className = "trackRow";
    row.dataset.id = track.id;
    if (track.id === currentTrackId) 
      row.classList.add("selected");

    const trackNo = document.createElement("span");
    trackNo.className = "trackNo";
    trackNo.textContent = track.track ? String(track.track) : "";

    const info = document.createElement("span");
    info.className = "trackInfo";
    info.innerHTML = `<span class="trackTitle">${escapeHtml(track.title)}</span>
                       <span class="trackArtist">${escapeHtml(track.artist)} — ${escapeHtml(track.album)}</span>`;

    const duration = document.createElement("span");
    duration.className = "trackDuration";
    duration.textContent = fmtTime(track.duration);

    row.appendChild(trackNo);
    row.appendChild(info);
    row.appendChild(duration);

    row.addEventListener("click", () => playTrack(track.id));

    trackListEl.appendChild(row);
  }
}

function escapeHtml(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// ---------------------------------------------------------------------------
// Playback
// ---------------------------------------------------------------------------

function playTrack(trackId) {
  const track = library.find((t) => t.id === trackId);
  if (!track) return;

  currentTrackId = trackId;

  audio.src = track.fileUrl;
  title.textContent = `${track.title} — ${track.artist}`;
  coverImg.src = track.picture || DEFAULT_COVER;
  coverImg.style.backgroundSize = "cover";

  // Re-render so the "selected" highlight moves to the clicked row
  renderTrackList(library);

  audio.play().catch((err) => console.warn("Playback failed:", err.message));
}

// ---------------------------------------------------------------------------
// Folder import
// ---------------------------------------------------------------------------

openBtn.addEventListener("click", async () => {
  const folderPath = await window.api.openFolder();
  if (!folderPath) return; // user cancelled

  importStatusEl.textContent = "Scanning folder...";

  const tracks = await window.api.importFolder(folderPath);

  library = tracks;
  renderTrackList(library);
  importStatusEl.textContent = `${library.length} track(s) in library`;
});

// Live progress while the main process is parsing tags
window.api.onImportProgress(({ current, total }) => {
  importStatusEl.textContent = `Importing ${current} / ${total}...`;
});

// ---------------------------------------------------------------------------
// Load whatever's already in the library database on startup
// ---------------------------------------------------------------------------

(async function init() {
  library = await window.api.getLibrary();
  renderTrackList(library);
  if (library.length) {
    importStatusEl.textContent = `${library.length} track(s) in library`;
  }
})();

// ---------------------------------------------------------------------------
// Transport controls
// ---------------------------------------------------------------------------

playBtn.addEventListener("click", () => audio.play());
pauseBtn.addEventListener("click", () => audio.pause());

vol.addEventListener("input", () => {
  audio.volume = parseFloat(vol.value);
});

audio.addEventListener("timeupdate", () => {
  if (!Number.isFinite(audio.duration) || audio.duration === 0) return;
  seek.value = String((audio.currentTime / audio.duration) * 100);
  timeEl.textContent = `${fmtTime(audio.currentTime)} / ${fmtTime(audio.duration)}`;
});

seek.addEventListener("input", () => {
  if (!Number.isFinite(audio.duration) || audio.duration === 0) return;
  audio.currentTime = (parseFloat(seek.value) / 100) * audio.duration;
});
