# Badatel

Interactive web application for viewing photographed site maps, outlining building footprints with letter badges (A, B, C...), and clicking buildings to inspect high-resolution blueprints, photos, and documentation.

## Features

- **Interactive Footprint Editor**: Draw building outlines on map sheets. Easily move or reshape them with interactive handles.
- **Building Documentation**: Attach photos, scans, blueprints, permits, and notes directly to individual buildings.
- **Multi-Sheet Site Plans**: Switch seamlessly between different photographed site maps, floor plans, or blueprints.
- **Image Rotation**: Rotate site plans and attached documents in 90° increments directly in the app.
- **Background Uploads**: Upload multiple files at once while continuing to browse and edit without interruption.
- **Project Export & Import**: Backup or share entire projects as a single `.zip` file, with options to merge or replace existing data.

## Technical Highlights

- **Client & Server Upload Deduplication**: Pre-flight SHA-256 content hashing detects duplicate files before transmission, saving bandwidth and reusing existing storage on disk.
- **Background Concurrency Queue**: Non-blocking upload manager with concurrency throttling, real-time speed calculation, and individual task cancellation/retries.
- **HEIC & EXIF Normalization**: Server-side processing that converts Apple HEIC/HEIF uploads and normalizes EXIF camera orientations on the fly.
- **Safe Archive Import with Pre-flight Inspection**: Server-side `.zip` inspection validating archive contents, detecting conflicts, and generating automatic recovery backups before execution.
- **Flat-File JSON Persistence**: Zero-database architecture—coordinates, metadata, and hash indices are cleanly persisted as plain JSON files in `./data/`.

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

# Run tests
npm test
```

---


> [!WARNING]
> This project is 100% vibecoded and just a pastime project to help my girlfriend with her thesis. It is not serious software and should not be treated as such.
