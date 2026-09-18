import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import sharp from 'sharp';
import heicConvert from 'heic-convert';

const execFileAsync = promisify(execFile);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const DATA_DIR = path.join(rootDir, 'data');
const BUILDINGS_FILE = path.join(DATA_DIR, 'buildings.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
const UPLOADS_DIR = path.join(rootDir, 'public', 'uploads');
const SAMPLE_DIR = path.join(rootDir, 'public', 'sample-map');

// Ensure directories exist
for (const dir of [DATA_DIR, UPLOADS_DIR, SAMPLE_DIR]) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
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
          size: stat ? stat.size : 0
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
    if (fs.existsSync(SETTINGS_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
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
  writeAtomicJson(SETTINGS_FILE, settings);
}

function readBuildings() {
  try {
    if (fs.existsSync(BUILDINGS_FILE)) {
      return JSON.parse(fs.readFileSync(BUILDINGS_FILE, 'utf8'));
    }
  } catch (err) {
    console.error('Error reading buildings:', err);
  }
  return defaultBuildings;
}

function writeBuildings(buildings) {
  writeAtomicJson(BUILDINGS_FILE, buildings);
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
  if (!fs.existsSync(SETTINGS_FILE)) {
    writeSettings(defaultSettings);
  }
  if (!fs.existsSync(BUILDINGS_FILE)) {
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

      // 4. POST /api/upload
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
        if (subfolder && typeof subfolder === 'string') {
          const cleanSub = path.normalize(subfolder).replace(/^(\.\.[\/\\])+/, '').trim();
          const segments = cleanSub.split(/[/\\]/).filter(s => s && s !== '.' && s !== '..');
          safeSubfolder = segments.map(s => s.replace(/[^a-zA-Z0-9._ -]/g, '_')).join('/');
        }

        const safeBase = path.basename(filename).replace(/[^a-zA-Z0-9._-]/g, '_');
        const cleanName = `${Date.now()}_${safeBase}`;
        
        let targetDir = UPLOADS_DIR;
        if (target === 'map') {
          targetDir = path.join(rootDir, 'public', 'uploads');
        } else if (safeSubfolder) {
          targetDir = path.join(UPLOADS_DIR, safeSubfolder);
        }

        if (!fs.existsSync(targetDir)) {
          fs.mkdirSync(targetDir, { recursive: true });
        }

        const filePath = path.join(targetDir, cleanName);

        // Strip data:image/...;base64, prefix if present
        const base64Data = base64.replace(/^data:[^;]+;base64,/, '');
        fs.writeFileSync(filePath, Buffer.from(base64Data, 'base64'));

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

        const relativeUrlPath = safeSubfolder 
          ? `${safeSubfolder.split('/').map(s => encodeURIComponent(s)).join('/')}/${encodeURIComponent(finalName)}`
          : encodeURIComponent(finalName);
        const publicUrl = `/uploads/${relativeUrlPath}`;

        res.statusCode = 200;
        return res.end(JSON.stringify({
          success: true,
          url: publicUrl,
          filename: finalName,
          subfolder: safeSubfolder,
          width,
          height
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
        const publicBase = path.join(rootDir, 'public');
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
        const { files, folders } = await scanUploadsDirectory(UPLOADS_DIR);
        res.statusCode = 200;
        return res.end(JSON.stringify({ files, folders }));
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
