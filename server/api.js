import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import crypto from 'node:crypto';
import sharp from 'sharp';
import heicConvert from 'heic-convert';
import AdmZip from 'adm-zip';
import { getVersionInfo } from './version-helper.js';

const execFileAsync = promisify(execFile);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

export const getDataDir = () => process.env.DATA_DIR || path.join(rootDir, 'data');
export const getBackupDir = () => process.env.BACKUP_DIR || path.join(getDataDir(), 'backups');
export const getTempDir = () => process.env.TEMP_DIR || path.join(getDataDir(), 'temp');
export const getBuildingsFile = () => path.join(getDataDir(), 'buildings.json');
export const getSettingsFile = () => path.join(getDataDir(), 'settings.json');
export const getPublicDir = () => process.env.PUBLIC_DIR || path.join(rootDir, 'public');
export const getUploadsDir = () => process.env.UPLOADS_DIR || path.join(getPublicDir(), 'uploads');
export const getSampleDir = () => process.env.SAMPLE_DIR || path.join(getPublicDir(), 'sample-map');
export const getFileHashesFile = () => path.join(getDataDir(), '.file_hashes.json');

// Ensure directories exist
export function ensureDirsExist() {
  for (const dir of [getDataDir(), getBackupDir(), getTempDir(), getUploadsDir(), getSampleDir()]) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}
ensureDirsExist();

// In-memory hash index
// hashIndex: sha256 -> Array<{ fullPath, relPath, filename, subfolder, url, size, mtimeMs, width, height }>
// fileIndex: fullPath -> { hash, size, mtimeMs }
let hashIndexLoaded = false;
const hashIndex = new Map();
const fileIndex = new Map();

export function resetHashIndexForTesting() {
  hashIndexLoaded = false;
  hashIndex.clear();
  fileIndex.clear();
}

function computeBufferHash(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function computeFileHash(filePath) {
  const buf = fs.readFileSync(filePath);
  return computeBufferHash(buf);
}

function loadHashIndexFromDisk() {
  if (hashIndexLoaded) return;
  hashIndexLoaded = true;
  try {
    if (fs.existsSync(getFileHashesFile())) {
      const data = JSON.parse(fs.readFileSync(getFileHashesFile(), 'utf8'));
      for (const [hash, entries] of Object.entries(data)) {
        if (Array.isArray(entries)) {
          hashIndex.set(hash, entries);
          for (const entry of entries) {
            if (entry.fullPath) {
              fileIndex.set(entry.fullPath, { hash, size: entry.size, mtimeMs: entry.mtimeMs });
            }
          }
        }
      }
    }
  } catch (err) {
    console.warn('Failed to read .file_hashes.json, rebuilding index:', err.message);
  }
}

function saveHashIndexToDisk() {
  try {
    const obj = {};
    for (const [hash, entries] of hashIndex.entries()) {
      obj[hash] = entries;
    }
    fs.writeFileSync(getFileHashesFile(), JSON.stringify(obj, null, 2), 'utf8');
  } catch (err) {
    console.warn('Failed to save .file_hashes.json:', err.message);
  }
}

async function inspectImageDimensions(filePath) {
  try {
    const ext = path.extname(filePath).toLowerCase();
    if (['.jpg', '.jpeg', '.png', '.webp', '.svg', '.gif'].includes(ext)) {
      const meta = await sharp(filePath).metadata();
      return { width: meta.width || null, height: meta.height || null };
    }
  } catch {}
  return { width: null, height: null };
}

async function syncHashIndexWithDisk() {
  loadHashIndexFromDisk();

  const currentFiles = new Map();
  function walkDir(dir, relFolder = '') {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const ent of entries) {
      if (ent.name.startsWith('.')) continue;
      const full = path.join(dir, ent.name);
      const rel = relFolder ? `${relFolder}/${ent.name}` : ent.name;
      if (ent.isDirectory()) {
        walkDir(full, rel);
      } else if (ent.isFile()) {
        const ext = path.extname(ent.name).toLowerCase();
        const validExts = ['.jpg', '.jpeg', '.png', '.webp', '.svg', '.pdf', '.gif'];
        if (validExts.includes(ext)) {
          const stat = fs.statSync(full);
          currentFiles.set(full, {
            stat,
            relPath: rel,
            subfolder: relFolder.replace(/\\/g, '/'),
            filename: ent.name
          });
        }
      }
    }
  }
  walkDir(getUploadsDir());

  let changed = false;

  // Prune deleted files
  for (const [hash, entries] of Array.from(hashIndex.entries())) {
    const valid = [];
    for (const e of entries) {
      if (currentFiles.has(e.fullPath)) {
        valid.push(e);
      } else {
        fileIndex.delete(e.fullPath);
        changed = true;
      }
    }
    if (valid.length === 0) {
      hashIndex.delete(hash);
    } else if (valid.length !== entries.length) {
      hashIndex.set(hash, valid);
    }
  }

  // Index new or modified files
  for (const [fullPath, info] of currentFiles.entries()) {
    const cached = fileIndex.get(fullPath);
    if (!cached || cached.size !== info.stat.size || Math.abs(cached.mtimeMs - info.stat.mtimeMs) > 1000) {
      try {
        const hash = computeFileHash(fullPath);
        const dims = await inspectImageDimensions(fullPath);
        const urlSegments = info.relPath.split('/').map(s => encodeURIComponent(s)).join('/');
        const entry = {
          fullPath,
          relPath: info.relPath,
          filename: info.filename,
          subfolder: info.subfolder,
          url: `/uploads/${urlSegments}`,
          size: info.stat.size,
          mtimeMs: info.stat.mtimeMs,
          width: dims.width,
          height: dims.height
        };

        if (cached && cached.hash && cached.hash !== hash) {
          const oldList = hashIndex.get(cached.hash) || [];
          hashIndex.set(cached.hash, oldList.filter(e => e.fullPath !== fullPath));
        }

        fileIndex.set(fullPath, { hash, size: info.stat.size, mtimeMs: info.stat.mtimeMs });
        const list = hashIndex.get(hash) || [];
        const existingIdx = list.findIndex(e => e.fullPath === fullPath);
        if (existingIdx >= 0) {
          list[existingIdx] = entry;
        } else {
          list.push(entry);
        }
        hashIndex.set(hash, list);
        changed = true;
      } catch (err) {
        console.warn('Failed to hash file:', fullPath, err.message);
      }
    }
  }

  if (changed) {
    saveHashIndexToDisk();
  }
}

function findExistingEntryByHash(hash) {
  loadHashIndexFromDisk();
  const entries = hashIndex.get(hash);
  if (!entries || entries.length === 0) return null;
  for (const e of entries) {
    if (fs.existsSync(e.fullPath)) {
      return e;
    }
  }
  return null;
}

function updateFileEntryHash(fullPath, newBuffer, width = null, height = null) {
  try {
    const stat = fs.statSync(fullPath);
    const newHash = computeBufferHash(newBuffer);
    const oldInfo = fileIndex.get(fullPath);
    if (oldInfo && oldInfo.hash) {
      const oldList = hashIndex.get(oldInfo.hash) || [];
      const filtered = oldList.filter(e => e.fullPath !== fullPath);
      if (filtered.length === 0) {
        hashIndex.delete(oldInfo.hash);
      } else {
        hashIndex.set(oldInfo.hash, filtered);
      }
    }

    fileIndex.set(fullPath, { hash: newHash, size: stat.size, mtimeMs: stat.mtimeMs });
    const rel = path.relative(getUploadsDir(), fullPath).replace(/\\/g, '/');
    const subfolder = path.dirname(rel) === '.' ? '' : path.dirname(rel);
    const urlSegments = rel.split('/').map(s => encodeURIComponent(s)).join('/');
    const entry = {
      fullPath,
      relPath: rel,
      filename: path.basename(fullPath),
      subfolder,
      url: `/uploads/${urlSegments}`,
      size: stat.size,
      mtimeMs: stat.mtimeMs,
      width,
      height
    };

    const list = hashIndex.get(newHash) || [];
    const existingIdx = list.findIndex(e => e.fullPath === fullPath);
    if (existingIdx >= 0) {
      list[existingIdx] = entry;
    } else {
      list.push(entry);
    }
    hashIndex.set(newHash, list);
    saveHashIndexToDisk();
  } catch (err) {
    console.warn('Error updating file hash:', err);
  }
}

async function getOrLinkFileForSubfolder({ hash, targetSubfolder = '', preferredFilename, width = null, height = null }) {
  await syncHashIndexWithDisk();
  const existing = findExistingEntryByHash(hash);
  if (!existing) return null;

  const normalizedSubfolder = targetSubfolder ? targetSubfolder.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '') : '';
  const entries = hashIndex.get(hash) || [];

  // Check if an entry with this hash already exists in this target subfolder
  const inSubfolder = entries.find(e => {
    const eSub = (e.subfolder || '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
    return eSub === normalizedSubfolder && fs.existsSync(e.fullPath);
  });
  if (inSubfolder) {
    return {
      exists: true,
      deduplicated: true,
      url: inSubfolder.url,
      filename: inSubfolder.filename,
      subfolder: inSubfolder.subfolder,
      width: inSubfolder.width || width,
      height: inSubfolder.height || height
    };
  }

  // If no target subfolder requested and file is already in root:
  if (!normalizedSubfolder && (!existing.subfolder || existing.subfolder === '')) {
    return {
      exists: true,
      deduplicated: true,
      url: existing.url,
      filename: existing.filename,
      subfolder: existing.subfolder,
      width: existing.width || width,
      height: existing.height || height
    };
  }

  // Link into normalizedSubfolder
  const targetDir = normalizedSubfolder ? path.join(getUploadsDir(), normalizedSubfolder) : getUploadsDir();
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  // Clean filename and handle collisions
  const ext = path.extname(preferredFilename || existing.filename) || path.extname(existing.filename);
  const baseName = path.basename(preferredFilename || existing.filename, ext).replace(/[^a-zA-Z0-9._-]/g, '_');

  let candidateName = `${baseName}${ext}`;
  let candidatePath = path.join(targetDir, candidateName);
  let counter = 1;

  while (fs.existsSync(candidatePath)) {
    // If candidate path has the exact same content/hash, reuse it directly!
    try {
      const candidateHash = computeFileHash(candidatePath);
      if (candidateHash === hash) {
        break;
      }
    } catch {}
    candidateName = `${baseName}_${counter}${ext}`;
    candidatePath = path.join(targetDir, candidateName);
    counter++;
  }

  if (!fs.existsSync(candidatePath)) {
    try {
      fs.linkSync(existing.fullPath, candidatePath);
    } catch (linkErr) {
      console.warn('Hardlink failed, falling back to copy:', linkErr.message);
      fs.copyFileSync(existing.fullPath, candidatePath);
    }
  }

  const stat = fs.statSync(candidatePath);
  const relPath = normalizedSubfolder ? `${normalizedSubfolder}/${candidateName}` : candidateName;
  const urlSegments = relPath.split('/').map(s => encodeURIComponent(s)).join('/');
  const newUrl = `/uploads/${urlSegments}`;

  const newEntry = {
    fullPath: candidatePath,
    relPath,
    filename: candidateName,
    subfolder: normalizedSubfolder,
    url: newUrl,
    size: stat.size,
    mtimeMs: stat.mtimeMs,
    width: existing.width || width,
    height: existing.height || height
  };

  fileIndex.set(candidatePath, { hash, size: stat.size, mtimeMs: stat.mtimeMs });
  const list = hashIndex.get(hash) || [];
  list.push(newEntry);
  hashIndex.set(hash, list);
  saveHashIndexToDisk();

  return {
    exists: true,
    deduplicated: true,
    url: newUrl,
    filename: candidateName,
    subfolder: normalizedSubfolder,
    width: newEntry.width,
    height: newEntry.height
  };
}

/**
 * Converts HEIC to JPEG and bakes EXIF orientation into actual pixels
 */
async function convertHeicToJpg(filePath) {
  if (!filePath.toLowerCase().endsWith('.heic')) return filePath;
  const jpgPath = filePath.replace(/\.heic$/i, '.jpg');

  // 1. Attempt macOS native sips first if available (fastest on macOS)
  try {
    if (fs.existsSync('/usr/bin/sips')) {
      await execFileAsync('/usr/bin/sips', ['-s', 'format', 'jpeg', filePath, '--out', jpgPath]);
      const autoOrientedBuffer = await sharp(jpgPath).rotate().toBuffer();
      fs.writeFileSync(jpgPath, autoOrientedBuffer);
      console.log(`Converted HEIC to JPEG with sips & auto-orient: ${path.basename(jpgPath)}`);
      return jpgPath;
    }
  } catch (err) {
    console.warn('sips conversion failed, trying heic-convert:', err.message);
  }

  // 2. Use heic-convert (pure JS/WASM decoder, fully reliable across Linux/Docker)
  try {
    const inputBuffer = fs.readFileSync(filePath);
    const convertedBuffer = await heicConvert({
      buffer: inputBuffer,
      format: 'JPEG',
      quality: 0.92
    });
    // Auto-orient with sharp
    const autoOrientedBuffer = await sharp(convertedBuffer).rotate().toBuffer();
    fs.writeFileSync(jpgPath, autoOrientedBuffer);
    console.log(`Converted HEIC to JPEG with heic-convert: ${path.basename(jpgPath)}`);
    return jpgPath;
  } catch (err) {
    console.warn('heic-convert failed, trying sharp directly:', err.message);
  }

  // 3. Fallback to Sharp directly
  try {
    const autoOrientedBuffer = await sharp(filePath).rotate().jpeg({ quality: 90 }).toBuffer();
    fs.writeFileSync(jpgPath, autoOrientedBuffer);
    console.log(`Converted HEIC to JPEG with sharp & auto-orient: ${path.basename(jpgPath)}`);
    return jpgPath;
  } catch (err) {
    console.error('HEIC conversion error with sharp:', err.message);
    return filePath;
  }
}

/**
 * Normalizes any image file by baking EXIF orientation into physical pixels
 */
async function autoOrientImage(filePath) {
  try {
    const ext = path.extname(filePath).toLowerCase();
    if (ext === '.jpg' || ext === '.jpeg' || ext === '.png' || ext === '.webp') {
      const meta = await sharp(filePath).metadata();
      if (meta.orientation && meta.orientation > 1) {
        const orientedBuffer = await sharp(filePath).rotate().toBuffer();
        fs.writeFileSync(filePath, orientedBuffer);
        console.log(`Auto-oriented EXIF tag ${meta.orientation} for: ${path.basename(filePath)}`);
      }
    }
  } catch (err) {
    console.warn('Auto-orient error (continuing):', err.message);
  }
}

/**
 * Recursively scans directory for documents/images and discovers subfolders
 */
async function scanUploadsDirectory(baseDir, relativeFolder = '') {
  const currentDir = relativeFolder ? path.join(baseDir, relativeFolder) : baseDir;
  if (!fs.existsSync(currentDir)) return { files: [], folders: [] };

  const entries = fs.readdirSync(currentDir, { withFileTypes: true });
  let files = [];
  let folders = [];

  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue; // ignore hidden files/directories (.gitkeep, .DS_Store)
    const entryRelativePath = relativeFolder ? `${relativeFolder.replace(/\\/g, '/')}/${entry.name}` : entry.name;
    const fullPath = path.join(currentDir, entry.name);

    if (entry.isDirectory()) {
      folders.push(entryRelativePath);
      const sub = await scanUploadsDirectory(baseDir, entryRelativePath);
      files = files.concat(sub.files);
      folders = folders.concat(sub.folders);
    } else if (entry.isFile()) {
      let finalFullPath = fullPath;
      let finalName = entry.name;
      let finalRelativePath = entryRelativePath;

      if (entry.name.toLowerCase().endsWith('.heic')) {
        const converted = await convertHeicToJpg(fullPath);
        if (converted !== fullPath && fs.existsSync(fullPath)) {
          try { fs.unlinkSync(fullPath); } catch {}
        }
        finalFullPath = converted;
        finalName = path.basename(converted);
        finalRelativePath = relativeFolder ? `${relativeFolder.replace(/\\/g, '/')}/${finalName}` : finalName;
      }

      const ext = path.extname(finalName).toLowerCase();
      const validExts = ['.jpg', '.jpeg', '.png', '.webp', '.svg', '.pdf', '.gif'];
      if (validExts.includes(ext)) {
        const stat = fs.existsSync(finalFullPath) ? fs.statSync(finalFullPath) : null;
        const normalizedSubfolder = relativeFolder ? relativeFolder.replace(/\\/g, '/') : '';
        const urlSegments = finalRelativePath.split('/').map(seg => encodeURIComponent(seg)).join('/');
        files.push({
          name: finalName,
          path: finalRelativePath,
          subfolder: normalizedSubfolder,
          url: `/uploads/${urlSegments}`,
          size: stat ? stat.size : 0,
          hash: fileIndex.get(finalFullPath)?.hash || null
        });
      }
    }
  }

  // Deduplicate and sort folders
  const uniqueFolders = Array.from(new Set(folders)).sort();
  return { files, folders: uniqueFolders };
}

// Initial default settings
const defaultSettings = {
  title: 'Badatel',
  activeMapId: 'page-1',
  maps: [
    {
      id: 'page-1',
      title: 'Page 1 - Photographed Site Plan',
      imageUrl: '/sample-map/sample_site_plan.png',
      width: 2400,
      height: 1600
    }
  ]
};

// Initial sample buildings
const defaultBuildings = [
  {
    id: 'b-a',
    letter: 'A',
    name: 'Residential Block Alpha',
    description: '4-story multi-family housing block built in 1978. Renovated facade and insulation in 2014.',
    color: '#3b82f6',
    polygon: [
      [1000, 520],
      [1000, 860],
      [780, 860],
      [780, 520]
    ],
    badgePosition: [890, 690],
    documents: [
      {
        id: 'doc-a1',
        title: 'Alpha Block - Ground Floor Architectural Blueprint',
        description: 'Original architectural floor layout showing apartments 01-05 and central staircase.',
        url: '/sample-map/sample_doc_a1.png',
        uploadedAt: new Date().toISOString()
      },
      {
        id: 'doc-a2',
        title: 'Alpha Block - Technical Inspection & Utility Riser Protocol',
        description: 'Electrical and earthing impedance refurbishment inspection protocol (Approved).',
        url: '/sample-map/sample_doc_a2.png',
        uploadedAt: new Date().toISOString()
      }
    ]
  },
  {
    id: 'b-b',
    letter: 'B',
    name: 'Residential Block Beta',
    description: 'Modular prefabricated apartment building. 6 entrances, 48 apartment units.',
    color: '#10b981',
    polygon: [
      [1000, 1060],
      [1000, 1480],
      [780, 1480],
      [780, 1060]
    ],
    badgePosition: [890, 1270],
    documents: [
      {
        id: 'doc-b1',
        title: 'Beta Block - Facade Elevation & Insulation Study',
        description: 'Southern facade architectural drawings and 6 main entrances elevations.',
        url: '/sample-map/sample_doc_b1.png',
        uploadedAt: new Date().toISOString()
      }
    ]
  },
  {
    id: 'b-c',
    letter: 'C',
    name: 'Civic & Commercial Pavilion',
    description: 'Mixed-use civic building housing local supermarket, pharmacy, post office, and community rooms.',
    color: '#f59e0b',
    polygon: [
      [620, 520],
      [620, 880],
      [360, 880],
      [360, 520]
    ],
    badgePosition: [490, 700],
    documents: [
      {
        id: 'doc-c1',
        title: 'Commercial Pavilion - Lease & Zoning Registry',
        description: 'Municipal lease registry and retail floor distribution diagram.',
        url: '/sample-map/sample_doc_c1.png',
        uploadedAt: new Date().toISOString()
      }
    ]
  },
  {
    id: 'b-d',
    letter: 'D',
    name: 'Municipal Kindergarten & Nursery',
    description: 'Single-story pavilion with fenced outdoor garden, sandpit, and playground.',
    color: '#ec4899',
    polygon: [
      [620, 1060],
      [620, 1460],
      [360, 1460],
      [360, 1060]
    ],
    badgePosition: [490, 1260],
    documents: [
      {
        id: 'doc-d1',
        title: 'Kindergarten - Nursery Layout & Enclosure Plan',
        description: 'Classrooms plan, dining facilities, and outdoor fenced recreation yard.',
        url: '/sample-map/sample_doc_d1.png',
        uploadedAt: new Date().toISOString()
      }
    ]
  }
];

function readSettings() {
  try {
    if (fs.existsSync(getSettingsFile())) {
      const parsed = JSON.parse(fs.readFileSync(getSettingsFile(), 'utf8'));
      // Migrate legacy format if needed
      if (!parsed.maps && parsed.mapImage) {
        return {
          title: parsed.title || 'Badatel',
          activeMapId: 'page-1',
          maps: [
            {
              id: 'page-1',
              title: 'Page 1 - Master Site Plan',
              imageUrl: parsed.mapImage,
              width: parsed.mapWidth || 2400,
              height: parsed.mapHeight || 1600
            }
          ]
        };
      }
      return parsed;
    }
  } catch (err) {
    console.error('Error reading settings:', err);
  }
  return defaultSettings;
}

function writeAtomicJson(filePath, data) {
  const tempPath = `${filePath}.tmp.${Date.now()}.${Math.random().toString(36).slice(2)}`;
  fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tempPath, filePath);
}

function writeSettings(settings) {
  writeAtomicJson(getSettingsFile(), settings);
}

function readBuildings() {
  try {
    if (fs.existsSync(getBuildingsFile())) {
      return JSON.parse(fs.readFileSync(getBuildingsFile(), 'utf8'));
    }
  } catch (err) {
    console.error('Error reading buildings:', err);
  }
  return defaultBuildings;
}

function writeBuildings(buildings) {
  writeAtomicJson(getBuildingsFile(), buildings);
}

function resolveDiskPath(urlPath) {
  if (!urlPath || typeof urlPath !== 'string') return null;
  const cleanUrl = urlPath.split('?')[0];
  const normalized = path.normalize(cleanUrl).replace(/^(\.\.[\/\\])+/, '');
  const relative = normalized.replace(/^[\/\\]+/, '');
  const publicBase = path.resolve(getPublicDir());
  const candidate = path.resolve(publicBase, relative);
  if (candidate.startsWith(publicBase) && fs.existsSync(candidate)) {
    return candidate;
  }
  return null;
}

function normalizeImportUrl(url) {
  if (!url || typeof url !== 'string') return url;
  if (url.startsWith('media/')) {
    const filename = path.basename(url).replace(/[^a-zA-Z0-9._-]/g, '_');
    return `/uploads/${filename}`;
  }
  return url;
}

function receiveStreamToFile(req) {
  return new Promise((resolve, reject) => {
    const tempName = `import_${Date.now()}_${Math.random().toString(36).slice(2)}.zip`;
    const tempPath = path.join(getTempDir(), tempName);
    const writeStream = fs.createWriteStream(tempPath);

    const cleanup = () => {
      try { if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath); } catch {}
    };

    if (typeof req.pipe === 'function') {
      req.pipe(writeStream);
      writeStream.on('close', () => resolve({ tempName, tempPath }));
      writeStream.on('error', (err) => { cleanup(); reject(err); });
      req.on('error', (err) => { cleanup(); reject(err); });
    } else {
      req.on('data', chunk => writeStream.write(chunk));
      req.on('end', () => {
        writeStream.end();
      });
      writeStream.on('close', () => resolve({ tempName, tempPath }));
      req.on('error', (err) => { cleanup(); reject(err); });
    }
  });
}

function cleanOldTempFiles() {
  try {
    if (!fs.existsSync(getTempDir())) return;
    const files = fs.readdirSync(getTempDir());
    const now = Date.now();
    for (const f of files) {
      const full = path.join(getTempDir(), f);
      const stat = fs.statSync(full);
      if (now - stat.mtimeMs > 3600 * 1000) {
        try { fs.unlinkSync(full); } catch {}
      }
    }
  } catch (e) {
    // Ignore cleanup errors
  }
}

// Helper to parse JSON body from Node request
function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let totalLength = 0;
    req.on('data', chunk => {
      chunks.push(chunk);
      totalLength += chunk.length;
      if (totalLength > 100 * 1024 * 1024) {
        req.destroy();
        reject(new Error('Payload too large (>100MB)'));
      }
    });
    req.on('end', () => {
      try {
        const fullBuffer = Buffer.concat(chunks);
        const str = fullBuffer.toString('utf8');
        resolve(str ? JSON.parse(str) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

export function createApiMiddleware() {
  ensureDirsExist();
  if (!fs.existsSync(getSettingsFile())) {
    writeSettings(defaultSettings);
  }
  if (!fs.existsSync(getBuildingsFile())) {
    writeBuildings(defaultBuildings);
  }

  return async function apiMiddleware(req, res, next) {
    let rawPathname;
    try {
      const url = new URL(req.url, 'http://localhost');
      rawPathname = url.pathname;
    } catch {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ error: 'Invalid URL' }));
    }

    if (!rawPathname.startsWith('/api/')) {
      return next();
    }

    res.setHeader('Content-Type', 'application/json');

    try {
      // 1. GET /api/data
      if (req.method === 'GET' && rawPathname === '/api/data') {
        const settings = readSettings();
        const buildings = readBuildings();
        res.statusCode = 200;
        return res.end(JSON.stringify({ settings, buildings }));
      }

      // 2. POST /api/buildings
      if (req.method === 'POST' && rawPathname === '/api/buildings') {
        const body = await parseJsonBody(req);
        if (!Array.isArray(body.buildings)) {
          res.statusCode = 400;
          return res.end(JSON.stringify({ error: 'Expected array of buildings' }));
        }
        writeBuildings(body.buildings);
        res.statusCode = 200;
        return res.end(JSON.stringify({ success: true, count: body.buildings.length }));
      }

      // 3. POST /api/settings
      if (req.method === 'POST' && rawPathname === '/api/settings') {
        const body = await parseJsonBody(req);
        const current = readSettings();
        const updated = { ...current, ...body };
        writeSettings(updated);
        res.statusCode = 200;
        return res.end(JSON.stringify({ success: true, settings: updated }));
      }

      // 4a. POST /api/upload/check-hashes
      // Accepts { items: Array<{ hash: string, filename: string, subfolder?: string, target?: 'map' | 'doc' }> }
      if (req.method === 'POST' && rawPathname === '/api/upload/check-hashes') {
        const body = await parseJsonBody(req);
        const { items } = body;
        if (!Array.isArray(items)) {
          res.statusCode = 400;
          return res.end(JSON.stringify({ error: 'items array required' }));
        }

        await syncHashIndexWithDisk();

        const results = [];
        for (const item of items) {
          if (!item.hash) {
            results.push({ hash: item.hash, exists: false });
            continue;
          }

          let safeSub = '';
          if (item.subfolder && typeof item.subfolder === 'string' && item.target !== 'map') {
            const cleanSub = path.normalize(item.subfolder).replace(/^(\.\.[\/\\])+/, '').trim();
            const segments = cleanSub.split(/[/\\]/).filter(s => s && s !== '.' && s !== '..');
            safeSub = segments.map(s => s.replace(/[^a-zA-Z0-9._ -]/g, '_')).join('/');
          }

          const match = await getOrLinkFileForSubfolder({
            hash: item.hash,
            targetSubfolder: safeSub,
            preferredFilename: item.filename
          });

          if (match) {
            results.push({
              hash: item.hash,
              exists: true,
              deduplicated: true,
              url: match.url,
              filename: match.filename,
              subfolder: match.subfolder,
              width: match.width,
              height: match.height
            });
          } else {
            results.push({
              hash: item.hash,
              exists: false
            });
          }
        }

        res.statusCode = 200;
        return res.end(JSON.stringify({ success: true, results }));
      }

      // 4b. POST /api/upload
      // Accepts { filename: string, base64: string, target?: 'map' | 'doc', subfolder?: string }
      if (req.method === 'POST' && rawPathname === '/api/upload') {
        const body = await parseJsonBody(req);
        const { filename, base64, target, subfolder } = body;
        if (!filename || !base64 || typeof filename !== 'string' || typeof base64 !== 'string') {
          res.statusCode = 400;
          return res.end(JSON.stringify({ error: 'filename and base64 required' }));
        }

        // Sanitize subfolder to prevent directory traversal
        let safeSubfolder = '';
        if (subfolder && typeof subfolder === 'string' && target !== 'map') {
          const cleanSub = path.normalize(subfolder).replace(/^(\.\.[\/\\])+/, '').trim();
          const segments = cleanSub.split(/[/\\]/).filter(s => s && s !== '.' && s !== '..');
          safeSubfolder = segments.map(s => s.replace(/[^a-zA-Z0-9._ -]/g, '_')).join('/');
        }

        const safeBase = path.basename(filename).replace(/[^a-zA-Z0-9._-]/g, '_');
        const isHeic = filename.toLowerCase().endsWith('.heic');

        // Strip data:image/...;base64, prefix if present
        const base64Data = base64.replace(/^data:[^;]+;base64,/, '');
        const fileBuffer = Buffer.from(base64Data, 'base64');
        const initialHash = computeBufferHash(fileBuffer);

        // Check if exact file hash already exists before writing to disk (for non-HEIC files)
        if (!isHeic) {
          const quickExisting = await getOrLinkFileForSubfolder({
            hash: initialHash,
            targetSubfolder: safeSubfolder,
            preferredFilename: safeBase
          });

          if (quickExisting) {
            res.statusCode = 200;
            return res.end(JSON.stringify({
              success: true,
              url: quickExisting.url,
              filename: quickExisting.filename,
              subfolder: quickExisting.subfolder,
              width: quickExisting.width,
              height: quickExisting.height,
              deduplicated: true
            }));
          }
        }

        const cleanName = `${Date.now()}_${safeBase}`;
        
        let targetDir = getUploadsDir();
        if (target === 'map') {
          targetDir = getUploadsDir();
        } else if (safeSubfolder) {
          targetDir = path.join(getUploadsDir(), safeSubfolder);
        }

        if (!fs.existsSync(targetDir)) {
          fs.mkdirSync(targetDir, { recursive: true });
        }

        const filePath = path.join(targetDir, cleanName);
        fs.writeFileSync(filePath, fileBuffer);

        // If HEIC, automatically convert to JPEG and clean up original
        let finalPath = filePath;
        let finalName = cleanName;
        if (cleanName.toLowerCase().endsWith('.heic')) {
          finalPath = await convertHeicToJpg(filePath);
          finalName = path.basename(finalPath);
          // Unlink original .heic once converted to prevent endless loops and disk clutter
          if (finalPath !== filePath && fs.existsSync(filePath)) {
            try { fs.unlinkSync(filePath); } catch {}
          }
        } else {
          // Normalize EXIF orientation for regular photos
          await autoOrientImage(filePath);
        }

        // Measure natural image dimensions
        let width = null;
        let height = null;
        try {
          const meta = await sharp(finalPath).metadata();
          width = meta.width || null;
          height = meta.height || null;
        } catch (metaErr) {
          console.warn('Could not read image dimensions:', metaErr.message);
        }

        // Check hash of final processed file (in case HEIC conversion or EXIF normalization resulted in a duplicate)
        const finalBuffer = fs.readFileSync(finalPath);
        const finalHash = computeBufferHash(finalBuffer);
        await syncHashIndexWithDisk();
        const existingEntry = findExistingEntryByHash(finalHash);

        if (existingEntry && existingEntry.fullPath !== finalPath) {
          // A matching file already exists elsewhere in uploads!
          // Remove newly created redundant file and link to subfolder if needed
          try { fs.unlinkSync(finalPath); } catch {}
          const linked = await getOrLinkFileForSubfolder({
            hash: finalHash,
            targetSubfolder: safeSubfolder,
            preferredFilename: finalName,
            width,
            height
          });

          // Also index initialHash pointing to this entry so subsequent pre-flight checks match instantly!
          if (initialHash && initialHash !== finalHash) {
            const rawList = hashIndex.get(initialHash) || [];
            rawList.push({ ...linked, fullPath: existingEntry.fullPath });
            hashIndex.set(initialHash, rawList);
            saveHashIndexToDisk();
          }

          res.statusCode = 200;
          return res.end(JSON.stringify({
            success: true,
            url: linked.url,
            filename: linked.filename,
            subfolder: linked.subfolder,
            width: linked.width,
            height: linked.height,
            deduplicated: true
          }));
        }

        const stat = fs.statSync(finalPath);
        const relativeUrlPath = safeSubfolder 
          ? `${safeSubfolder.split('/').map(s => encodeURIComponent(s)).join('/')}/${encodeURIComponent(finalName)}`
          : encodeURIComponent(finalName);
        const publicUrl = `/uploads/${relativeUrlPath}`;

        // Register new file in hash index
        fileIndex.set(finalPath, { hash: finalHash, size: stat.size, mtimeMs: stat.mtimeMs });
        const list = hashIndex.get(finalHash) || [];
        const newEntry = {
          fullPath: finalPath,
          relPath: safeSubfolder ? `${safeSubfolder}/${finalName}` : finalName,
          filename: finalName,
          subfolder: safeSubfolder,
          url: publicUrl,
          size: stat.size,
          mtimeMs: stat.mtimeMs,
          width,
          height
        };
        list.push(newEntry);
        hashIndex.set(finalHash, list);

        // Also record initialHash if different from finalHash (e.g. EXIF orientation)
        if (initialHash && initialHash !== finalHash) {
          const rawList = hashIndex.get(initialHash) || [];
          rawList.push(newEntry);
          hashIndex.set(initialHash, rawList);
        }

        saveHashIndexToDisk();

        res.statusCode = 200;
        return res.end(JSON.stringify({
          success: true,
          url: publicUrl,
          filename: finalName,
          subfolder: safeSubfolder,
          width,
          height,
          deduplicated: false
        }));
      }

      // 5. POST /api/rotate
      // Accepts { url: string, degrees: number, isMap?: boolean, mapId?: string }
      if (req.method === 'POST' && rawPathname === '/api/rotate') {
        const body = await parseJsonBody(req);
        const { url: imageUrl, degrees = 90, isMap = false, mapId } = body;

        if (!imageUrl || typeof imageUrl !== 'string') {
          res.statusCode = 400;
          return res.end(JSON.stringify({ error: 'Valid url is required' }));
        }

        // Validate degrees
        const numDegrees = Number(degrees);
        if (!Number.isFinite(numDegrees) || ![90, 180, 270, -90, -180, -270].includes(numDegrees)) {
          res.statusCode = 400;
          return res.end(JSON.stringify({ error: 'degrees must be one of: 90, 180, 270, -90, -180, -270' }));
        }

        // Sanitize path against directory traversal and decode URI components
        let cleanUrl = imageUrl.split('?')[0];
        try {
          cleanUrl = decodeURIComponent(cleanUrl);
        } catch {}
        cleanUrl = cleanUrl.replace(/^(\.\.[\/\\])+/, '');
        const relative = path.normalize(cleanUrl).replace(/^[\/\\]+/, '');
        const publicBase = path.resolve(getPublicDir());
        const filePath = path.resolve(publicBase, relative);

        // Enforce boundary strictly within public/
        if (!filePath.startsWith(publicBase + path.sep)) {
          res.statusCode = 403;
          return res.end(JSON.stringify({ error: 'Access denied' }));
        }

        if (!fs.existsSync(filePath)) {
          res.statusCode = 404;
          return res.end(JSON.stringify({ error: 'File not found on disk' }));
        }

        // Rotate using sharp
        const currentBuffer = fs.readFileSync(filePath);
        const rotatedBuffer = await sharp(currentBuffer).rotate(numDegrees).toBuffer();
        fs.writeFileSync(filePath, rotatedBuffer);

        const meta = await sharp(filePath).metadata();
        const width = meta.width;
        const height = meta.height;

        // Update hash registry with new rotated bytes and dimensions
        updateFileEntryHash(filePath, rotatedBuffer, width, height);

        const cacheBustedUrl = `${imageUrl.split('?')[0]}?t=${Date.now()}`;

        // If it's a site map, update the specific map in settings
        let updatedSettings = null;
        if (isMap) {
          const currentSettings = readSettings();
          if (Array.isArray(currentSettings.maps)) {
            const targetMap = currentSettings.maps.find(m => m.id === (mapId || currentSettings.activeMapId) || m.imageUrl.includes(relative));
            if (targetMap) {
              targetMap.width = width;
              targetMap.height = height;
              targetMap.imageUrl = cacheBustedUrl;
            }
            writeSettings(currentSettings);
            updatedSettings = currentSettings;
          }
        }

        res.statusCode = 200;
        return res.end(JSON.stringify({
          success: true,
          url: cacheBustedUrl,
          width,
          height,
          settings: updatedSettings
        }));
      }

      // 6. GET /api/local-files
      if (req.method === 'GET' && rawPathname === '/api/local-files') {
        await syncHashIndexWithDisk();
        const { files, folders } = await scanUploadsDirectory(getUploadsDir());
        res.statusCode = 200;
        return res.end(JSON.stringify({ files, folders }));
      }

      // 7. GET /api/version
      if (req.method === 'GET' && rawPathname === '/api/version') {
        const info = getVersionInfo();
        res.setHeader('Content-Type', 'application/json');
        res.statusCode = 200;
        return res.end(JSON.stringify(info));
      }

      // 8. GET /api/export
      if (req.method === 'GET' && rawPathname === '/api/export') {
        const settings = readSettings();
        const buildings = readBuildings();

        const fileMap = new Map(); // diskPath -> archiveMediaName
        let fileCounter = 1;

        function getArchiveFilename(diskPath) {
          if (fileMap.has(diskPath)) return fileMap.get(diskPath);
          const base = path.basename(diskPath).replace(/[^a-zA-Z0-9._-]/g, '_');
          let archiveName = base;
          const existingNames = new Set(fileMap.values());
          while (existingNames.has(archiveName)) {
            const ext = path.extname(base);
            const stem = path.basename(base, ext);
            archiveName = `${stem}_${fileCounter++}${ext}`;
          }
          fileMap.set(diskPath, archiveName);
          return archiveName;
        }

        // Deep clone settings and buildings to adjust URLs to archive-relative paths
        const clonedSettings = JSON.parse(JSON.stringify(settings));
        if (Array.isArray(clonedSettings.maps)) {
          for (const m of clonedSettings.maps) {
            const diskPath = resolveDiskPath(m.imageUrl);
            if (diskPath) {
              const archiveName = getArchiveFilename(diskPath);
              m.imageUrl = `media/${archiveName}`;
            }
          }
        }

        const clonedBuildings = JSON.parse(JSON.stringify(buildings));
        if (Array.isArray(clonedBuildings)) {
          for (const b of clonedBuildings) {
            if (Array.isArray(b.documents)) {
              for (const doc of b.documents) {
                const diskPath = resolveDiskPath(doc.url);
                if (diskPath) {
                  const archiveName = getArchiveFilename(diskPath);
                  doc.url = `media/${archiveName}`;
                }
              }
            }
          }
        }

        const manifest = {
          version: 1,
          exportedAt: new Date().toISOString(),
          settings: clonedSettings,
          buildings: clonedBuildings
        };

        const zip = new AdmZip();
        zip.addFile('manifest.json', Buffer.from(JSON.stringify(manifest, null, 2), 'utf8'));

        for (const [diskPath, archiveName] of fileMap.entries()) {
          try {
            zip.addLocalFile(diskPath, 'media', archiveName);
          } catch (zipAddErr) {
            console.warn(`Could not add local file ${diskPath} to archive:`, zipAddErr.message);
          }
        }

        const zipBuf = zip.toBuffer();
        const dateStr = new Date().toISOString().slice(0, 10);
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="badatel-backup-${dateStr}.zip"`);
        res.setHeader('Content-Length', zipBuf.length);
        res.statusCode = 200;
        return res.end(zipBuf);
      }

      // 9. POST /api/import/inspect
      if (req.method === 'POST' && rawPathname === '/api/import/inspect') {
        cleanOldTempFiles();
        const contentType = (req.headers['content-type'] || '').toLowerCase();
        let zipPath = null;
        let tempToken = null;

        if (contentType.includes('application/json')) {
          const body = await parseJsonBody(req);
          const { base64, token } = body;
          if (token) {
            const safeToken = path.basename(token).replace(/[^a-zA-Z0-9._-]/g, '');
            zipPath = path.join(getTempDir(), safeToken);
            tempToken = safeToken;
            if (!fs.existsSync(zipPath)) {
              res.statusCode = 400;
              return res.end(JSON.stringify({ error: 'Archive not found or expired' }));
            }
          } else if (base64 && typeof base64 === 'string') {
            const base64Data = base64.replace(/^data:[^;]+;base64,/, '');
            tempToken = `import_${Date.now()}_${Math.random().toString(36).slice(2)}.zip`;
            zipPath = path.join(getTempDir(), tempToken);
            fs.writeFileSync(zipPath, Buffer.from(base64Data, 'base64'));
          } else {
            res.statusCode = 400;
            return res.end(JSON.stringify({ error: 'Archive stream, token, or base64 required' }));
          }
        } else {
          // Direct binary stream (application/octet-stream, etc.)
          const { tempName, tempPath } = await receiveStreamToFile(req);
          zipPath = tempPath;
          tempToken = tempName;
        }

        let zip;
        try {
          zip = new AdmZip(zipPath);
        } catch (zipErr) {
          try { fs.unlinkSync(zipPath); } catch {}
          res.statusCode = 400;
          return res.end(JSON.stringify({ error: 'Invalid ZIP archive file' }));
        }

        const manifestEntry = zip.getEntry('manifest.json');
        if (!manifestEntry) {
          try { fs.unlinkSync(zipPath); } catch {}
          res.statusCode = 400;
          return res.end(JSON.stringify({ error: 'Invalid archive: missing manifest.json' }));
        }

        let manifest;
        try {
          manifest = JSON.parse(zip.readAsText(manifestEntry));
        } catch (err) {
          try { fs.unlinkSync(zipPath); } catch {}
          res.statusCode = 400;
          return res.end(JSON.stringify({ error: 'Failed to parse manifest.json: corrupted data' }));
        }

        if (!manifest.settings || !Array.isArray(manifest.buildings)) {
          try { fs.unlinkSync(zipPath); } catch {}
          res.statusCode = 400;
          return res.end(JSON.stringify({ error: 'Archive manifest is missing settings or buildings' }));
        }

        const mediaEntries = zip.getEntries().filter(e => !e.isDirectory && e.entryName.startsWith('media/'));
        let totalDocs = 0;
        for (const b of manifest.buildings) {
          if (Array.isArray(b.documents)) {
            totalDocs += b.documents.length;
          }
        }

        const fileSize = fs.existsSync(zipPath) ? fs.statSync(zipPath).size : 0;
        const preview = {
          title: manifest.settings?.title || 'Badatel Project',
          exportedAt: manifest.exportedAt || null,
          mapCount: Array.isArray(manifest.settings?.maps) ? manifest.settings.maps.length : 0,
          buildingCount: manifest.buildings.length,
          documentCount: totalDocs,
          mediaFileCount: mediaEntries.length,
          archiveSizeBytes: fileSize
        };

        res.statusCode = 200;
        return res.end(JSON.stringify({ success: true, preview, token: tempToken }));
      }

      // 10. POST /api/import/execute
      if (req.method === 'POST' && rawPathname === '/api/import/execute') {
        cleanOldTempFiles();
        const contentType = (req.headers['content-type'] || '').toLowerCase();
        let zipPath = null;
        let mode = 'replace';
        let shouldUnlinkZip = true;

        if (contentType.includes('application/json')) {
          const body = await parseJsonBody(req);
          mode = body.mode || 'replace';
          if (body.token) {
            const safeToken = path.basename(body.token).replace(/[^a-zA-Z0-9._-]/g, '');
            zipPath = path.join(getTempDir(), safeToken);
            if (!fs.existsSync(zipPath)) {
              res.statusCode = 400;
              return res.end(JSON.stringify({ error: 'Import session expired or archive file not found. Please re-select your file.' }));
            }
          } else if (body.base64 && typeof body.base64 === 'string') {
            const base64Data = body.base64.replace(/^data:[^;]+;base64,/, '');
            const tempName = `import_${Date.now()}_${Math.random().toString(36).slice(2)}.zip`;
            zipPath = path.join(getTempDir(), tempName);
            fs.writeFileSync(zipPath, Buffer.from(base64Data, 'base64'));
          } else {
            res.statusCode = 400;
            return res.end(JSON.stringify({ error: 'token, base64, or binary stream required' }));
          }
        } else {
          // Direct binary stream
          const urlObj = new URL(req.url, 'http://localhost');
          mode = urlObj.searchParams.get('mode') || 'replace';
          const { tempPath } = await receiveStreamToFile(req);
          zipPath = tempPath;
        }

        let zip;
        try {
          zip = new AdmZip(zipPath);
        } catch (zipErr) {
          if (shouldUnlinkZip && fs.existsSync(zipPath)) {
            try { fs.unlinkSync(zipPath); } catch {}
          }
          res.statusCode = 400;
          return res.end(JSON.stringify({ error: 'Invalid ZIP archive file' }));
        }

        const manifestEntry = zip.getEntry('manifest.json');
        if (!manifestEntry) {
          if (shouldUnlinkZip && fs.existsSync(zipPath)) {
            try { fs.unlinkSync(zipPath); } catch {}
          }
          res.statusCode = 400;
          return res.end(JSON.stringify({ error: 'Invalid archive: missing manifest.json' }));
        }

        let manifest;
        try {
          manifest = JSON.parse(zip.readAsText(manifestEntry));
        } catch (err) {
          if (shouldUnlinkZip && fs.existsSync(zipPath)) {
            try { fs.unlinkSync(zipPath); } catch {}
          }
          res.statusCode = 400;
          return res.end(JSON.stringify({ error: 'Failed to parse manifest.json: corrupted data' }));
        }

        if (!manifest.settings || !Array.isArray(manifest.buildings)) {
          if (shouldUnlinkZip && fs.existsSync(zipPath)) {
            try { fs.unlinkSync(zipPath); } catch {}
          }
          res.statusCode = 400;
          return res.end(JSON.stringify({ error: 'Archive manifest is missing settings or buildings' }));
        }

        // If replacing all data, take a safety backup first
        if (mode === 'replace') {
          try {
            const backupFile = path.join(getBackupDir(), `pre_replace_backup_${Date.now()}.json`);
            const snapshot = {
              timestamp: new Date().toISOString(),
              settings: readSettings(),
              buildings: readBuildings()
            };
            fs.writeFileSync(backupFile, JSON.stringify(snapshot, null, 2), 'utf8');
            console.log(`Created pre-import safety backup at ${backupFile}`);
          } catch (backupErr) {
            console.warn('Failed to write safety backup:', backupErr.message);
          }
        }

        // Unpack media files safely to UPLOADS_DIR
        const entries = zip.getEntries();
        for (const entry of entries) {
          if (!entry.isDirectory && entry.entryName.startsWith('media/')) {
            const safeName = path.basename(entry.entryName).replace(/[^a-zA-Z0-9._-]/g, '_');
            const targetPath = path.join(getUploadsDir(), safeName);
            fs.writeFileSync(targetPath, entry.getData());
          }
        }
        await syncHashIndexWithDisk();

        // Clean up temp archive file
        if (shouldUnlinkZip && fs.existsSync(zipPath)) {
          try { fs.unlinkSync(zipPath); } catch {}
        }

        let finalSettings;
        let finalBuildings;

        if (mode === 'replace') {
          // Normalize URLs in imported settings
          const importedSettings = manifest.settings;
          if (Array.isArray(importedSettings.maps)) {
            for (const m of importedSettings.maps) {
              m.imageUrl = normalizeImportUrl(m.imageUrl);
            }
          }

          // Normalize URLs in imported buildings
          const importedBuildings = manifest.buildings.map(b => ({
            ...b,
            documents: (b.documents || []).map(d => ({
              ...d,
              url: normalizeImportUrl(d.url)
            }))
          }));

          finalSettings = importedSettings;
          finalBuildings = importedBuildings;
        } else {
          // Mode === 'merge'
          const currentSettings = readSettings();
          const currentBuildings = readBuildings();

          const existingMapIds = new Set((currentSettings.maps || []).map(m => m.id));
          const mapIdRemap = new Map();

          const importedMaps = (manifest.settings.maps || []).map((m, idx) => {
            let targetId = m.id;
            if (existingMapIds.has(targetId)) {
              targetId = `page-${Date.now()}-${idx}`;
            }
            mapIdRemap.set(m.id, targetId);
            existingMapIds.add(targetId);
            return {
              ...m,
              id: targetId,
              imageUrl: normalizeImportUrl(m.imageUrl)
            };
          });

          finalSettings = {
            ...currentSettings,
            maps: [...(currentSettings.maps || []), ...importedMaps]
          };

          const existingBuildingIds = new Set(currentBuildings.map(b => b.id));
          const importedBuildings = manifest.buildings.map((b, idx) => {
            let targetId = b.id;
            if (existingBuildingIds.has(targetId)) {
              targetId = `b-${Date.now()}-${idx}`;
            }
            existingBuildingIds.add(targetId);

            const remappedMapId = mapIdRemap.has(b.mapId) ? mapIdRemap.get(b.mapId) : b.mapId;

            return {
              ...b,
              id: targetId,
              mapId: remappedMapId,
              documents: (b.documents || []).map(d => ({
                ...d,
                url: normalizeImportUrl(d.url)
              }))
            };
          });

          finalBuildings = [...currentBuildings, ...importedBuildings];
        }

        writeSettings(finalSettings);
        writeBuildings(finalBuildings);

        res.statusCode = 200;
        return res.end(JSON.stringify({
          success: true,
          mode,
          settings: finalSettings,
          buildings: finalBuildings
        }));
      }

      res.statusCode = 404;
      return res.end(JSON.stringify({ error: 'API endpoint not found' }));
    } catch (err) {
      console.error('API Error:', err);
      res.statusCode = 500;
      return res.end(JSON.stringify({ error: err.message || 'Server error' }));
    }
  };
}
