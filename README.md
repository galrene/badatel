# Badatel

Interactive web application for viewing photographed site maps, outlining building footprints with letter badges (A, B, C...), and clicking buildings to inspect high-resolution blueprints, photos, and documentation.

## Features

- **Multi-sheet site plans**: Switch between different photographed site maps.
- **Interactive footprints**: Draw polygons, drag & move whole regions, and reshape corners with handles.
- **Deep zoom lightbox**: Up to 800% zoom and pan for high-resolution blueprints and documents.
- **HEIC & EXIF support**: Automatic conversion of iPhone HEIC uploads and EXIF orientation normalization.
- **Image rotation**: Rotate site plans and attached documents in 90° increments.
- **Local persistence**: Buildings and settings persist in `./data/` as JSON files.

## Running with Docker (Recommended for Server)

```bash
docker compose up -d --build
```

Access the application at `http://localhost:5173` (or your server's IP/domain).

Data and uploads persist on the host under `./data/` and `./public/uploads/`.

## Desktop Application (macOS / Windows / Linux)

Badatel can run as a standalone cross-platform desktop application powered by Electron.

### Desktop Development

```bash
# Run desktop app in development mode with live hot-reloading
npm run electron:dev
```

### Packaging Desktop Installers

```bash
# Test local binary without full packaging
npm run electron:pack

# Package distribution installers for current OS
npm run electron:dist

# Target specific operating systems:
npm run electron:dist:mac    # macOS (.dmg, .zip)
npm run electron:dist:win    # Windows (.exe installer, portable)
npm run electron:dist:linux  # Linux (.AppImage, .deb)
```

Packaged installers and binaries are generated in the `./release/` directory. User annotations, uploaded blueprints, and settings are stored persistently in the OS application data directory (`~/Library/Application Support/Badatel` on macOS, `%APPDATA%/Badatel` on Windows, `~/.config/Badatel` on Linux), and can be opened directly from the desktop menu (`CmdOrCtrl+Shift+D`).

