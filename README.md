# Music Player

A desktop MP3/audio player built with Electron.

## Features

- Local music library management
- Folder and individual file importing
- Playlist support (M3U/M3U8)
- Automatic metadata extraction
- Album artwork display
- Mini player mode
- Playback controls and search

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

## Known limitations

- Single window with mini player, no playlist creation/export from within the app.
- No drag-and-drop import yet — folders and files are chosen via dialog.
- Streaming URLs inside `.m3u` playlists aren't supported, only local files.
- Imported playlists are not being saved independently for easy access.

## Possible (untested) issues

- file URL construction: On Linux, the link contains 4 slashes which should still work but never know, needs testing.
- Mini window: The attributes set for the window creation may get interrupted by window managers, needs testing.
- App icon not showing correctly on MacOS (speculation).