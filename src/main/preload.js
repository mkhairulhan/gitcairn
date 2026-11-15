// src/main/preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getInitialData: () => ipcRenderer.invoke('get-initial-data'),
  selectRootFolder: () => ipcRenderer.invoke('select-root-folder'),
  readReadme: (readmePath, repoPath) =>
    ipcRenderer.invoke('read-readme', { readmePath, repoPath }),
  toggleFavorite: (repoName) => ipcRenderer.invoke('toggle-favorite', repoName),
  saveRepoMeta: (repoName, tags, notes) =>
    ipcRenderer.invoke('save-repo-meta', { repoName, tags, notes }),
  pullSingleRepo: (repo) => ipcRenderer.invoke('pull-single-repo', repo),
  checkSingleRepo: (repo) => ipcRenderer.invoke('check-single-repo', repo),
  cloneRepo: (gitUrl) => ipcRenderer.invoke('clone-repo', gitUrl),
  deleteRepoToTrash: (repoPath) => ipcRenderer.invoke('delete-repo-to-trash', repoPath),
  openInExplorer: (folderPath) => ipcRenderer.invoke('open-in-explorer', folderPath),
  openInVSCode: (folderPath) => ipcRenderer.invoke('open-in-vscode', folderPath),
  listDir: (repoPath, relativeSubPath) =>
    ipcRenderer.invoke('files:listDir', { repoPath, relativeSubPath }),
  readFile: (repoPath, relativeFilePath) =>
    ipcRenderer.invoke('files:readFile', { repoPath, relativeFilePath }),
  getRepoHistory: (repo) =>
    ipcRenderer.invoke('get-repo-history', {
      repoName: repo.name,
      repoPath: repo.path,
      isGitRepo: repo.isGitRepo,
    }),
  clearRepoHistory: (repoName) =>
    ipcRenderer.invoke('clear-repo-history', repoName),
  windowMinimize: () => ipcRenderer.invoke('window:minimize'),
  windowMaximize: () => ipcRenderer.invoke('window:maximize'),
  windowClose: () => ipcRenderer.invoke('window:close'),
  windowIsMaximized: () => ipcRenderer.invoke('window:isMaximized'),
  shellCreate: (params) => ipcRenderer.invoke('shell:create', params),
  shellInput: (params) => ipcRenderer.invoke('shell:input', params),
  shellKill: (shellId) => ipcRenderer.invoke('shell:kill', shellId),
  onShellData: (shellId, callback) => {
    const channel = `shell:data:${shellId}`;
    const handler = (_, data) => callback(data);
    ipcRenderer.on(channel, handler);
    return () => ipcRenderer.removeListener(channel, handler);
  },
  onShellExit: (shellId, callback) => {
    const channel = `shell:exit:${shellId}`;
    const handler = (_, code) => callback(code);
    ipcRenderer.on(channel, handler);
    return () => ipcRenderer.removeListener(channel, handler);
  },
});
