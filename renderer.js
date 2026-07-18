//Variable Storage
const audio = document.getElementById("audio");
const openFolderBtn = document.getElementById("openFolderBtn");
const openFileBtn = document.getElementById("openFileBtn");
const miniWindow = document.getElementById("createSmallWindow");
const prevBtn = document.getElementById("prevBtn");
const playPauseBtn = document.getElementById("playPauseBtn");
const nextBtn = document.getElementById("nextBtn");
const playIcon = playPauseBtn.querySelector(".play-icon");
const pauseIcon = playPauseBtn.querySelector(".pause-icon");
const seek = document.getElementById("seek");
const vol = document.getElementById("vol");
const title = document.getElementById("title");
const timeEl = document.getElementById("time");
const trackListEl = document.getElementById("trackList");
const coverImg = document.getElementById("coverImg");
const musicPlayer = document.querySelector(".Music_player");
const searchInput = document.getElementById("searchInput");

const searchInputHoverText = "Search for a song from above...";
let searchInputLibraryText = "";
let searchInputPrevioustext = "";
let importedPlaylistView = null;
const DEFAULT_COVER = "display_cover.jpeg";

// `library` = every track we know about (used for id lookups so playback
// always works). `currentView` = what's actually shown in #trackList right
// now. Importing a folder sets both to the same thing; opening a single
// file or playlist only changes currentView, so the .songs panel narrows
// to just what you opened without losing the rest of your library.
let library = [];
let currentView = [];
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
function navigateToLibraryView() {
  currentView = library;
  searchInput.value = "";
  searchInput.placeholder = searchInputLibraryText;
  applyFilterAndRender();
}

function navigateToImportedPlaylistView() {
  if (!importedPlaylistView) return;

  currentView = importedPlaylistView;
  searchInput.value = "";
  searchInput.placeholder = importedPlaylistView.length
    ? `Showing playlist (${importedPlaylistView.length} track(s))`
    : "Playlist contained no playable tracks.";
  applyFilterAndRender();
}

function renderTrackList(tracks) {
  trackListEl.innerHTML = ""; //Delete already existed elements

  if (currentView !== library && library.length) {
    const backRow = document.createElement("div");
    backRow.className = "viewBackRow";
    backRow.textContent = `◀ Back to full library (${library.length} track${library.length === 1 ? "" : "s"})`;
    backRow.addEventListener("click", navigateToLibraryView);
    trackListEl.appendChild(backRow);
  } else if (currentView === library && importedPlaylistView) {
    const backRow = document.createElement("div");
    backRow.className = "viewBackRow";
    backRow.textContent = `◀ Back to imported playlist (${importedPlaylistView.length} track${importedPlaylistView.length === 1 ? "" : "s"})`;
    backRow.addEventListener("click", navigateToImportedPlaylistView);
    trackListEl.appendChild(backRow);
  }

  if (!tracks.length) {
    const empty = document.createElement("div");
    empty.className = "trackEmpty";
    empty.textContent = currentView.length === 0
      ? "No tracks imported yet. Click \"Open Folder\" to import a music folder, or \"Open File\" to add a single track or playlist."
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
// Returns tracks in the currently displayed view whose title, artist, or
// album partially or fully match whatever's currently typed in the search
// box (case-insensitive).
function getFilteredTracks() {
  const query = searchInput.value.trim().toLowerCase();
  if (!query) return currentView;

  return currentView.filter((track) => {
    //Search using title/artist/album keywords
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

function skipTrack(direction) {
  const queue = getFilteredTracks();
  const activeTracks = queue.length ? queue : currentView;

  if (!activeTracks.length) return;

  if (!currentTrackId) {
    const target = direction > 0 ? activeTracks[0] : activeTracks[activeTracks.length - 1];
    if (target) playTrack(target.id);
    return;
  }

  const currentIndex = activeTracks.findIndex((track) => track.id === currentTrackId);
  if (currentIndex === -1) {
    const target = direction > 0 ? activeTracks[0] : activeTracks[activeTracks.length - 1];
    if (target) playTrack(target.id);
    return;
  }

  const targetIndex = (currentIndex + direction + activeTracks.length) % activeTracks.length;
  playTrack(activeTracks[targetIndex].id);
}

searchInput.addEventListener("mouseenter", () => {
  searchInputPrevioustext = searchInput.placeholder;
  searchInput.placeholder = searchInputHoverText;
});
searchInput.addEventListener("input", applyFilterAndRender);
searchInput.addEventListener("mouseleave", () => {
  searchInput.placeholder = searchInputPrevioustext;
});

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
// Mini player relay
// ---------------------------------------------------------------------------
// Pushes the current playback state to the main process, which forwards it
// on to the mini window (if it's open). Cheap no-op if the mini window isn't
// open — main.js just drops it.
function broadcastState() {
  window.api.sendPlayerState({
    title: currentTrackId ? title.textContent : "No track loaded",
    paused: audio.paused,
    currentTime: audio.currentTime,
    duration: audio.duration,
    volume: audio.volume
  });
}

miniWindow.addEventListener("click", () => window.api.openMiniPlayer());

// Commands coming back from the mini window. These just call the exact same
// functions the main window's own buttons use, so behavior stays identical.
window.api.onPlayerCommand((command) => {
  //read the command that is being send from mini window
  switch (command.type) {
    case "playPause":
      if (audio.paused) audio.play(); else audio.pause();
      break;
    case "prev":
      skipTrack(-1);
      break;
    case "next":
      skipTrack(1);
      break;
    case "seek":
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        audio.currentTime = (command.value / 100) * audio.duration;
      }
      break;
    case "volume":
      audio.volume = command.value;
      vol.value = String(command.value);
      broadcastState();
      break;
  }
});

audio.addEventListener("play", broadcastState);
audio.addEventListener("pause", broadcastState);
audio.addEventListener("timeupdate", broadcastState);
audio.addEventListener("loadedmetadata", broadcastState);

// ---------------------------------------------------------------------------
// Folder/File import
// ---------------------------------------------------------------------------
openFolderBtn.addEventListener("click", async () => {
  const folderPath = await window.api.openFolder();
  if (!folderPath) return; // user cancelled

  importedPlaylistView = null;
  searchInput.placeholder = "Scanning folder...";

  const tracks = await window.api.importFolder(folderPath);

  library = tracks;
  currentView = library;
  searchInput.value = "";
  applyFilterAndRender();
  searchInput.placeholder = `${library.length} track(s) in library`;
  searchInputLibraryText = `${library.length} track(s) in library`;
});
// Merges tracks into the in-memory library: updates the entry if the track
// is already there (e.g. re-imported with fresh tags), otherwise appends it.
function mergeTracksIntoLibrary(tracks) {
  for (const track of tracks) {
    const idx = library.findIndex((t) => t.id === track.id);
    if (idx === -1) {
      library.push(track);
    } else {
      library[idx] = track;
    }
  }
}

async function openFileOrPlaylist() {
  const filePath = await window.api.openAudioOrPlaylist();
  if (!filePath) return; // user cancelled

  searchInput.placeholder = "Importing...";

  const result = await window.api.importFileOrPlaylist(filePath);

  if (!result) {
    searchInput.placeholder = "Couldn't import that file — unsupported type or nothing found.";
    return;
  }

  if (result.type === "track") {
    importedPlaylistView = null;
    mergeTracksIntoLibrary([result.track]);
    currentView = [result.track];
    searchInput.value = "";
    applyFilterAndRender();
    searchInput.placeholder = "Now playing 1 track";
    playTrack(result.track.id);
    return;
  }

  if (result.type === "playlist") {
    importedPlaylistView = result.tracks;
    mergeTracksIntoLibrary(result.tracks);
    currentView = result.tracks;
    searchInput.value = "";
    applyFilterAndRender();
    searchInput.placeholder = result.tracks.length
      ? `Showing playlist (${result.tracks.length} track(s))`
      : "Playlist contained no playable tracks.";
    if (result.tracks.length) playTrack(result.tracks[0].id);
  }
}
openFileBtn.addEventListener("click", openFileOrPlaylist);

// Live progress while the main process is parsing tags
window.api.onImportProgress(({ current, total }) => {
  searchInput.placeholder = `Importing ${current} / ${total}...`;
});

// ---------------------------------------------------------------------------
// Load whatever's already in the library database on startup
// ---------------------------------------------------------------------------
(async function init() {
  library = await window.api.getLibrary();
  currentView = library;
  applyFilterAndRender();
  if (library.length) {
    searchInput.placeholder = `${library.length} track(s) in library`;
    searchInputLibraryText = `${library.length} track(s) in library`;
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

prevBtn.addEventListener("click", () => skipTrack(-1));
nextBtn.addEventListener("click", () => skipTrack(1));

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
  broadcastState();
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