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

async function convertFolder(dir) {
  const files = fs.readdirSync(dir);
  let convertedCount = 0;

  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      await convertFolder(fullPath);
    } else if (file.toLowerCase().endsWith('.heic')) {
      const jpgPath = fullPath.replace(/\.heic$/i, '.jpg');
      if (!fs.existsSync(jpgPath)) {
        console.log(`Converting: ${file} -> ${path.basename(jpgPath)}...`);
        try {
          await execFileAsync('/usr/bin/sips', ['-s', 'format', 'jpeg', fullPath, '--out', jpgPath]);
          convertedCount++;
          console.log(`✓ Converted: ${path.basename(jpgPath)}`);
        } catch (err) {
          console.error(`✗ Failed to convert ${file}:`, err.message);
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
