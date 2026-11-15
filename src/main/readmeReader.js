// src/main/readmeReader.js
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

function resolveLocalAssetUrl(repoPath, rawRelPath) {
  try {
    // Strip optional markdown title, e.g. ./img.png "Screenshot"
    const cleanTarget = rawRelPath.trim().split(/\s+["']/)[0].replace(/^<|>$/g, '');
    const cleanRel = cleanTarget.replace(/^[/\\]+/, '');
    const absPath = path.resolve(repoPath, cleanRel);

    // Ensure resolved image stays inside the repository folder
    const resolvedRepo = path.resolve(repoPath);
    if (absPath !== resolvedRepo && !absPath.startsWith(resolvedRepo + path.sep)) {
      return rawRelPath;
    }

    return pathToFileURL(absPath).href;
  } catch {
    return rawRelPath;
  }
}

function readAndPrepareReadme(readmePath, repoPath) {
  if (!readmePath || !fs.existsSync(readmePath)) {
    return '*No README.md file found in the root of this folder.*';
  }

  try {
    let markdown = fs.readFileSync(readmePath, 'utf-8');

    // Rewrite Markdown images: ![alt](./path/to/img.png)
    markdown = markdown.replace(
      /!\[([^\]]*)\]\((?!https?:\/\/|file:\/\/|data:|#|\/\/)([^)]+)\)/gi,
      (match, alt, relPath) => {
        const assetUrl = resolveLocalAssetUrl(repoPath, relPath);
        return `![${alt}](${assetUrl})`;
      }
    );

    // Rewrite HTML <img src="relative/path.png">
    markdown = markdown.replace(
      /<img([^>]*?)src=["'](?!https?:\/\/|file:\/\/|data:|\/\/)([^"']+)["']/gi,
      (match, attrs, relPath) => {
        const assetUrl = resolveLocalAssetUrl(repoPath, relPath);
        return `<img${attrs}src="${assetUrl}"`;
      }
    );

    return markdown;
  } catch (err) {
    return `*Error reading README file: ${err.message}*`;
  }
}

module.exports = {
  readAndPrepareReadme,
  readReadmeContent: readAndPrepareReadme,
};
