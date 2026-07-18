# Music Player

A desktop MP3/audio player built with Electron. Import a whole music
folder or a single file/playlist, browse and search your library, and play
straight from local files — with ID3 tag and cover art support.

## Features

- **Folder import** — recursively scans a chosen folder for audio files and
  builds a searchable library from their ID3 tags (title, artist, album,
  genre, year, track number, duration, cover art).
- **Open File** — play a single audio file, or load an `.m3u`/`.m3u8`
  playlist, without disturbing your main library.
- **Persistent library** — your library is cached locally, so re-launching
  the app (or re-importing the same folder) doesn't require re-reading tags
  from disk for files that haven't changed.
- **Live search** — filter whatever's currently displayed (full library, or
  a narrowed single-track/playlist view) by title, artist, or album as you
  type.
- **Standard playback controls** — play/pause, previous/next, seek bar,
  volume, and a dynamic background color pulled from the current track's
  cover art.
- **Mini window player** - Create a small window for putting in the corner of your deskpot.

## Supported formats

- **Audio:** `.mp3`, `.wav`, `.flac`, `.m4a`, `.aac`, `.ogg` (tested on .mp3 only for now)
- **Playlists:** `.m3u`, `.m3u8` (local file paths only — streaming URLs
  inside a playlist are skipped)

## Prerequisites

- [Node.js](https://nodejs.org/) (LTS recommended) and npm

## Installation

```bash
git clone https://github.com/JohnGR025/Music-Player.git
cd Music-Player
npm install
```

## Running the app

```bash
npm start
```

> **Note:** this assumes your `package.json` has a `start` script pointing
> at Electron, e.g.:
> ```json
> {
>   "scripts": {
>     "start": "electron ."
>   }
> }
> ```
> If yours is named differently, run that script instead (or check
> `package.json` for the exact command).

## Usage

1. **Open Folder** (folder icon) — pick a folder to scan. Every audio file
   inside it gets imported into your library. Doing
   this again re-scans and replaces the library view, but reuses cached tag
   data for any file that hasn't changed, so re-imports are fast.
2. **Open File** (file icon) — pick a single audio file to play immediately,s
   or a `.m3u`/`.m3u8` playlist to load and play through. This narrows the
   view to just that track/playlist without losing your main library — a
   "◀ Back to full library" row appears at the top of the list to return to
   it.
3. **Search bar** — type to filter whatever's currently shown by title,
   artist, or album. It also works as a status line, showing things like
   import progress or how many tracks were loaded.
4. **Transport controls** — play/pause, skip to previous/next track (within
   whatever's currently displayed and filtered), seek, and volume.

## How your library is stored

The app keeps two small local JSON files under Electron's `userData`
directory (no cloud sync, nothing leaves your machine):

- `library.json` — the full library from your last **Open Folder** import.
- `quickImports.json` — tracks/playlists added individually via **Open
  File**, kept separate so re-importing a folder never wipes them out.

Both are used as a tag-parsing cache (keyed by file path + last-modified
time), so importing the same file twice — whether via folder scan or Open
File option — won't re-parse metadata unless the file actually changed.

## Project structure

```
.
├── main.js        # Electron main process: window setup, file dialogs,
│                   # folder scanning, metadata extraction, library storage
├── preload.js      # contextBridge API exposed to the renderer
├── renderer.js     # UI logic: library/search state, playback, rendering
├── index.html       # App layout
└── style.css        # App styling
├── mini_renderer.js     # Mini window logic: mostly playback control
├── mini_window.html       # Mini window layout
└── mini_style.css        # Mini window styling
```

## Known limitations

- Single window with mini player, no playlist creation/export from within the app.
- No drag-and-drop import yet — folders and files are chosen via dialog.
- Streaming URLs inside `.m3u` playlists aren't supported, only local files.
- Imported playlists are not being saved independently for easy access.