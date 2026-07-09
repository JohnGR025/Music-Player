//Variables
const audio = document.getElementById("audio");
const openBtn = document.getElementById("openBtn");
const playPauseBtn = document.getElementById("playPauseBtn");
const playIcon = playPauseBtn.querySelector(".play-icon");
const pauseIcon = playPauseBtn.querySelector(".pause-icon");
const seek = document.getElementById("seek");
const vol = document.getElementById("vol");
const title = document.getElementById("title");
const timeEl = document.getElementById("time");
const trackListEl = document.getElementById("trackList");
const importStatusEl = document.getElementById("importStatus");
const coverImg = document.getElementById("coverImg");
const musicPlayer = document.querySelector(".Music_player");
const searchInput = document.getElementById("searchInput");

const DEFAULT_COVER = "display_cover.jpeg";

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

//Change background color depending from the Cover image
function updateMusicPlayerBackgroundFromCover() {
  if (!coverImg.naturalWidth || !coverImg.naturalHeight) return;

  const canvas = document.createElement("canvas");
  const width = coverImg.naturalWidth;
  const height = coverImg.naturalHeight;
  const rows = Math.min(3, height);

  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(coverImg, 0, 0, width, height);

  const topData = ctx.getImageData(0, 0, width, rows).data;
  const bottomData = ctx.getImageData(0, height - rows, width, rows).data;

  let r=0, g=0, b=0;
  let count=0;

  //Calculate rgb values
  for (const data of [topData, bottomData]) {
    for (let i = 0; i < data.length; i += 4) {
      r += data[i];
      g += data[i + 1];
      b += data[i + 2];
      count += 1;
    }
  }

  if (count === 0) return;

  //Finallize rgb values
  r = Math.round(r / count);
  g = Math.round(g / count);
  b = Math.round(b / count);
  musicPlayer.style.backgroundColor = `rgb(${r}, ${g}, ${b})`;
}

// ---------------------------------------------------------------------------
// Track list rendering
// ---------------------------------------------------------------------------
function renderTrackList(tracks) {
  trackListEl.innerHTML = "";

  if (!tracks.length) {
    const empty = document.createElement("div");
    empty.className = "trackEmpty";
    empty.textContent = library.length === 0
      ? "No tracks imported yet. Click \"Open Folder\" to import a music folder."
      : "No songs match your search.";
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
// Search
// ---------------------------------------------------------------------------

// Returns tracks whose title, artist, or album partially or fully match
// whatever's currently typed in the search box (case-insensitive).
function getFilteredTracks() {
  const query = searchInput.value.trim().toLowerCase();
  if (!query) return library;

  return library.filter((track) => {
    return (
      (track.title && track.title.toLowerCase().includes(query)) ||
      (track.artist && track.artist.toLowerCase().includes(query)) ||
      (track.album && track.album.toLowerCase().includes(query))
    );
  });
}

// Re-renders the track list respecting whatever search query is active.
function applyFilterAndRender() {
  renderTrackList(getFilteredTracks());
}

searchInput.addEventListener("input", applyFilterAndRender);

// ---------------------------------------------------------------------------
// Playback
// ---------------------------------------------------------------------------
function playTrack(trackId) {
  const track = library.find((t) => t.id === trackId);
  if (!track) return;

  currentTrackId = trackId;

  audio.src = track.fileUrl;
  title.textContent = `${track.title}`;
  coverImg.src = track.picture || DEFAULT_COVER;

  // Re-render so the "selected" highlight moves to the clicked row,
  // while keeping whatever search filter is currently active
  applyFilterAndRender();

  audio.play().catch((err) => console.warn("Playback failed:", err.message));
}

coverImg.addEventListener("load", updateMusicPlayerBackgroundFromCover);

// ---------------------------------------------------------------------------
// Folder import
// ---------------------------------------------------------------------------
openBtn.addEventListener("click", async () => {
  const folderPath = await window.api.openFolder();
  if (!folderPath) return; // user cancelled

  importStatusEl.textContent = "Scanning folder...";

  const tracks = await window.api.importFolder(folderPath);

  library = tracks;
  applyFilterAndRender();
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
  applyFilterAndRender();
  if (library.length) {
    importStatusEl.textContent = `${library.length} track(s) in library`;
  }

  // Initialize the play/pause icon
  updatePlayPauseIcon();
})();

// ---------------------------------------------------------------------------
// Transport controls
// ---------------------------------------------------------------------------

function updatePlayPauseIcon() {
  //Both icons are displayed but only one is visible
  if (audio.paused) {
    playIcon.classList.remove("hidden");
    pauseIcon.classList.add("hidden");
  } else {
    playIcon.classList.add("hidden");
    pauseIcon.classList.remove("hidden");
  }
}

playPauseBtn.addEventListener("click", () => {
  if (audio.paused) {
    audio.play();
  } else {
    audio.pause();
  }
});

audio.addEventListener("play", updatePlayPauseIcon);
audio.addEventListener("pause", updatePlayPauseIcon);

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
