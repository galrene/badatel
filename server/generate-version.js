import { saveVersionFile } from './version-helper.js';

try {
  const versionInfo = saveVersionFile();
  console.log('Generated version.json:', versionInfo.version, versionInfo.shortHash, `"${versionInfo.commitMessage}"`);
} catch (err) {
  console.warn('Failed to generate version.json (using fallback):', err.message);
}
