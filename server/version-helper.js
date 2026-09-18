import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const VERSION_FILE = path.join(rootDir, 'version.json');
const PKG_FILE = path.join(rootDir, 'package.json');

/**
 * Safely runs a git command with timeout and error suppression
 */
function runGit(cmd) {
  try {
    return execSync(cmd, {
      cwd: rootDir,
      encoding: 'utf8',
      timeout: 3000,
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim();
  } catch {
    return '';
  }
}

/**
 * Returns comprehensive version information using git, env, version.json, and package.json
 */
export function getVersionInfo() {
  let pkgVersion = '0.1.0';
  try {
    if (fs.existsSync(PKG_FILE)) {
      const pkg = JSON.parse(fs.readFileSync(PKG_FILE, 'utf8'));
      if (pkg.version) pkgVersion = pkg.version;
    }
  } catch {}

  let fileData = {};
  try {
    if (fs.existsSync(VERSION_FILE)) {
      fileData = JSON.parse(fs.readFileSync(VERSION_FILE, 'utf8'));
    }
  } catch {}

  const gitHash = runGit('git rev-parse HEAD');
  const gitShortHash = runGit('git rev-parse --short HEAD');
  const gitMessage = runGit('git log -1 --format=%s');
  const gitDate = runGit('git log -1 --format=%cd --date=iso');
  const gitBranch = runGit('git rev-parse --abbrev-ref HEAD');

  const commitHash =
    process.env.VITE_COMMIT_HASH ||
    process.env.COMMIT_HASH ||
    process.env.GIT_COMMIT ||
    gitHash ||
    fileData.commitHash ||
    'dev';

  const shortHash =
    gitShortHash ||
    (commitHash !== 'dev' ? commitHash.slice(0, 7) : '') ||
    fileData.shortHash ||
    'dev';

  const commitMessage =
    process.env.VITE_COMMIT_MESSAGE ||
    process.env.COMMIT_MESSAGE ||
    gitMessage ||
    fileData.commitMessage ||
    'Working build';

  const commitDate =
    gitDate ||
    fileData.commitDate ||
    new Date().toISOString();

  const branch =
    process.env.GIT_BRANCH ||
    gitBranch ||
    fileData.branch ||
    'main';

  const version = pkgVersion || fileData.version || '0.1.0';
  const buildTime = fileData.buildTime || new Date().toISOString();

  return {
    version,
    commitHash,
    shortHash,
    commitMessage,
    commitDate,
    branch,
    buildTime
  };
}

/**
 * Writes or updates version.json with current version info
 */
export function saveVersionFile(extra = {}) {
  const current = getVersionInfo();
  const data = {
    ...current,
    buildTime: new Date().toISOString(),
    ...extra
  };
  fs.writeFileSync(VERSION_FILE, JSON.stringify(data, null, 2) + '\n', 'utf8');
  return data;
}
