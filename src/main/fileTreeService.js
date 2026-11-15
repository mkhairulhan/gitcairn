// src/main/fileTreeService.js
const fs = require('fs');
const path = require('path');

// Folders to hide so the file browser stays snappy
const IGNORED_DIRS = new Set(['.git', 'node_modules', '.next', 'dist', 'build', '__pycache__', '.venv', 'target']);

// Common binary extensions that shouldn't be rendered as plain text
const BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.bmp', '.pdf',
  '.zip', '.tar', '.gz', '.7z', '.rar', '.exe', '.dll', '.so', '.dylib',
  '.mp3', '.mp4', '.wav', '.ogg', '.webm', '.woff', '.woff2', '.ttf', '.eot', '.pyc'
]);

/**
 * Lists the immediate children (folders + files) of a directory inside a repo
 */
function listDirectory(repoPath, relativeSubPath = '') {
  try {
    const targetPath = path.resolve(repoPath, relativeSubPath);

    // Security check: ensure targetPath stays inside repoPath
    if (!targetPath.startsWith(path.resolve(repoPath))) {
      return { error: 'Invalid path traversal blocked.' };
    }

    const entries = fs.readdirSync(targetPath, { withFileTypes: true });
    const items = [];

    for (const entry of entries) {
      if (entry.isDirectory() && IGNORED_DIRS.has(entry.name)) continue;

      const fullPath = path.join(targetPath, entry.name);
      const relPath = path.relative(repoPath, fullPath).replace(/\\/g, '/');

      let size = 0;
      if (entry.isFile()) {
        try {
          size = fs.statSync(fullPath).size;
        } catch {
          size = 0;
        }
      }

      items.push({
        name: entry.name,
        relativePath: relPath,
        isDirectory: entry.isDirectory(),
        size
      });
    }

    // Sort folders first, then files alphabetically
    items.sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    return { items };
  } catch (err) {
    return { error: err.message };
  }
}

/**
 * Reads a file in read-only mode for the Code Peek panel
 */
function readFileContent(repoPath, relativeFilePath) {
  try {
    const targetPath = path.resolve(repoPath, relativeFilePath);
    if (!targetPath.startsWith(path.resolve(repoPath))) {
      return { error: 'Invalid file path.' };
    }

    const ext = path.extname(targetPath).toLowerCase();
    if (BINARY_EXTENSIONS.has(ext)) {
      return {
        isBinary: true,
        extension: ext,
        fileUrl: `file:///${targetPath.replace(/\\/g, '/')}`
      };
    }

    const stats = fs.statSync(targetPath);
    const MAX_SIZE = 500 * 1024; // 500 KB max preview
    if (stats.size > MAX_SIZE) {
      return {
        isTooLarge: true,
        sizeKB: Math.round(stats.size / 1024)
      };
    }

    const content = fs.readFileSync(targetPath, 'utf-8');
    return {
      content,
      size: stats.size,
      extension: ext
    };
  } catch (err) {
    return { error: err.message };
  }
}

module.exports = { listDirectory, readFileContent };
