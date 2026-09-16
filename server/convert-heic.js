import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const targetDir = process.argv[2] ? path.resolve(process.argv[2]) : path.resolve('public/uploads');

console.log(`Scanning for .heic / .HEIC files in: ${targetDir}`);

if (!fs.existsSync(targetDir)) {
  console.error(`Directory not found: ${targetDir}`);
  process.exit(1);
}

import sharp from 'sharp';
import heicConvert from 'heic-convert';

async function convertFile(fullPath, jpgPath) {
  // Try sips on macOS
  if (fs.existsSync('/usr/bin/sips')) {
    try {
      await execFileAsync('/usr/bin/sips', ['-s', 'format', 'jpeg', fullPath, '--out', jpgPath]);
      const autoOrientedBuffer = await sharp(jpgPath).rotate().toBuffer();
      fs.writeFileSync(jpgPath, autoOrientedBuffer);
      return true;
    } catch {}
  }

  // Cross-platform fallback
  try {
    const inputBuffer = fs.readFileSync(fullPath);
    const converted = await heicConvert({ buffer: inputBuffer, format: 'JPEG', quality: 0.92 });
    const autoOrientedBuffer = await sharp(converted).rotate().toBuffer();
    fs.writeFileSync(jpgPath, autoOrientedBuffer);
    return true;
  } catch (err) {
    console.error(`✗ Failed to convert ${path.basename(fullPath)}:`, err.message);
    return false;
  }
}

async function convertFolder(dir) {
  const files = fs.readdirSync(dir);
  let convertedCount = 0;

  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      convertedCount += await convertFolder(fullPath);
    } else if (file.toLowerCase().endsWith('.heic')) {
      const jpgPath = fullPath.replace(/\.heic$/i, '.jpg');
      if (!fs.existsSync(jpgPath)) {
        console.log(`Converting: ${file} -> ${path.basename(jpgPath)}...`);
        const ok = await convertFile(fullPath, jpgPath);
        if (ok) {
          convertedCount++;
          console.log(`✓ Converted: ${path.basename(jpgPath)}`);
        }
      } else {
        console.log(`Already converted: ${path.basename(jpgPath)}`);
      }
    }
  }

  return convertedCount;
}

convertFolder(targetDir).then(count => {
  console.log(`Done! Converted ${count} HEIC image(s) to JPEG.`);
});
