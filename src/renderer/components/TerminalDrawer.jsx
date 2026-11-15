// src/renderer/components/TerminalDrawer.jsx
import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Terminal,
  ChevronDown,
  Trash2,
  Loader2,
  CheckCircle2,
  Columns2,
  Plus,
  X,
  Code2,
  ListFilter,
  Play,
  RotateCw,
} from 'lucide-react';

// Single Real Shell Instance Pane
function ShellInstanceView({ shellInstance, isActive, onSelect, onClose, onSplit, showSplitBtn = true }) {
  const [output, setOutput] = useState([]);
  const [currentInput, setCurrentInput] = useState('');
  const [history, setHistory] = useState([]);
  const [historyIdx, setHistoryIdx] = useState(-1);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  // Subscribe to electron shell events
  useEffect(() => {
    if (!window.api || !window.api.onShellData) return;

    const unsubData = window.api.onShellData(shellInstance.id, (chunk) => {
      setOutput((prev) => {
        const next = [...prev, chunk];
        return next.length > 3000 ? next.slice(next.length - 3000) : next;
      });
    });

    const unsubExit = window.api.onShellExit(shellInstance.id, (code) => {
      setOutput((prev) => [...prev, `\r\n[Process exited with code ${code}]\r\n`]);
    });

    return () => {
      unsubData();
      unsubExit();
    };
  }, [shellInstance.id]);

  // Scroll to bottom on new output
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [output]);

  // Focus input on activate
  useEffect(() => {
    if (isActive && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isActive]);

  const handleSendInput = (e) => {
    e.preventDefault();
    if (!window.api || !window.api.shellInput) return;
    const commandToSend = currentInput;
    window.api.shellInput({ shellId: shellInstance.id, input: commandToSend + '\r\n' });
    if (commandToSend.trim()) {
      setHistory((prev) => [...prev, commandToSend]);
      setHistoryIdx(-1);
    }
    setCurrentInput('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (history.length === 0) return;
      const nextIdx = historyIdx === -1 ? history.length - 1 : Math.max(0, historyIdx - 1);
      setHistoryIdx(nextIdx);
      setCurrentInput(history[nextIdx] || '');
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIdx === -1) return;
      const nextIdx = historyIdx + 1;
      if (nextIdx >= history.length) {
        setHistoryIdx(-1);
        setCurrentInput('');
      } else {
        setHistoryIdx(nextIdx);
        setCurrentInput(history[nextIdx] || '');
      }
    }
  };

  return (
    <div
      onClick={onSelect}
      className={`flex-1 flex flex-col min-w-0 bg-[#121314] overflow-hidden ${
        isActive ? 'ring-1 ring-[#3994BC]/50' : 'opacity-85'
      }`}
    >
      {/* Mini Header per split terminal */}
      <div className="h-7 bg-[#191A1B] border-b border-[#2A2B2C] px-3 flex items-center justify-between text-[11px] shrink-0 select-none">
        <div className="flex items-center gap-1.5 truncate">
          <Terminal className="w-3 h-3 text-[#48A0C7]" />
          <span className="font-mono text-[#ededed] font-medium truncate">{shellInstance.title}</span>
          <span className="text-[#8C8C8C] truncate max-w-[200px]">({shellInstance.cwd})</span>
        </div>
        <div className="flex items-center gap-1">
          {showSplitBtn && onSplit && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSplit(shellInstance);
              }}
              className="p-1 text-[#8C8C8C] hover:text-[#ededed] hover:bg-white/[0.08] rounded transition"
              title="Split Terminal (Ctrl+Shift+5)"
              aria-label="Split terminal"
            >
              <Columns2 className="w-3 h-3" />
            </button>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClose(shellInstance.id);
            }}
            className="p-1 text-[#8C8C8C] hover:text-red-400 hover:bg-white/[0.08] rounded transition"
            title="Kill Terminal"
            aria-label="Close terminal instance"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Output Stream */}
      <div
        ref={scrollRef}
        className="flex-1 p-3 overflow-y-auto font-mono text-xs text-[#bfbfbf] leading-relaxed whitespace-pre-wrap select-text selection:bg-[#276782]/60"
      >
        {output.join('')}
      </div>

      {/* Interactive Command Input Line */}
      <form
        onSubmit={handleSendInput}
        className="h-8 bg-[#191A1B]/60 border-t border-[#2A2B2C] px-3 flex items-center gap-2 shrink-0"
      >
        <span className="text-emerald-400 font-mono text-xs font-semibold">❯</span>
        <input
          ref={inputRef}
          type="text"
          value={currentInput}
          onChange={(e) => setCurrentInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type command and press Enter..."
          className="flex-1 bg-transparent text-xs text-[#ededed] font-mono focus:outline-none placeholder:text-[#555555]"
        />
      </form>
    </div>
  );
}

export default function TerminalDrawer({
  isOpen,
  onClose,
  onClear,
  logs = [],
  batchProgress = null,
  activeOp = null, // 'check' | 'pull' | 'clone' | null
  currentRepoPath = null,
  drawerHeight = 224,
  onResizeStart,
  onKeyDownResize,
}) {
  const [activeTab, setActiveTab] = useState('sync'); // 'sync' | 'details' | 'terminal'
  const scrollContainerRef = useRef(null);
  const detailsScrollRef = useRef(null);

  // Real shell processes state
  const [shells, setShells] = useState([]); // Array of { id, title, cwd, shellType }
  const [activeShellId, setActiveShellId] = useState(null);
  const [splitShellIds, setSplitShellIds] = useState([]); // Shell IDs displayed in split side-by-side view
  const shellCounterRef = useRef(1);

  // Auto-scroll sync logs to latest line
  useEffect(() => {
    if (isOpen && activeTab === 'sync' && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
    if (isOpen && activeTab === 'details' && detailsScrollRef.current) {
      detailsScrollRef.current.scrollTop = detailsScrollRef.current.scrollHeight;
    }
  }, [logs, isOpen, activeTab]);

  // Spawn a real shell
  const handleSpawnShell = useCallback(
    async (cwdOverride = null, isSplit = false) => {
      if (!window.api || !window.api.shellCreate) return;
      const id = `shell-${Date.now()}-${shellCounterRef.current++}`;
      const title = `pwsh ${shells.length + 1}`;
      const targetCwd = cwdOverride || currentRepoPath || null;

      const res = await window.api.shellCreate({
        shellId: id,
        cwd: targetCwd,
        shellType: 'powershell',
      });

      if (res && res.ok) {
        const newInstance = {
          id,
          title,
          cwd: res.cwd,
          shellType: 'powershell',
        };
        setShells((prev) => [...prev, newInstance]);
        setActiveShellId(id);
        if (isSplit) {
          setSplitShellIds((prev) => [...prev, id]);
        } else {
          setSplitShellIds([id]);
        }
        setActiveTab('terminal');
      }
    },
    [currentRepoPath, shells.length]
  );

  // Close / kill shell
  const handleCloseShell = useCallback((shellIdToClose) => {
    if (window.api && window.api.shellKill) {
      window.api.shellKill(shellIdToClose);
    }
    setShells((prev) => prev.filter((s) => s.id !== shellIdToClose));
    setSplitShellIds((prev) => prev.filter((id) => id !== shellIdToClose));
    setActiveShellId((prev) => (prev === shellIdToClose ? null : prev));
  }, []);

  // Split active shell
  const handleSplitShell = useCallback(
    (sourceShell) => {
      handleSpawnShell(sourceShell.cwd, true);
    },
    [handleSpawnShell]
  );

  if (!isOpen) return null;

  const isRunning = Boolean(activeOp);
  const percent =
    batchProgress && batchProgress.total > 0
      ? Math.min(100, Math.round((batchProgress.current / batchProgress.total) * 100))
      : 0;

  const getLevelStyles = (level) => {
    switch (level) {
      case 'cmd':
        return { prefix: '$', textClass: 'text-[#48A0C7] font-semibold' };
      case 'success':
        return { prefix: '✓', textClass: 'text-emerald-400' };
      case 'update':
        return { prefix: '●', textClass: 'text-[#48A0C7]' };
      case 'warn':
        return { prefix: '!', textClass: 'text-amber-400' };
      case 'error':
        return { prefix: '✗', textClass: 'text-red-400' };
      default:
        return { prefix: '›', textClass: 'text-[#bfbfbf]' };
    }
  };

  const getOpLabel = () => {
    if (activeOp === 'check') return 'Checking Updates...';
    if (activeOp === 'pull') return 'Pulling Repositories...';
    if (activeOp === 'clone') return 'Cloning Repository...';
    return 'Idle';
  };

  return (
    <section
      style={{ height: `${drawerHeight}px` }}
      className="bg-[#121314] rounded-lg border border-[#2A2B2C] flex flex-col shrink-0 select-text overflow-hidden relative shadow-sm animate-drawer-open"
    >
      {/* Terminal Main Header Bar with Tabs (VSCode Style) */}
      <div className="h-9 bg-[#191A1B] border-b border-[#2A2B2C] px-3 flex items-center justify-between gap-4 shrink-0 select-none">
        {/* Left: Tab Navigation & Status */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center bg-[#121314] p-0.5 rounded border border-[#2A2B2C]">
            <button
              type="button"
              onClick={() => setActiveTab('sync')}
              className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded text-xs font-medium transition ${
                activeTab === 'sync'
                  ? 'bg-[#297AA0] text-white shadow-sm'
                  : 'text-[#8C8C8C] hover:text-[#ededed]'
              }`}
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>Sync Log</span>
              {isRunning && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('details')}
              className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded text-xs font-medium transition ${
                activeTab === 'details'
                  ? 'bg-[#297AA0] text-white shadow-sm'
                  : 'text-[#8C8C8C] hover:text-[#ededed]'
              }`}
            >
              <Code2 className="w-3.5 h-3.5" />
              <span>Command Details</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('terminal');
                if (shells.length === 0) {
                  handleSpawnShell();
                }
              }}
              className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded text-xs font-medium transition ${
                activeTab === 'terminal'
                  ? 'bg-[#297AA0] text-white shadow-sm'
                  : 'text-[#8C8C8C] hover:text-[#ededed]'
              }`}
            >
              <Terminal className="w-3.5 h-3.5 text-[#48A0C7]" />
              <span>Terminal</span>
              {shells.length > 0 && (
                <span className="text-[10px] px-1.5 rounded-full bg-[#1E3A47] text-[#48A0C7]">
                  {shells.length}
                </span>
              )}
            </button>
          </div>

          {/* Live Running / Idle Pill */}
          {isRunning ? (
            <span className="flex items-center gap-1.5 text-[11px] px-2 py-0.5 rounded-full bg-[#1E3A47] text-[#48A0C7] border border-[#3994BC]/60">
              <Loader2 className="w-3 h-3 animate-spin" />
              {getOpLabel()}
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-[#242526] text-[#8C8C8C] border border-[#2A2B2C]">
              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
              Idle
            </span>
          )}

          {/* Numeric Progress Counter + Bar */}
          {batchProgress && batchProgress.total > 0 && (
            <div className="flex items-center gap-2">
              <div className="w-24 h-1.5 bg-[#121314] rounded-full overflow-hidden border border-[#2A2B2C]">
                <div
                  className={`h-full transition-all duration-300 ${
                    isRunning ? 'bg-[#297AA0]' : 'bg-emerald-500'
                  }`}
                  style={{ width: `${percent}%` }}
                />
              </div>
              <span className="text-[11px] text-[#8C8C8C] font-mono">
                {batchProgress.current}/{batchProgress.total} ({percent}%)
              </span>
            </div>
          )}
        </div>

        {/* Right Controls: New Terminal, Split, Clear & Hide */}
        <div className="flex items-center gap-1.5">
          {activeTab === 'terminal' && (
            <>
              <button
                type="button"
                onClick={() => handleSpawnShell()}
                className="flex items-center gap-1 text-[11px] bg-[#242526] hover:bg-[#333536] text-[#ededed] px-2 py-1 rounded border border-[#2A2B2C] transition"
                title="New Terminal Window"
              >
                <Plus className="w-3 h-3 text-[#48A0C7]" />
                <span>New</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const target = shells.find((s) => s.id === activeShellId) || shells[0];
                  if (target) handleSplitShell(target);
                  else handleSpawnShell(null, true);
                }}
                className="flex items-center gap-1 text-[11px] bg-[#242526] hover:bg-[#333536] text-[#ededed] px-2 py-1 rounded border border-[#2A2B2C] transition"
                title="Split Active Terminal"
              >
                <Columns2 className="w-3 h-3 text-[#48A0C7]" />
                <span>Split</span>
              </button>
            </>
          )}

          <button
            type="button"
            onClick={onClear}
            disabled={logs.length === 0}
            className="p-1 text-[#8C8C8C] hover:text-[#ededed] hover:bg-white/[0.08] disabled:opacity-30 rounded transition"
            title="Clear Log Output"
            aria-label="Clear log output"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={onClose}
            className="p-1 text-[#8C8C8C] hover:text-[#ededed] hover:bg-white/[0.08] rounded transition"
            title="Hide Terminal (Toggle in footer)"
            aria-label="Hide terminal panel"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* TAB 1: Real-Time Sync Logs */}
      {activeTab === 'sync' && (
        <div
          ref={scrollContainerRef}
          className="flex-1 p-3 overflow-y-auto font-mono text-xs text-[#bfbfbf] space-y-1.5 select-text selection:bg-[#276782]/60"
        >
          {logs.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-[#555555] select-none text-xs">
              <Terminal className="w-8 h-8 text-[#333536] mb-2 stroke-[1.5]" />
              <span>No terminal activity recorded yet.</span>
              <span className="text-[11px] text-[#555555]/80 mt-0.5">
                Logs will stream here automatically when you check or pull repositories.
              </span>
            </div>
          ) : (
            logs.map((log) => {
              const { prefix, textClass } = getLevelStyles(log.level);
              return (
                <div
                  key={log.id}
                  className="flex items-start gap-2 leading-relaxed hover:bg-white/[0.02] px-1 rounded transition-colors"
                >
                  <span className="text-[#555555] shrink-0 text-[11px] select-none">
                    [{log.time}]
                  </span>
                  <span className={`shrink-0 select-none font-bold ${textClass}`}>
                    {prefix}
                  </span>
                  {log.repoName && (
                    <span className="text-[#48A0C7] shrink-0 font-medium">
                      [{log.repoName}]
                    </span>
                  )}
                  <span className={`flex-1 break-all ${textClass}`}>{log.message}</span>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* TAB 2: Command Details (Raw Terminal View) */}
      {activeTab === 'details' && (
        <div
          ref={detailsScrollRef}
          className="flex-1 p-3 overflow-y-auto font-mono text-xs bg-[#121314] text-[#bfbfbf] select-text selection:bg-[#276782]/60 space-y-2"
        >
          <div className="border border-[#2A2B2C] rounded bg-[#191A1B] p-2.5 text-[11px] text-[#8C8C8C] flex items-center justify-between">
            <div>
              <span className="text-[#ededed] font-semibold">Active Command Context: </span>
              {activeOp ? (
                <span className="text-[#48A0C7]">git {activeOp === 'pull' ? 'pull --ff-only' : activeOp === 'check' ? 'ls-remote origin HEAD' : 'clone'}</span>
              ) : (
                <span>No active Git command running</span>
              )}
            </div>
            <span className="text-[10px] text-[#555555] font-mono">Exit Code: 0</span>
          </div>

          <div className="space-y-1 font-mono text-xs">
            {logs.length === 0 ? (
              <div className="text-[#555555] py-8 text-center text-xs">
                Run a Check or Pull operation to view raw execution streams.
              </div>
            ) : (
              logs.map((log) => (
                <div key={`detail-${log.id}`} className="leading-relaxed">
                  <span className="text-[#555555] select-none">PS C:\OSSVault&gt; </span>
                  <span className="text-[#48A0C7] font-semibold">{log.level === 'cmd' ? log.message : `[${log.level.toUpperCase()}] ${log.message}`}</span>
                  {log.repoName && <span className="text-[#8C8C8C] ml-2 font-mono">--path {log.repoName}</span>}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 3: Real Shell Instance / Split Terminal Panes (VSCode Style) */}
      {activeTab === 'terminal' && (
        <div className="flex-1 flex overflow-hidden divide-x divide-[#2A2B2C]">
          {shells.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center select-none">
              <Terminal className="w-10 h-10 text-[#333536] mb-3" />
              <div className="text-xs text-[#ededed] font-medium mb-1">No Real Terminal Spawned</div>
              <div className="text-[11px] text-[#8C8C8C] max-w-sm mb-4">
                Launch a live interactive PowerShell terminal directly inside OSSVault.
              </div>
              <button
                type="button"
                onClick={() => handleSpawnShell()}
                className="flex items-center gap-1.5 text-xs bg-[#297AA0] hover:bg-[#2B7DA3] text-white px-3 py-1.5 rounded transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Spawn PowerShell Terminal</span>
              </button>
            </div>
          ) : (
            splitShellIds.map((id) => {
              const shellInst = shells.find((s) => s.id === id);
              if (!shellInst) return null;
              return (
                <ShellInstanceView
                  key={shellInst.id}
                  shellInstance={shellInst}
                  isActive={activeShellId === shellInst.id}
                  onSelect={() => setActiveShellId(shellInst.id)}
                  onClose={handleCloseShell}
                  onSplit={handleSplitShell}
                  showSplitBtn={splitShellIds.length < 3}
                />
              );
            })
          )}
        </div>
      )}
    </section>
  );
}
