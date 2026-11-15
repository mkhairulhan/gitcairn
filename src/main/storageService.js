// src/main/storageService.js
const fs = require('fs');
const path = require('path');
const { app } = require('electron');

const settingsPath = path.join(app.getPath('userData'), 'gitcairn-settings.json');

const defaultSettings = {
  rootFolder: '',
  favorites: [],
  repoMeta: {},
};

function loadSettings() {
  try {
    if (!fs.existsSync(settingsPath)) {
      fs.writeFileSync(settingsPath, JSON.stringify(defaultSettings, null, 2), 'utf-8');
      return { ...defaultSettings, repoMeta: {} };
    }
    const raw = fs.readFileSync(settingsPath, 'utf-8');
    const parsed = JSON.parse(raw);
    return {
      ...defaultSettings,
      ...parsed,
      repoMeta: parsed.repoMeta || {},
    };
  } catch (err) {
    console.error('Failed to load settings:', err);
    return { ...defaultSettings, repoMeta: {} };
  }
}

function saveSettings(newSettings) {
  try {
    const current = loadSettings();
    const merged = {
      ...current,
      ...newSettings,
      repoMeta: newSettings.repoMeta !== undefined ? newSettings.repoMeta : current.repoMeta,
    };
    fs.writeFileSync(settingsPath, JSON.stringify(merged, null, 2), 'utf-8');
    return merged;
  } catch (err) {
    console.error('Failed to save settings:', err);
    return loadSettings();
  }
}

function updateRepoMeta(repoName, patch) {
  const settings = loadSettings();
  const existing = settings.repoMeta[repoName] || {
    isFavorite: false,
    tags: [],
    notes: '',
    syncStatus: 'idle',
    lastPulled: null,
    history: [],
  };

  settings.repoMeta[repoName] = {
    ...existing,
    ...patch,
  };

  return saveSettings(settings);
}

function appendRepoHistory(repoName, event, extraMetaPatch = {}) {
  const settings = loadSettings();
  const existing = settings.repoMeta[repoName] || {
    isFavorite: false,
    tags: [],
    notes: '',
    syncStatus: 'idle',
    lastPulled: null,
    history: [],
  };

  const prevHistory = Array.isArray(existing.history) ? existing.history : [];
  const entry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toISOString(),
    ...event,
  };

  // Prepend newest event first, cap at 100 entries per repository
  const nextHistory = [entry, ...prevHistory].slice(0, 100);

  settings.repoMeta[repoName] = {
    ...existing,
    ...extraMetaPatch,
    history: nextHistory,
  };

  return saveSettings(settings);
}

function clearRepoHistory(repoName) {
  return updateRepoMeta(repoName, { history: [] });
}

function getRepoSyncHistory(repoName) {
  const settings = loadSettings();
  const history = settings.repoMeta[repoName]?.history;
  return Array.isArray(history) ? history : [];
}

module.exports = {
  loadSettings,
  saveSettings,
  updateRepoMeta,
  appendRepoHistory,
  clearRepoHistory,
  getRepoSyncHistory,
};
