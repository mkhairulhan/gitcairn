// src/renderer/App.jsx — SECTION A (Top Half: Imports, State & Handlers)
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { marked } from 'marked';
import {
  FolderOpen,
  RefreshCw,
  Star,
  Trash2,
  Search,
  ExternalLink,
  Code2,
  Download,
  ShieldAlert,
  CheckCircle2,
  ArrowUpCircle,
  Tag,
  StickyNote,
  Sparkles,
  CheckSquare,
  Square,
  BookOpen,
  FolderTree,
  Terminal,
  Loader2,
  ChevronUp,
  ChevronDown,
  History,
} from 'lucide-react';
import FileBrowser from './components/FileBrowser';
import TerminalDrawer from './components/TerminalDrawer';
import RepoHistory from './components/RepoHistory';
import ImageLightbox from './components/ImageLightbox';

// Helper pause function to respect GitHub rate limits between 5-repo chunks
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export default function App() {
  const [rootFolder, setRootFolder] = useState("");
  const [repos, setRepos] = useState([]);
  const [selectedRepoName, setSelectedRepoName] = useState(null);
  const [readmeHtml, setReadmeHtml] = useState("");

  // Filters & Sorting
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("name-asc");
  const [selectedTag, setSelectedTag] = useState("ALL");

  // Batch Selection, Running Indicators & Terminal Drawer State
  const [checkedRepos, setCheckedRepos] = useState(new Set());
  const [isDragSelecting, setIsDragSelecting] = useState(false);
  const dragTargetStateRef = useRef(null); // boolean: whether we are checking or unchecking
  const [cloneUrl, setCloneUrl] = useState("");
  const [activeOp, setActiveOp] = useState(null); // 'check' | 'pull' | 'clone' | null
  const [runningRepos, setRunningRepos] = useState(new Set()); // Repo names currently mid-command
  const [batchProgress, setBatchProgress] = useState(null); // { current, total, log }
  const [showTerminal, setShowTerminal] = useState(false);
  const [terminalLogs, setTerminalLogs] = useState([]);
  const [terminalDrawerHeight, setTerminalDrawerHeight] = useState(240); // default in px
  const isTerminalDraggingRef = useRef(false);
  const terminalStartYRef = useRef(0);
  const terminalStartHeightRef = useRef(0);
  const logIdRef = useRef(0);

  // Derived compatibility flag for Clone button
  const isCloning = activeOp === "clone";

  // Notes & Tags Editor State
  const [tagInput, setTagInput] = useState("");
  const [notesInput, setNotesInput] = useState("");
  const [showNotesPanel, setShowNotesPanel] = useState(false);
  const [activeTab, setActiveTab] = useState("readme"); // 'readme' | 'files'
  const [lightboxImage, setLightboxImage] = useState(null); // { src, alt } | null

  // Append a timestamped line to the Sync Terminal (keeps latest 500 lines)
  const appendLog = useCallback((level, message, repoName = null) => {
    const time = new Date().toLocaleTimeString([], {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    logIdRef.current += 1;
    const entry = {
      id: logIdRef.current,
      time,
      level,
      repoName,
      message,
    };
    setTerminalLogs((prev) => {
      const next = [...prev, entry];
      return next.length > 500 ? next.slice(next.length - 500) : next;
    });
  }, []);

  const clearTerminalLogs = useCallback(() => {
    setTerminalLogs([]);
  }, []);

  // Terminal Drawer Vertical Resize Handling (in-between gap handle)
  const handleTerminalMouseDown = useCallback((e) => {
    isTerminalDraggingRef.current = true;
    terminalStartYRef.current = e.clientY;
    terminalStartHeightRef.current = terminalDrawerHeight;
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'row-resize';

    const handleMouseMove = (moveEvent) => {
      if (!isTerminalDraggingRef.current) return;
      const delta = terminalStartYRef.current - moveEvent.clientY;
      const minHeight = 120;
      const maxHeight = window.innerHeight * 0.70;
      const newHeight = Math.min(maxHeight, Math.max(minHeight, terminalStartHeightRef.current + delta));
      setTerminalDrawerHeight(newHeight);
    };

    const handleMouseUp = () => {
      isTerminalDraggingRef.current = false;
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, [terminalDrawerHeight]);

  const handleTerminalKeyDown = (e) => {
    const minHeight = 120;
    const maxHeight = window.innerHeight * 0.70;
    const step = 24;

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setTerminalDrawerHeight((prev) => Math.min(maxHeight, prev + step));
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setTerminalDrawerHeight((prev) => Math.max(minHeight, prev - step));
    } else if (e.key === 'Home') {
      e.preventDefault();
      setTerminalDrawerHeight(minHeight);
    } else if (e.key === 'End') {
      e.preventDefault();
      setTerminalDrawerHeight(maxHeight);
    }
  };

  // Handle delegated image click on markdown-rendered content to open lightbox
  const handleReadmeClick = useCallback((e) => {
    const target = e.target;
    if (target && target.tagName === 'IMG') {
      e.preventDefault();
      setLightboxImage({
        src: target.currentSrc || target.src,
        alt: target.alt || '',
      });
    }
  }, []);

  const mapStatusToLogLevel = (status) => {
    switch (status) {
      case "updated":
        return "success";
      case "update-available":
        return "update";
      case "archived-offline":
      case "rate-limited":
      case "skipped-local-changes":
        return "warn";
      case "error":
      case "offline-error":
        return "error";
      default:
        return "info";
    }
  };

  // Load initial settings & repos on startup
  useEffect(() => {
    window.api.getInitialData().then(({ settings, repos: initialRepos }) => {
      setRootFolder(settings.rootFolder || "");
      setRepos(initialRepos || []);
      if (initialRepos && initialRepos.length > 0) {
        setSelectedRepoName(initialRepos[0].name);
      }
    });
  }, []);

  const selectedRepo = useMemo(
    () => repos.find((r) => r.name === selectedRepoName) || null,
    [repos, selectedRepoName],
  );

  // Load README and Repo Notes whenever selected repo changes
  useEffect(() => {
    if (!selectedRepo) {
      setReadmeHtml("");
      return;
    }
    setNotesInput(selectedRepo.notes || "");
    window.api
      .readReadme(selectedRepo.readmePath, selectedRepo.path)
      .then((md) => Promise.resolve(marked.parse(md || "")))
      .then((html) => setReadmeHtml(html));
  }, [selectedRepo]);

  // Collect all unique #tags across all repos
  const allTags = useMemo(() => {
    const set = new Set();
    repos.forEach((r) => (r.tags || []).forEach((t) => set.add(t)));
    return Array.from(set).sort();
  }, [repos]);

  // Filter and sort repositories
  const filteredRepos = useMemo(() => {
    return repos
      .filter((r) => {
        const matchesSearch =
          r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (r.notes || "").toLowerCase().includes(searchQuery.toLowerCase());
        const matchesTag =
          selectedTag === "ALL" || (r.tags || []).includes(selectedTag);
        return matchesSearch && matchesTag;
      })
      .sort((a, b) => {
        if (sortBy === "selected-first") {
          const aChecked = checkedRepos.has(a.name);
          const bChecked = checkedRepos.has(b.name);
          if (aChecked !== bChecked) return aChecked ? -1 : 1;
        }
        if (sortBy === "unselected-first") {
          const aChecked = checkedRepos.has(a.name);
          const bChecked = checkedRepos.has(b.name);
          if (aChecked !== bChecked) return aChecked ? 1 : -1;
        }
        if (sortBy === "updates-first") {
          const aUpdate = a.syncStatus === "update-available";
          const bUpdate = b.syncStatus === "update-available";
          if (aUpdate !== bUpdate) return aUpdate ? -1 : 1;
        }
        if (sortBy === "no-updates-first") {
          const aUpToDate = a.syncStatus === "up-to-date" || a.syncStatus === "updated";
          const bUpToDate = b.syncStatus === "up-to-date" || b.syncStatus === "updated";
          if (aUpToDate !== bUpToDate) return aUpToDate ? -1 : 1;
        }
        if (sortBy === "fav-first") {
          if (a.isFavorite !== b.isFavorite) return a.isFavorite ? -1 : 1;
        }
        if (sortBy === "modified-desc") return b.lastModified - a.lastModified;
        if (sortBy === "pulled-desc") {
          return (b.lastPulled || "").localeCompare(a.lastPulled || "");
        }
        return a.name.localeCompare(b.name);
      });
  }, [repos, searchQuery, sortBy, selectedTag, checkedRepos]);

  // --- ACTIONS ---

  const handleChooseFolder = async () => {
    const res = await window.api.selectRootFolder();
    if (res) {
      setRootFolder(res.settings.rootFolder);
      setRepos(res.repos);
      setCheckedRepos(new Set());
      if (res.repos.length > 0) setSelectedRepoName(res.repos[0].name);
      appendLog(
        "info",
        `Loaded root folder: ${res.settings.rootFolder} (${res.repos.length} items)`,
      );
    }
  };

  const handleRefreshRootFolder = async () => {
    if (!rootFolder) return;
    appendLog("info", "Rescanning repositories in root folder...");
    const res = await window.api.getInitialData();
    if (res && res.repos) {
      setRepos(res.repos);
      appendLog("success", `Refreshed root folder (${res.repos.length} repositories found).`);
    }
  };

  const handleToggleFavorite = async (repoName, e) => {
    e.stopPropagation();
    const res = await window.api.toggleFavorite(repoName);
    setRepos(res.repos);
  };

  const handleCloneRepo = async (e) => {
    e.preventDefault();
    const trimmedUrl = cloneUrl.trim();
    if (!trimmedUrl || activeOp) return;

    setActiveOp("clone");
    setShowTerminal(true);
    setBatchProgress({ current: 0, total: 1, log: `Cloning ${trimmedUrl}...` });
    appendLog("cmd", `git clone ${trimmedUrl}`);

    try {
      const res = await window.api.cloneRepo(trimmedUrl);
      setBatchProgress({ current: 1, total: 1, log: res.message });
      if (res.ok) {
        setCloneUrl("");
        setRepos(res.repos);
        appendLog("success", res.message);
      } else {
        appendLog("error", res.message || "Clone failed.");
      }
    } catch (err) {
      const msg = err?.message || "Unexpected error during clone.";
      setBatchProgress({ current: 1, total: 1, log: msg });
      appendLog("error", msg);
    } finally {
      setActiveOp(null);
    }
  };

  // Rate-Limit Aware 5-at-a-Time Parallel Batch Runner (Check Updates or Safe Pull)
  const runBatchOperation = async (targetRepos, mode = "pull") => {
    if (activeOp) return; // Prevent overlapping runs

    const gitRepos = targetRepos.filter((r) => r.isGitRepo);
    setShowTerminal(true);

    if (gitRepos.length === 0) {
      appendLog("warn", "No Git repositories found in the current selection.");
      return;
    }

    const CONCURRENCY = 5;
    let completed = 0;
    let updatedCount = 0;
    let updateAvailableCount = 0;
    let protectedCount = 0;
    let errorCount = 0;

    const actionLabel =
      mode === "pull" ? "Safe Fast-Forward Pull" : "Remote Update Check";
    setActiveOp(mode);
    setBatchProgress({
      current: 0,
      total: gitRepos.length,
      log: `Starting ${actionLabel} on ${gitRepos.length} repo(s)...`,
    });
    appendLog(
      "cmd",
      `${actionLabel} started for ${gitRepos.length} repository(s) [5 parallel, rate-limit safe]`,
    );

    try {
      for (let i = 0; i < gitRepos.length; i += CONCURRENCY) {
        const chunk = gitRepos.slice(i, i + CONCURRENCY);
        let hitRateLimit = false;

        // Mark current 5-repo chunk as actively running
        setRunningRepos((prev) => {
          const next = new Set(prev);
          chunk.forEach((r) => next.add(r.name));
          return next;
        });

        await Promise.all(
          chunk.map(async (repo) => {
            try {
              const response =
                mode === "pull"
                  ? await window.api.pullSingleRepo(repo)
                  : await window.api.checkSingleRepo(repo);

              completed += 1;
              const status = response?.result?.status || "unknown";
              const message = response?.result?.message || "Done";

              if (status === "rate-limited") hitRateLimit = true;
              if (status === "updated") updatedCount += 1;
              if (status === "update-available") updateAvailableCount += 1;
              if (status === "archived-offline") protectedCount += 1;
              if (status === "error" || status === "offline-error")
                errorCount += 1;

              if (response?.repos) {
                setRepos(response.repos);
              }

              setBatchProgress({
                current: completed,
                total: gitRepos.length,
                log: `[${repo.name}] → ${message}`,
              });
              appendLog(mapStatusToLogLevel(status), message, repo.name);
            } catch (err) {
              completed += 1;
              errorCount += 1;
              const errMsg = err?.message || "IPC command failed";
              setBatchProgress({
                current: completed,
                total: gitRepos.length,
                log: `[${repo.name}] → Error: ${errMsg}`,
              });
              appendLog("error", errMsg, repo.name);
            } finally {
              // Clear spinner for this individual repo as soon as it finishes
              setRunningRepos((prev) => {
                const next = new Set(prev);
                next.delete(repo.name);
                return next;
              });
            }
          }),
        );

        // Cooldown between batches of 5
        if (i + CONCURRENCY < gitRepos.length) {
          if (hitRateLimit) {
            const cooldownMsg =
              "GitHub rate limit detected — cooling down for 10 seconds...";
            setBatchProgress({
              current: completed,
              total: gitRepos.length,
              log: cooldownMsg,
            });
            appendLog("warn", cooldownMsg);
            await sleep(10000);
          } else {
            await sleep(1500);
          }
        }
      }

      const summaryParts = [`Processed ${gitRepos.length} repo(s)`];
      if (mode === "pull" && updatedCount > 0)
        summaryParts.push(`${updatedCount} updated`);
      if (mode === "check" && updateAvailableCount > 0) {
        summaryParts.push(`${updateAvailableCount} have updates available`);
      }
      if (protectedCount > 0)
        summaryParts.push(`${protectedCount} protected locally`);
      if (errorCount > 0) summaryParts.push(`${errorCount} had errors`);

      const summaryText = `Completed! ${summaryParts.join(" · ")}.`;
      setBatchProgress({
        current: gitRepos.length,
        total: gitRepos.length,
        log: summaryText,
      });
      appendLog("success", summaryText);
    } finally {
      setRunningRepos(new Set());
      setActiveOp(null);
    }
  };

  const handleSaveNotesAndTags = async (newTags, newNotes) => {
    if (!selectedRepo) return;
    const res = await window.api.saveRepoMeta(
      selectedRepo.name,
      newTags,
      newNotes,
    );
    setRepos(res.repos);
  };

  const handleAddTag = (e) => {
    e.preventDefault();
    if (!tagInput.trim() || !selectedRepo) return;
    const clean = tagInput.trim().replace(/^#/, "").toLowerCase();
    const updatedTags = Array.from(
      new Set([...(selectedRepo.tags || []), clean]),
    );
    setTagInput("");
    handleSaveNotesAndTags(updatedTags, notesInput);
  };

  const handleRemoveTag = (tagToRemove) => {
    if (!selectedRepo) return;
    const updatedTags = (selectedRepo.tags || []).filter(
      (t) => t !== tagToRemove,
    );
    handleSaveNotesAndTags(updatedTags, notesInput);
  };

  const handleDeleteRepo = async (repo) => {
    const confirmed = window.confirm(
      `Move "${repo.name}" to the Windows Recycle Bin?\n(You can restore it from the Recycle Bin anytime.)`,
    );
    if (!confirmed) return;
    const res = await window.api.deleteRepoToTrash(repo.path);
    setRepos(res.repos);
    setCheckedRepos((prev) => {
      if (!prev.has(repo.name)) return prev;
      const next = new Set(prev);
      next.delete(repo.name);
      return next;
    });
    if (selectedRepoName === repo.name) {
      setSelectedRepoName(res.repos[0]?.name || null);
    }
    appendLog("warn", "Moved repository folder to Recycle Bin.", repo.name);
  };

  const toggleCheckRepo = (repoName, e) => {
    e.stopPropagation();
    const next = new Set(checkedRepos);
    if (next.has(repoName)) next.delete(repoName);
    else next.add(repoName);
    setCheckedRepos(next);
  };

  // Drag-select helpers for multi-checkbox selection
  const handleCheckboxMouseDown = (repoName, e) => {
    if (Boolean(activeOp)) return;
    e.stopPropagation();
    // Invert the clicked checkbox state and make that the target state for dragged items
    const willBeChecked = !checkedRepos.has(repoName);
    dragTargetStateRef.current = willBeChecked;
    setIsDragSelecting(true);

    setCheckedRepos((prev) => {
      const next = new Set(prev);
      if (willBeChecked) next.add(repoName);
      else next.delete(repoName);
      return next;
    });
  };

  const handleCheckboxMouseEnter = (repoName) => {
    if (!isDragSelecting || dragTargetStateRef.current === null) return;
    setCheckedRepos((prev) => {
      const next = new Set(prev);
      if (dragTargetStateRef.current) next.add(repoName);
      else next.delete(repoName);
      return next;
    });
  };

  // Global mouseup listener to end drag-select
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isDragSelecting) {
        setIsDragSelecting(false);
        dragTargetStateRef.current = null;
      }
    };
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, [isDragSelecting]);

  // Status Badge Helper (safely accepts either a boolean or a repoName string)
  const renderStatusBadge = (status, repoOrRunning = false) => {
    const isRepoRunning =
      Boolean(activeOp) &&
      (typeof repoOrRunning === 'string'
        ? runningRepos.has(repoOrRunning)
        : Boolean(repoOrRunning));

    if (isRepoRunning) {
      return (
        <span className="text-xs px-2 py-0.5 rounded bg-[#1E3A47] text-[#48A0C7] border border-[#3994BC]/60 flex items-center gap-1.5">
          <Loader2 className="w-3 h-3 animate-spin" />
          {activeOp === 'check' ? 'Checking...' : 'Pulling...'}
        </span>
      );
    }

    switch (status) {
      case "updated":
        return (
          <span className="text-xs px-2 py-0.5 rounded bg-emerald-900/60 text-emerald-300 border border-emerald-700">
            Updated ✓
          </span>
        );
      case "up-to-date":
        return (
          <span className="text-xs px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
            Up to date
          </span>
        );
      case "update-available":
        return (
          <span className="text-xs px-2 py-0.5 rounded bg-blue-900/60 text-blue-300 border border-blue-700">
            ● Update Available
          </span>
        );
      case "archived-offline":
        return (
          <span className="text-xs px-2 py-0.5 rounded bg-amber-900/60 text-amber-300 border border-amber-700 flex items-center gap-1">
            <ShieldAlert className="w-3 h-3" /> Archived Locally (Protected)
          </span>
        );
      case "non-git":
        return (
          <span className="text-xs px-2 py-0.5 rounded bg-zinc-800 text-zinc-400">
            Plain Folder
          </span>
        );
      default:
        return null;
    }
  };

  // === PART 2.3 STARTS RIGHT BELOW THIS COMMENT (AT `return (`) ===

  return (
    <div className="flex flex-col h-screen w-screen bg-[#121314] text-[#bfbfbf] select-none overflow-hidden">
      {/* NATIVE INTEGRATED TITLEBAR: 38px height, titleBarOverlay with Windows native caption controls */}
      <header
        style={{ WebkitAppRegion: 'drag' }}
        className="h-[38px] bg-[#191A1B] border-b border-[#2A2B2C] pl-3 pr-[140px] flex items-center justify-between gap-4 shrink-0 select-none z-50"
      >
        {/* Left Section: Branding & Root Folder Picker */}
        <div style={{ WebkitAppRegion: 'no-drag' }} className="flex items-center gap-2.5 shrink-0">
          <div className="flex items-center gap-2 font-bold text-xs text-[#ededed] tracking-wide">
            <Sparkles className="w-4 h-4 text-[#48A0C7]" />
            <span>GitCairn</span>
          </div>
          <button
            onClick={handleChooseFolder}
            disabled={Boolean(activeOp)}
            aria-label="Select root folder containing GitHub repositories"
            title="Choose OSSGitHub root folder"
            className="flex items-center gap-1.5 text-xs bg-[#242526] hover:bg-[#333536] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#3994BC] disabled:opacity-50 disabled:cursor-not-allowed text-[#ededed] px-2.5 py-1 rounded border border-[#2A2B2C] transition"
          >
            <FolderOpen className="w-3.5 h-3.5 text-[#48A0C7]" />
            <span className="truncate max-w-[200px]">
              {rootFolder || "Select OSSGitHub Folder..."}
            </span>
          </button>
          <button
            onClick={handleRefreshRootFolder}
            disabled={Boolean(activeOp) || !rootFolder}
            aria-label="Refresh repository list from root folder"
            title="Rescan root folder"
            className="p-1.5 text-[#8C8C8C] hover:text-[#ededed] hover:bg-[#242526] disabled:opacity-40 rounded border border-transparent hover:border-[#2A2B2C] transition shrink-0"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          <span className="text-[11px] text-[#8C8C8C] bg-[#121314] px-2 py-0.5 rounded border border-[#2A2B2C]">
            {repos.length} Repos
          </span>
        </div>

        {/* Center: Command Center Clone Input (VS Code Style) */}
        <form
          onSubmit={handleCloneRepo}
          style={{ WebkitAppRegion: 'no-drag' }}
          className="flex items-center gap-1.5 flex-1 max-w-sm mx-auto"
        >
          <input
            type="text"
            value={cloneUrl}
            onChange={(e) => setCloneUrl(e.target.value)}
            disabled={Boolean(activeOp)}
            placeholder="Paste public GitHub URL to clone..."
            className="w-full bg-[#121314] text-xs text-[#ededed] px-2.5 py-1 rounded border border-[#2A2B2C] focus:outline-none focus:border-[#3994BC] disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={Boolean(activeOp) || !cloneUrl.trim()}
            aria-label="Clone repository from entered URL"
            title="Clone repository"
            className="flex items-center gap-1.5 bg-[#297AA0] hover:bg-[#2B7DA3] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#3994BC] disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-medium px-2.5 py-1 rounded transition shrink-0"
          >
            {activeOp === "clone" ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Download className="w-3 h-3" />
            )}
            <span>Clone</span>
          </button>
        </form>

        {/* Right Actions: Check & Pull Controls (Native Caption buttons sit to the right in the 140px pr reservation) */}
        <div style={{ WebkitAppRegion: 'no-drag' }} className="flex items-center gap-2 shrink-0">
          <button
            onClick={() =>
              runBatchOperation(
                checkedRepos.size > 0
                  ? repos.filter((r) => checkedRepos.has(r.name))
                  : repos,
                "check",
              )
            }
            disabled={Boolean(activeOp) || repos.length === 0}
            aria-label={
              activeOp === "check" && batchProgress
                ? `Checking repositories (${batchProgress.current} of ${batchProgress.total})`
                : `Check ${checkedRepos.size > 0 ? `${checkedRepos.size} selected repositories` : "all repositories"} for updates`
            }
            title="Check GitHub for updates"
            className={`flex items-center gap-1 text-[11px] px-2 py-1 rounded border transition focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#3994BC] disabled:cursor-not-allowed ${
              activeOp === "check"
                ? "bg-[#1E3A47] border-[#3994BC] text-[#48A0C7]"
                : "bg-[#242526] hover:bg-[#333536] text-[#ededed] border-[#2A2B2C] disabled:opacity-50"
            }`}
          >
            {activeOp === "check" && (
              <Loader2 className="w-3 h-3 animate-spin text-[#48A0C7]" />
            )}
            <span>
              {activeOp === "check" && batchProgress
                ? `Checking (${batchProgress.current}/${batchProgress.total})...`
                : `Check ${checkedRepos.size > 0 ? `(${checkedRepos.size})` : "(All)"}`}
            </span>
          </button>

          <button
            onClick={() =>
              runBatchOperation(
                checkedRepos.size > 0
                  ? repos.filter((r) => checkedRepos.has(r.name))
                  : repos,
                "pull",
              )
            }
            disabled={Boolean(activeOp) || repos.length === 0}
            aria-label={
              activeOp === "pull" && batchProgress
                ? `Pulling repositories (${batchProgress.current} of ${batchProgress.total})`
                : `Pull ${checkedRepos.size > 0 ? `${checkedRepos.size} selected repositories` : "all repositories"}`
            }
            title="Pull latest changes from GitHub"
            className={`flex items-center gap-1 text-[11px] text-white font-medium px-2.5 py-1 rounded transition focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-400 disabled:cursor-not-allowed ${
              activeOp === "pull"
                ? "bg-emerald-700 ring-1 ring-emerald-400"
                : "bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50"
            }`}
          >
            <RefreshCw
              className={`w-3 h-3 ${activeOp === "pull" ? "animate-spin" : ""}`}
            />
            <span>
              {activeOp === "pull" && batchProgress
                ? `Pulling (${batchProgress.current}/${batchProgress.total})...`
                : `Pull ${checkedRepos.size > 0 ? `(${checkedRepos.size})` : `All`}`}
            </span>
          </button>
        </div>
      </header>

      {/* MAIN WORKSPACE: Floating Island Cards with Outer Padding and Gap */}
      <div className="flex-1 flex flex-col p-2 gap-2 overflow-hidden min-h-0 bg-[#121314]">
        <div className="flex flex-1 gap-2 overflow-hidden min-h-0">
          {/* LEFT SIDEBAR: Rounded Island Panel */}
          <aside className="w-80 bg-[#191A1B] border border-[#2A2B2C] rounded-lg flex flex-col shrink-0 overflow-hidden shadow-sm">
            {/* Search & Sort Controls */}
            <div className="p-3 space-y-2 border-b border-[#2A2B2C]">
              <div className="relative">
                <Search className="w-4 h-4 text-[#8C8C8C] absolute left-2.5 top-2" />
                <input
                  type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search repos or notes..."
                className="w-full bg-[#121314] text-xs text-[#ededed] pl-8 pr-3 py-1.5 rounded border border-[#2A2B2C] focus:outline-none focus:border-[#3994BC]"
              />
            </div>

            <div className="flex items-center justify-between gap-2">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="bg-[#121314] text-xs text-[#bfbfbf] px-2 py-1 rounded border border-[#2A2B2C] flex-1 focus:outline-none"
              >
                <option value="name-asc">Sort: Name (A–Z)</option>
                <option value="selected-first">Sort: Selected First ☑</option>
                <option value="unselected-first">Sort: Unselected First ☐</option>
                <option value="updates-first">Sort: Updates Available First ●</option>
                <option value="no-updates-first">Sort: Up-to-Date First ✓</option>
                <option value="fav-first">Sort: Favorites First ★</option>
                <option value="modified-desc">Sort: Recently Modified</option>
                <option value="pulled-desc">Sort: Recently Pulled</option>
              </select>

              <div className="flex items-center gap-2 shrink-0">
                {filteredRepos.length > 0 &&
                  checkedRepos.size < filteredRepos.length && (
                    <button
                      onClick={() =>
                        setCheckedRepos(
                          new Set(filteredRepos.map((r) => r.name)),
                        )
                      }
                      disabled={Boolean(activeOp)}
                      className="text-[11px] text-[#8C8C8C] hover:text-[#48A0C7] disabled:opacity-50"
                      title="Select all visible repositories"
                    >
                      Select All
                    </button>
                  )}
                {checkedRepos.size > 0 && (
                  <button
                    onClick={() => setCheckedRepos(new Set())}
                    disabled={Boolean(activeOp)}
                    className="text-[11px] text-[#48A0C7] hover:underline disabled:opacity-50"
                  >
                    Clear ({checkedRepos.size})
                  </button>
                )}
              </div>
            </div>

            {/* Tag Filter Pills */}
            {allTags.length > 0 && (
              <div className="flex items-center gap-1 overflow-x-auto pt-1 pb-0.5">
                <button
                  onClick={() => setSelectedTag("ALL")}
                  className={`text-[11px] px-2 py-0.5 rounded-full shrink-0 transition ${
                    selectedTag === "ALL"
                      ? "bg-[#297AA0] text-white"
                      : "bg-[#121314] text-[#8C8C8C] hover:text-[#ededed]"
                  }`}
                >
                  All
                </button>
                {allTags.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => setSelectedTag(tag)}
                    className={`text-[11px] px-2 py-0.5 rounded-full shrink-0 transition ${
                      selectedTag === tag
                        ? "bg-[#297AA0] text-white"
                        : "bg-[#121314] text-[#8C8C8C] hover:text-[#ededed]"
                    }`}
                  >
                    #{tag}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Repo List */}
          <div className="flex-1 overflow-y-auto divide-y divide-[#2A2B2C]">
            {filteredRepos.length === 0 ? (
              <div className="p-6 text-center text-xs text-[#555555]">
                {repos.length === 0
                  ? "No repositories loaded yet. Choose a root folder above to get started."
                  : "No repositories match your current search or tag filter."}
              </div>
            ) : (
              filteredRepos.map((repo) => {
                const isSelected = repo.name === selectedRepoName;
                const isChecked = checkedRepos.has(repo.name);
                const isRunning = runningRepos.has(repo.name);

                return (
                  <div
                    key={repo.name}
                    onClick={() => setSelectedRepoName(repo.name)}
                    className={`px-3 py-2.5 flex items-center justify-between gap-2 cursor-pointer transition border-l-2 ${
                      isRunning
                        ? "bg-[#1E3A47]/40 border-l-[#48A0C7] text-white"
                        : isSelected
                          ? "bg-[#242526] border-l-[#3994BC] text-white"
                          : "border-l-transparent hover:bg-white/[0.04]"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <button
                        onClick={(e) => toggleCheckRepo(repo.name, e)}
                        onMouseDown={(e) => handleCheckboxMouseDown(repo.name, e)}
                        onMouseEnter={() => handleCheckboxMouseEnter(repo.name)}
                        disabled={Boolean(activeOp)}
                        aria-label={`${isChecked ? "Deselect" : "Select"} repository ${repo.name}`}
                        title="Click or drag across checkboxes to multi-select"
                        className="text-[#8C8C8C] hover:text-[#ededed] disabled:opacity-50 shrink-0 p-0.5 rounded focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#3994BC]"
                      >
                        {isChecked ? (
                          <CheckSquare className="w-4 h-4 text-[#48A0C7]" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>

                      <div className="truncate">
                        <div className="text-sm font-medium truncate flex items-center gap-1.5">
                          <span className="truncate">{repo.name}</span>

                          {isRunning ? (
                            <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-[#1E3A47] text-[#48A0C7] border border-[#3994BC]/60 shrink-0">
                              <Loader2 className="w-3 h-3 animate-spin text-[#48A0C7]" />
                              {activeOp === "check" ? "Checking" : "Pulling"}
                            </span>
                          ) : (
                            <>
                              {repo.syncStatus === "update-available" && (
                                <span
                                  className="w-2 h-2 rounded-full bg-blue-400 shrink-0"
                                  title="Update available on GitHub"
                                />
                              )}
                              {repo.syncStatus === "updated" && (
                                <span
                                  className="w-2 h-2 rounded-full bg-emerald-400 shrink-0"
                                  title="Recently updated"
                                />
                              )}
                              {repo.syncStatus === "archived-offline" && (
                                <ShieldAlert
                                  className="w-3.5 h-3.5 text-amber-400 shrink-0"
                                  title="Archived Locally (Protected)"
                                />
                              )}
                            </>
                          )}
                        </div>

                        {repo.tags?.length > 0 && (
                          <div className="flex gap-1 mt-0.5 overflow-hidden">
                            {repo.tags.map((t) => (
                              <span
                                key={t}
                                className="text-[10px] text-[#48A0C7] bg-[#1E3A47]/60 px-1.5 rounded shrink-0"
                              >
                                #{t}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={(e) => handleToggleFavorite(repo.name, e)}
                      className="text-[#8C8C8C] hover:text-amber-400 shrink-0"
                      title={
                        repo.isFavorite
                          ? "Remove from favorites"
                          : "Add to favorites"
                      }
                    >
                      <Star
                        className={`w-4 h-4 ${
                          repo.isFavorite ? "fill-amber-400 text-amber-400" : ""
                        }`}
                      />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </aside>

        {/* RIGHT CONTENT AREA: Rounded Island Panel */}
        <main className="flex-1 flex flex-col overflow-hidden bg-[#121314] rounded-lg border border-[#2A2B2C] shadow-sm">
          {selectedRepo ? (
            <>
              {/* Repo Header */}
              <div className="p-4 bg-[#191A1B] border-b border-[#2A2B2C] flex flex-wrap items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h1 className="text-xl font-bold text-[#ededed] truncate">
                      {selectedRepo.name}
                    </h1>
                    {renderStatusBadge(
                      selectedRepo.syncStatus,
                      runningRepos.has(selectedRepo.name)
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-[#8C8C8C] flex-wrap">
                    <span className="select-text truncate max-w-xl">
                      {selectedRepo.remoteUrl}
                    </span>
                    {selectedRepo.lastPulled && (
                      <span className="text-[#555555]">
                        • Last pulled: {new Date(selectedRepo.lastPulled).toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {/* View Mode Switcher: README vs Files vs History */}
                  <div className="flex items-center bg-[#121314] p-0.5 rounded border border-[#2A2B2C] mr-1">
                    <button
                      onClick={() => setActiveTab('readme')}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition ${
                        activeTab === 'readme'
                          ? 'bg-[#297AA0] text-white'
                          : 'text-[#8C8C8C] hover:text-[#ededed]'
                      }`}
                    >
                      <BookOpen className="w-3.5 h-3.5" /> README
                    </button>
                    <button
                      onClick={() => setActiveTab('files')}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition ${
                        activeTab === 'files'
                          ? 'bg-[#297AA0] text-white'
                          : 'text-[#8C8C8C] hover:text-[#ededed]'
                      }`}
                    >
                      <FolderTree className="w-3.5 h-3.5" /> Files
                    </button>
                    <button
                      onClick={() => setActiveTab('history')}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition ${
                        activeTab === 'history'
                          ? 'bg-[#297AA0] text-white'
                          : 'text-[#8C8C8C] hover:text-[#ededed]'
                      }`}
                    >
                      <History className="w-3.5 h-3.5" />
                      <span>History</span>
                      {selectedRepo.history?.length > 0 && (
                        <span
                          className={`text-[10px] px-1.5 rounded-full ${
                            activeTab === 'history'
                              ? 'bg-[#1E3A47] text-[#48A0C7]'
                              : 'bg-[#242526] text-[#8C8C8C]'
                          }`}
                        >
                          {selectedRepo.history.length}
                        </span>
                      )}
                    </button>
                  </div>

                  {/* Single Repo Action Buttons */}
                  {selectedRepo.isGitRepo && (
                    <>
                      <button
                        onClick={() => runBatchOperation([selectedRepo], 'check')}
                        disabled={Boolean(activeOp)}
                        className="flex items-center gap-1.5 text-xs bg-[#242526] hover:bg-[#333536] disabled:opacity-50 text-[#ededed] px-3 py-1.5 rounded border border-[#2A2B2C] transition"
                        title="Check if remote has new commits without pulling"
                      >
                        {runningRepos.has(selectedRepo.name) && activeOp === 'check' ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-[#48A0C7]" />
                            Checking...
                          </>
                        ) : (
                          <>
                            <ArrowUpCircle className="w-3.5 h-3.5 text-[#48A0C7]" />
                            Check
                          </>
                        )}
                      </button>

                      <button
                        onClick={() => runBatchOperation([selectedRepo], 'pull')}
                        disabled={Boolean(activeOp)}
                        className="flex items-center gap-1.5 text-xs bg-[#297AA0] hover:bg-[#2B7DA3] disabled:opacity-50 text-white px-3 py-1.5 rounded transition"
                      >
                        {runningRepos.has(selectedRepo.name) && activeOp === 'pull' ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            Pulling...
                          </>
                        ) : (
                          <>
                            <RefreshCw className="w-3.5 h-3.5" />
                            Pull Latest
                          </>
                        )}
                      </button>
                    </>
                  )}

                  <button
                    onClick={() => setShowNotesPanel(!showNotesPanel)}
                    className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded border transition ${
                      showNotesPanel
                        ? 'bg-[#1E3A47] border-[#3994BC] text-[#48A0C7]'
                        : 'bg-[#242526] border-[#2A2B2C] hover:bg-[#333536] text-[#bfbfbf]'
                    }`}
                  >
                    <StickyNote className="w-3.5 h-3.5" />
                    Notes & Tags
                  </button>

                  <button
                    onClick={() => window.api.openInExplorer(selectedRepo.path)}
                    className="flex items-center gap-1.5 text-xs bg-[#242526] hover:bg-[#333536] text-[#ededed] px-3 py-1.5 rounded border border-[#2A2B2C] transition"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Explorer
                  </button>

                  {/* Open in Browser button if repo has an online remote URL */}
                  {selectedRepo.isGitRepo &&
                    selectedRepo.remoteUrl &&
                    selectedRepo.remoteUrl.startsWith('http') && (
                      <button
                        onClick={() => {
                          const cleanUrl = selectedRepo.remoteUrl.replace(/\.git$/, '');
                          window.open(cleanUrl, '_blank');
                        }}
                        className="flex items-center gap-1.5 text-xs bg-[#242526] hover:bg-[#333536] text-[#ededed] px-3 py-1.5 rounded border border-[#2A2B2C] transition"
                        title="Open GitHub repo in web browser"
                      >
                        <ExternalLink className="w-3.5 h-3.5 text-[#48A0C7]" />
                        GitHub
                      </button>
                    )}

                  <button
                    onClick={() => window.api.openInVSCode(selectedRepo.path)}
                    className="flex items-center gap-1.5 text-xs bg-[#242526] hover:bg-[#333536] text-[#ededed] px-3 py-1.5 rounded border border-[#2A2B2C] transition"
                  >
                    <Code2 className="w-3.5 h-3.5 text-[#48A0C7]" />
                    VS Code
                  </button>

                  <button
                    onClick={() => handleDeleteRepo(selectedRepo)}
                    disabled={Boolean(activeOp)}
                    className="flex items-center gap-1.5 text-xs bg-red-950/50 hover:bg-red-900/70 disabled:opacity-50 text-red-300 px-2.5 py-1.5 rounded border border-red-800/60 transition"
                    title="Move to Windows Recycle Bin"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Collapsible Obsidian-Style Tags & Personal Notes Box */}
              {showNotesPanel && (
                <div className="p-4 bg-[#191A1B] border-b border-[#2A2B2C] space-y-3 animate-tab-switch">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Tag className="w-4 h-4 text-[#48A0C7]" />
                    {(selectedRepo.tags || []).map((t) => (
                      <span
                        key={t}
                        className="text-xs bg-[#1E3A47] text-[#48A0C7] px-2 py-0.5 rounded border border-[#3994BC]/60 flex items-center gap-1"
                      >
                        #{t}
                        <button
                          onClick={() => handleRemoveTag(t)}
                          className="hover:text-white ml-1"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                    <form onSubmit={handleAddTag} className="flex items-center gap-1">
                      <input
                        type="text"
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value)}
                        placeholder="+ Add tag (press Enter)"
                        className="bg-[#121314] text-xs text-[#ededed] px-2 py-1 rounded border border-[#2A2B2C] focus:outline-none focus:border-[#3994BC]"
                      />
                    </form>
                  </div>

                  <div>
                    <textarea
                      rows={3}
                      value={notesInput}
                      onChange={(e) => setNotesInput(e.target.value)}
                      onBlur={() => handleSaveNotesAndTags(selectedRepo.tags || [], notesInput)}
                      placeholder="Write private notes about this repo (e.g., why you downloaded it, setup commands)... Automatically saves when you click outside."
                      className="w-full bg-[#121314] text-xs text-[#bfbfbf] p-2.5 rounded border border-[#2A2B2C] focus:outline-none focus:border-[#3994BC] select-text"
                    />
                  </div>
                </div>
              )}

                            {/* Main Body: File Browser, History Timeline, OR README.md Viewer */}
              {activeTab === 'files' ? (
                <div key="tab-files" className="flex-1 overflow-hidden animate-tab-switch">
                  <FileBrowser repoPath={selectedRepo.path} />
                </div>
              ) : activeTab === 'history' ? (
                <div key="tab-history" className="flex-1 overflow-hidden animate-tab-switch">
                  <RepoHistory
                    repo={selectedRepo}
                    onReposUpdated={setRepos}
                  />
                </div>
              ) : (
                <div
                  key="tab-readme"
                  className="flex-1 overflow-y-auto px-10 py-8 select-text animate-tab-switch"
                  onClick={handleReadmeClick}
                >
                  <div
                    className="markdown-body max-w-4xl mx-auto"
                    dangerouslySetInnerHTML={{ __html: readmeHtml }}
                  />
                </div>
              )}

            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-zinc-500 text-sm">
              Select a repository on the left or choose your OSSGitHub folder to begin.
            </div>
          )}
        </main>
      </div>

      {/* COLLAPSIBLE & DRAGGABLE SYNC TERMINAL DRAWER (Inside workspace flow with gap) */}
      {showTerminal && (
        <>
          {/* Subtle resize trigger in the exact 8px gap */}
          <div
            role="separator"
            aria-orientation="horizontal"
            aria-label="Resize terminal panel"
            aria-valuenow={Math.round(terminalDrawerHeight)}
            aria-valuemin={120}
            aria-valuemax={Math.round(typeof window !== 'undefined' ? window.innerHeight * 0.7 : 600)}
            tabIndex={0}
            onKeyDown={handleTerminalKeyDown}
            onMouseDown={handleTerminalMouseDown}
            className="h-2 w-full my-[-4px] flex items-center justify-center cursor-row-resize z-20 group"
            title="Drag or use Up/Down arrow keys to resize terminal"
          >
            <div className="w-12 h-0.5 bg-[#2A2B2C] group-hover:bg-[#48A0C7] group-focus-visible:bg-[#48A0C7] rounded-full transition-colors" />
          </div>

          <TerminalDrawer
            isOpen={showTerminal}
            logs={terminalLogs}
            activeOp={activeOp}
            batchProgress={batchProgress}
            currentRepoPath={selectedRepo ? selectedRepo.path : rootFolder}
            drawerHeight={terminalDrawerHeight}
            onClear={clearTerminalLogs}
            onClose={() => setShowTerminal(false)}
          />
        </>
      )}

      {/* FULL-SCREEN IMAGE LIGHTBOX MODAL */}
      {lightboxImage && (
        <ImageLightbox
          src={lightboxImage.src}
          alt={lightboxImage.alt}
          onClose={() => setLightboxImage(null)}
        />
      )}
    </div>

    {/* BOTTOM STATUS & LIVE PROGRESS BAR */}
    <footer
        className={`h-8 text-[#ededed] text-xs px-4 flex items-center justify-between gap-4 shrink-0 transition-colors ${
          activeOp === "pull"
            ? "bg-emerald-700"
            : activeOp === "check" || activeOp === "clone"
              ? "bg-[#297AA0]"
              : "bg-[#191A1B] border-t border-[#2A2B2C]"
        }`}
      >
        {/* Left: Live Spinner / Ready Icon + Latest Status Message */}
        <div className="flex items-center gap-2 min-w-0">
          {activeOp ? (
            <Loader2 className="w-3.5 h-3.5 shrink-0 animate-spin text-[#48A0C7]" />
          ) : (
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-[#48A0C7]" />
          )}
          <span className="truncate">
            {batchProgress
              ? `${batchProgress.log} (${batchProgress.current}/${batchProgress.total})`
              : "Ready — Local repositories protected"}
          </span>
          {activeOp && runningRepos.size > 0 && (
            <span className="text-[10px] bg-black/40 px-2 py-0.5 rounded-full shrink-0 text-[#48A0C7] border border-[#3994BC]/30">
              {runningRepos.size} active
            </span>
          )}
        </div>

        {/* Right: Batch Info + Quick Show/Hide Sync Terminal Toggle */}
        <div className="flex items-center gap-3 shrink-0">
          <span className="hidden sm:inline text-[11px] text-[#8C8C8C]">
            Parallel Batch: 5 repos | Cooldown: 1.5s
          </span>

          <button
            onClick={() => setShowTerminal((prev) => !prev)}
            className="flex items-center gap-1.5 text-[11px] font-medium bg-[#242526] hover:bg-[#333536] text-[#ededed] border border-[#2A2B2C] px-2.5 py-0.5 rounded transition"
            title={showTerminal ? "Hide Sync Terminal" : "Show Sync Terminal"}
          >
            <Terminal className="w-3 h-3 text-[#48A0C7]" />
            <span>{showTerminal ? "Hide Terminal" : "Show Terminal"}</span>
            {terminalLogs.length > 0 && (
              <span className="text-[10px] bg-[#121314] px-1.5 rounded-full text-[#8C8C8C]">
                {terminalLogs.length}
              </span>
            )}
            {showTerminal ? (
              <ChevronDown className="w-3 h-3 text-[#8C8C8C]" />
            ) : (
              <ChevronUp className="w-3 h-3 text-[#8C8C8C]" />
            )}
          </button>
        </div>
      </footer>

    </div>
  );
}