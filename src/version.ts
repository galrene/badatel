import { AppVersionInfo } from './types';

// Safely access Vite defined compile-time variables with fallbacks
export const BUILD_VERSION_INFO: AppVersionInfo = {
  version: typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.1.0',
  commitHash: typeof __COMMIT_HASH__ !== 'undefined' ? __COMMIT_HASH__ : 'dev',
  shortHash: typeof __COMMIT_SHORT_HASH__ !== 'undefined' ? __COMMIT_SHORT_HASH__ : 'dev',
  commitMessage: typeof __COMMIT_MESSAGE__ !== 'undefined' ? __COMMIT_MESSAGE__ : 'Development build',
  commitDate: typeof __COMMIT_DATE__ !== 'undefined' ? __COMMIT_DATE__ : new Date().toISOString(),
  buildTime: typeof __BUILD_TIME__ !== 'undefined' ? __BUILD_TIME__ : new Date().toISOString(),
};

export async function fetchServerVersion(): Promise<AppVersionInfo> {
  try {
    const res = await fetch('/api/version');
    if (!res.ok) throw new Error('Version endpoint failed');
    return await res.json();
  } catch {
    return BUILD_VERSION_INFO;
  }
}
