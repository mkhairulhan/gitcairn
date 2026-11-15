// src/main/folderScanner.js
const fs = require('fs');
const path = require('path');

function getGitRemoteUrl(repoPath) {
  try {
    const configPath = path.join(repoPath, '.git', 'config');
    if (!fs.existsSync(configPath)) return null;
    const content = fs.readFileSync(configPath, 'utf-8');
    const match = content.match(/url\s*=\s*(.+)/);
    return match ? match[1].trim() : null;
  } catch {
    return null;
  }
}

function findReadmeFile(repoPath) {
  try {
    const files = fs.readdirSync(repoPath);
    const readme = files.find((f) => /^readme(\.md|\.txt|\.markdown)?$/i.test(f));
    return readme ? path.join(repoPath, readme) : null;
  } catch {
    return null;
  }
}

async function scanRootFolder(rootPath, repoMeta = {}) {
  if (!rootPath || !fs.existsSync(rootPath)) return [];

  const entries = fs.readdirSync(rootPath, { withFileTypes: true });
  const directories = entries.filter((entry) => entry.isDirectory());

  const repos = directories.map((dir) => {
    const fullPath = path.join(rootPath, dir.name);
    const gitFolder = path.join(fullPath, '.git');
    const isGitRepo = fs.existsSync(gitFolder);
    const stats = fs.statSync(fullPath);
    const meta = repoMeta[dir.name] || {};

    return {
      name: dir.name,
      path: fullPath,
      isGitRepo,
      remoteUrl: isGitRepo ? getGitRemoteUrl(fullPath) : 'Local folder (Non-Git)',
      readmePath: findReadmeFile(fullPath),
      lastModified: stats.mtimeMs,
      isFavorite: Boolean(meta.isFavorite),
      tags: Array.isArray(meta.tags) ? meta.tags : [],
      notes: meta.notes || '',
      lastPulled: meta.lastPulled || null,
      syncStatus: meta.syncStatus || (isGitRepo ? 'idle' : 'non-git'),
      history: Array.isArray(meta.history) ? meta.history : [],
    };
  });

  return repos;
}

module.exports = { scanRootFolder };
