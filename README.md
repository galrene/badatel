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

## Local Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```
