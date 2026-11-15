// src/main/main.js
const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const { exec, execFile, spawn } = require('child_process');

const {
  loadSettings,
  saveSettings,
  updateRepoMeta,
  appendRepoHistory,
  clearRepoHistory,
  getRepoSyncHistory,
} = require('./storageService');
const { scanRootFolder } = require('./folderScanner');
const readmeReader = require('./readmeReader');
const {
  safePullRepo,
  checkRepoForUpdates,
  clonePublicRepo,
  getGitCommitHistory,
} = require('./gitService');
const { listDirectory, readFileContent } = require('./fileTreeService');

const readAndPrepareReadme =
  readmeReader.readAndPrepareReadme || readmeReader.readReadmeContent;

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 960,
    minHeight: 600,
    backgroundColor: '#121314',
    title: 'GitCairn — Local GitHub Viewer',
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#191A1B',
      symbolColor: '#bfbfbf',
      height: 38,
    },
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false, // Allows local README images to render cleanly
    },
  });

  // Open external http/https links in default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (
      url !== mainWindow.webContents.getURL() &&
      (url.startsWith('http://') || url.startsWith('https://'))
    ) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  const isDev = !app.isPackaged;
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'));
  }
}

app.whenReady().then(() => {
  // 1. Load saved settings & initial repository list
  ipcMain.handle('get-initial-data', async () => {
    const settings = loadSettings();
    const repos = settings.rootFolder
      ? await scanRootFolder(settings.rootFolder, settings.repoMeta)
      : [];
    return { settings, repos };
  });

  // 2. Choose root OSSGitHub folder
  ipcMain.handle('select-root-folder', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
      title: 'Select Your OSSGitHub Folder',
    });
    if (result.canceled || result.filePaths.length === 0) return null;

    const settings = loadSettings();
    settings.rootFolder = result.filePaths[0];
    saveSettings(settings);

    const repos = await scanRootFolder(settings.rootFolder, settings.repoMeta);
    return { settings, repos };
  });

  // 3. Read README.md and rewrite local image paths
  ipcMain.handle('read-readme', async (_, { readmePath, repoPath }) => {
    return readAndPrepareReadme(readmePath, repoPath);
  });

  // 4. Toggle Star / Favorite
  ipcMain.handle('toggle-favorite', async (_, repoName) => {
    const settings = loadSettings();
    const current = settings.repoMeta[repoName]?.isFavorite || false;
    const updatedSettings = updateRepoMeta(repoName, { isFavorite: !current });
    const repos = await scanRootFolder(updatedSettings.rootFolder, updatedSettings.repoMeta);
    return { repos };
  });

  // 5. Save Tags & Personal Notes
  ipcMain.handle('save-repo-meta', async (_, { repoName, tags, notes }) => {
    const updatedSettings = updateRepoMeta(repoName, { tags, notes });
    const repos = await scanRootFolder(updatedSettings.rootFolder, updatedSettings.repoMeta);
    return { repos };
  });

  // 6. Safe Pull Single Repo + Record Sync History Event
  ipcMain.handle('pull-single-repo', async (_, repo) => {
    const result = await safePullRepo(repo.path, repo.isGitRepo);
    const nowIso = new Date().toISOString();

    const updatedSettings =
      result.status !== 'non-git'
        ? appendRepoHistory(
            repo.name,
            {
              type: 'pull',
              status: result.status,
              message: result.message,
              fromCommit: result.fromCommit || null,
              toCommit: result.toCommit || null,
            },
            {
              syncStatus: result.status,
              lastPulled: nowIso,
            }
          )
        : updateRepoMeta(repo.name, { syncStatus: result.status });

    const repos = await scanRootFolder(updatedSettings.rootFolder, updatedSettings.repoMeta);
    return { result, repos };
  });

  // 7. Dry-Run Check Single Repo + Record Check History Event
  ipcMain.handle('check-single-repo', async (_, repo) => {
    const result = await checkRepoForUpdates(repo.path, repo.isGitRepo);

    const updatedSettings =
      result.status !== 'non-git'
        ? appendRepoHistory(
            repo.name,
            {
              type: 'check',
              status: result.status,
              message: result.message,
              fromCommit: result.fromCommit || null,
              toCommit: result.toCommit || null,
            },
            {
              syncStatus: result.status,
            }
          )
        : updateRepoMeta(repo.name, { syncStatus: result.status });

    const repos = await scanRootFolder(updatedSettings.rootFolder, updatedSettings.repoMeta);
    return { result, repos };
  });

  // 8. Full Git Clone + Record Initial Clone History Event
  ipcMain.handle('clone-repo', async (_, gitUrl) => {
    const settings = loadSettings();
    if (!settings.rootFolder) {
      return { ok: false, message: 'Please select a root folder first.' };
    }

    const res = await clonePublicRepo(settings.rootFolder, gitUrl);
    let latestSettings = settings;

    if (res.ok && res.repoName) {
      latestSettings = appendRepoHistory(
        res.repoName,
        {
          type: 'clone',
          status: 'cloned',
          message: res.message,
          fromCommit: null,
          toCommit: res.toCommit || null,
        },
        {
          syncStatus: 'up-to-date',
          lastPulled: new Date().toISOString(),
        }
      );
    }

    const repos = await scanRootFolder(latestSettings.rootFolder, latestSettings.repoMeta);
    return { ...res, repos };
  });

  // 9. Safe Delete Repo to Windows 11 Recycle Bin
  ipcMain.handle('delete-repo-to-trash', async (_, repoPath) => {
    await shell.trashItem(repoPath);
    const settings = loadSettings();
    const repos = await scanRootFolder(settings.rootFolder, settings.repoMeta);
    return { ok: true, repos };
  });

  // 10. Open in Windows File Explorer or VS Code
  ipcMain.handle('open-in-explorer', async (_, folderPath) => {
    if (folderPath) shell.openPath(folderPath);
  });

  ipcMain.handle('open-in-vscode', async (_, folderPath) => {
    if (!folderPath) return;
    execFile('code.cmd', [folderPath], (err) => {
      if (err) exec(`code "${folderPath}"`);
    });
  });

  // 11. Read-Only File Browser & Code Peek
  ipcMain.handle('files:listDir', async (_, { repoPath, relativeSubPath }) => {
    return listDirectory(repoPath, relativeSubPath);
  });

  ipcMain.handle('files:readFile', async (_, { repoPath, relativeFilePath }) => {
    return readFileContent(repoPath, relativeFilePath);
  });

  // 12. Repository History Timeline (OSSVault Sync Log + Local Git Commits)
  ipcMain.handle('get-repo-history', async (_, { repoName, repoPath, isGitRepo }) => {
    const syncHistory = getRepoSyncHistory(repoName);
    const gitCommits = await getGitCommitHistory(repoPath, isGitRepo, 40);
    return { syncHistory, gitCommits };
  });

  ipcMain.handle('clear-repo-history', async (_, repoName) => {
    const updatedSettings = clearRepoHistory(repoName);
    const repos = updatedSettings.rootFolder
      ? await scanRootFolder(updatedSettings.rootFolder, updatedSettings.repoMeta)
      : [];
    return { ok: true, syncHistory: [], repos };
  });

  // 13. Frameless Window Controls
  ipcMain.handle('window:minimize', () => {
    if (mainWindow) mainWindow.minimize();
  });

  ipcMain.handle('window:maximize', () => {
    if (mainWindow) {
      if (mainWindow.isMaximized()) {
        mainWindow.unmaximize();
      } else {
        mainWindow.maximize();
      }
    }
    return mainWindow ? mainWindow.isMaximized() : false;
  });

  ipcMain.handle('window:close', () => {
    if (mainWindow) mainWindow.close();
  });

  ipcMain.handle('window:isMaximized', () => {
    return mainWindow ? mainWindow.isMaximized() : false;
  });

  // 14. Interactive Shell Process Management (PowerShell / Command Prompt)
  const activeShells = new Map();

  ipcMain.handle('shell:create', (event, { shellId, cwd, shellType = 'powershell' }) => {
    const isWin = process.platform === 'win32';
    const shellExe = isWin
      ? shellType === 'cmd'
        ? 'cmd.exe'
        : 'powershell.exe'
      : process.env.SHELL || 'bash';

    const shellArgs = isWin
      ? shellType === 'cmd'
        ? []
        : ['-NoLogo']
      : [];

    const effectiveCwd = cwd || app.getPath('home');

    try {
      const child = spawn(shellExe, shellArgs, {
        cwd: effectiveCwd,
        env: {
          ...process.env,
          TERM: 'xterm-256color',
        },
      });

      child.stdout.on('data', (data) => {
        if (!mainWindow || mainWindow.isDestroyed()) return;
        mainWindow.webContents.send(`shell:data:${shellId}`, data.toString('utf8'));
      });

      child.stderr.on('data', (data) => {
        if (!mainWindow || mainWindow.isDestroyed()) return;
        mainWindow.webContents.send(`shell:data:${shellId}`, data.toString('utf8'));
      });

      child.on('close', (code) => {
        if (!mainWindow || mainWindow.isDestroyed()) return;
        mainWindow.webContents.send(`shell:exit:${shellId}`, code);
        activeShells.delete(shellId);
      });

      child.on('error', (err) => {
        if (!mainWindow || mainWindow.isDestroyed()) return;
        mainWindow.webContents.send(`shell:data:${shellId}`, `\r\nFailed to spawn shell: ${err.message}\r\n`);
      });

      activeShells.set(shellId, child);
      return { ok: true, shellId, cwd: effectiveCwd, shellType };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('shell:input', (_, { shellId, input }) => {
    const child = activeShells.get(shellId);
    if (child && child.stdin && !child.stdin.destroyed) {
      child.stdin.write(input);
      return { ok: true };
    }
    return { ok: false, error: 'Shell not found or stdin closed' };
  });

  ipcMain.handle('shell:kill', (_, shellId) => {
    const child = activeShells.get(shellId);
    if (child) {
      try {
        child.kill();
      } catch (e) {
        // ignore
      }
      activeShells.delete(shellId);
      return { ok: true };
    }
    return { ok: false };
  });

  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
