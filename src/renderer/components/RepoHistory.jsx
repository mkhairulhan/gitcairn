// src/renderer/components/RepoHistory.jsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  History,
  GitCommit,
  RefreshCw,
  Trash2,
  CheckCircle2,
  ArrowUpCircle,
  ShieldAlert,
  Download,
  AlertTriangle,
  Clock,
  Copy,
  Check,
  Loader2,
  ArrowRight,
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

function formatRelativeTime(dateInput) {
  if (!dateInput) return '';
  const date = new Date(dateInput);
  if (Number.isNaN(date.getTime())) return String(dateInput);

  const diffSec = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diffSec < 45) return 'Just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  if (diffSec < 86400 * 30) return `${Math.floor(diffSec / 86400)}d ago`;
  return date.toLocaleDateString();
}

function getEventVisuals(type, status) {
  if (type === 'clone' || status === 'cloned') {
    return {
      icon: Download,
      dotClass: 'bg-[#297AA0]/20 border-[#297AA0] text-[#48A0C7]',
      badgeClass: 'bg-[#1E3A47]/80 border-[#3994BC]/60 text-[#48A0C7]',
      label: 'Cloned',
    };
  }

  switch (status) {
    case 'updated':
      return {
        icon: CheckCircle2,
        dotClass: 'bg-emerald-500/20 border-emerald-500 text-emerald-300',
        badgeClass: 'bg-emerald-950/70 border-emerald-700/70 text-emerald-300',
        label: 'Pulled Update',
      };
    case 'update-available':
      return {
        icon: ArrowUpCircle,
        dotClass: 'bg-blue-500/20 border-blue-500 text-blue-300',
        badgeClass: 'bg-blue-950/70 border-blue-700/70 text-blue-300',
        label: 'Update Available',
      };
    case 'up-to-date':
      return {
        icon: CheckCircle2,
        dotClass: 'bg-zinc-700/40 border-zinc-500 text-zinc-300',
        badgeClass: 'bg-zinc-800 border-zinc-700 text-zinc-300',
        label: type === 'check' ? 'Checked · Up to Date' : 'Pull · Up to Date',
      };
    case 'archived-offline':
      return {
        icon: ShieldAlert,
        dotClass: 'bg-amber-500/20 border-amber-500 text-amber-300',
        badgeClass: 'bg-amber-950/70 border-amber-700/70 text-amber-300',
        label: 'Protected Locally',
      };
    case 'skipped-local-changes':
    case 'rate-limited':
      return {
        icon: AlertTriangle,
        dotClass: 'bg-amber-500/20 border-amber-500 text-amber-300',
        badgeClass: 'bg-amber-950/70 border-amber-700/70 text-amber-300',
        label: status === 'rate-limited' ? 'Rate Limited' : 'Skipped (Local Changes)',
      };
    default:
      return {
        icon: AlertTriangle,
        dotClass: 'bg-red-500/20 border-red-500 text-red-300',
        badgeClass: 'bg-red-950/70 border-red-800/70 text-red-300',
        label: status || 'Sync Event',
      };
  }
}

export default function RepoHistory({ repo, onReposUpdated }) {
  const [syncHistory, setSyncHistory] = useState([]);
  const [gitCommits, setGitCommits] = useState([]);
  const [loading, setLoading] = useState(false);
  const [viewFilter, setViewFilter] = useState('split');
  const [copiedHash, setCopiedHash] = useState(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const fetchHistory = useCallback(async () => {
    if (!repo || !window.api?.getRepoHistory) return;
    setLoading(true);
    try {
      const res = await window.api.getRepoHistory(repo);
      setSyncHistory(Array.isArray(res?.syncHistory) ? res.syncHistory : repo.history || []);
      setGitCommits(Array.isArray(res?.gitCommits) ? res.gitCommits : []);
    } catch (err) {
      console.error('Failed to load repository history:', err);
      setSyncHistory(repo.history || []);
      setGitCommits([]);
    } finally {
      setLoading(false);
    }
  }, [repo]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory, repo?.name, repo?.lastPulled, repo?.syncStatus, repo?.history?.length]);

  const confirmClearSyncLog = async () => {
    if (!repo) return;
    setShowClearConfirm(false);
    const res = await window.api.clearRepoHistory(repo.name);
    if (res?.ok) {
      setSyncHistory([]);
      if (res.repos && onReposUpdated) {
        onReposUpdated(res.repos);
      }
    }
  };

  const handleCopyHash = (hash) => {
    if (!hash) return;
    navigator.clipboard?.writeText(hash);
    setCopiedHash(hash);
    setTimeout(() => setCopiedHash(null), 1500);
  };

  if (!repo) return null;

  const showSyncCol = viewFilter === 'split' || viewFilter === 'sync';
  const showCommitsCol = viewFilter === 'split' || viewFilter === 'commits';

  return (
    <div className="h-full flex flex-col bg-[#121314] text-[#bfbfbf] select-text">
      {/* Sub-Header Controls */}
      <div className="px-6 py-3 bg-[#191A1B] border-b border-[#2A2B2C] flex flex-wrap items-center justify-between gap-3 shrink-0 select-none">
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-[#121314] p-0.5 rounded border border-[#2A2B2C]">
            <button
              onClick={() => setViewFilter('split')}
              className={`px-2.5 py-1 rounded text-xs font-medium transition ${
                viewFilter === 'split'
                  ? 'bg-[#297AA0] text-white'
                  : 'text-[#8C8C8C] hover:text-[#ededed]'
              }`}
            >
              Split View
            </button>
            <button
              onClick={() => setViewFilter('sync')}
              className={`px-2.5 py-1 rounded text-xs font-medium transition ${
                viewFilter === 'sync'
                  ? 'bg-[#297AA0] text-white'
                  : 'text-[#8C8C8C] hover:text-[#ededed]'
              }`}
            >
              Sync Log ({syncHistory.length})
            </button>
            <button
              onClick={() => setViewFilter('commits')}
              className={`px-2.5 py-1 rounded text-xs font-medium transition ${
                viewFilter === 'commits'
                  ? 'bg-[#297AA0] text-white'
                  : 'text-[#8C8C8C] hover:text-[#ededed]'
              }`}
            >
              Git Commits ({gitCommits.length})
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={fetchHistory}
                disabled={loading}
                className="flex items-center gap-1.5 text-xs bg-[#242526] hover:bg-[#333536] disabled:opacity-50 text-[#ededed] px-2.5 py-1 rounded border border-[#2A2B2C] transition"
              >
                {loading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[#48A0C7]" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5 text-[#48A0C7]" />
                )}
                Refresh
              </button>
            </TooltipTrigger>
            <TooltipContent>Reload recent Git commits and sync log</TooltipContent>
          </Tooltip>

          {syncHistory.length > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setShowClearConfirm(true)}
                  className="flex items-center gap-1.5 text-xs bg-[#242526] hover:bg-red-950/60 hover:border-red-800/70 hover:text-red-200 text-[#8C8C8C] px-2.5 py-1 rounded border border-[#2A2B2C] transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Clear Sync Log
                </button>
              </TooltipTrigger>
              <TooltipContent>Clear saved sync event history (keeps Git commit log)</TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>

      {/* Main Content Grid */}
      <div
        className={`flex-1 overflow-y-auto p-6 grid gap-6 ${
          viewFilter === 'split'
            ? 'grid-cols-1 xl:grid-cols-2'
            : 'grid-cols-1 max-w-4xl mx-auto w-full'
        }`}
      >
        {/* COLUMN 1: GitCairn Sync & Update Activity */}
        {showSyncCol && (
          <section className="flex flex-col bg-[#191A1B] rounded-lg border border-[#2A2B2C] overflow-hidden h-fit">
            <div className="px-4 py-3 border-b border-[#2A2B2C] flex items-center justify-between bg-[#202122]">
              <div className="flex items-center gap-2 font-semibold text-xs text-[#ededed] uppercase tracking-wider">
                <History className="w-4 h-4 text-[#48A0C7]" />
                <span>GitCairn Sync & Update Timeline</span>
              </div>
              <span className="text-[11px] text-[#8C8C8C]">
                {syncHistory.length} {syncHistory.length === 1 ? 'event' : 'events'}
              </span>
            </div>

            {syncHistory.length === 0 ? (
              <div className="p-8 text-center text-xs text-[#8C8C8C] space-y-1.5">
                <p className="text-[#ededed] font-medium">No sync events recorded yet.</p>
                <p className="text-[#555555]">
                  Click <span className="text-[#ededed]">Check</span> or{' '}
                  <span className="text-[#ededed]">Pull Latest</span> above to start tracking when
                  this repository is checked or updated.
                </p>
              </div>
            ) : (
              <div className="p-4">
                <div className="relative pl-6 space-y-4 before:content-[''] before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-px before:bg-[#2A2B2C]">
                  {syncHistory.map((item, idx) => {
                    const visuals = getEventVisuals(item.type, item.status);
                    const IconComponent = visuals.icon;
                    const ts = item.timestamp || item.date;
                    const hasHashTransition =
                      item.fromCommit && item.toCommit && item.fromCommit !== item.toCommit;

                    return (
                      <div key={item.id || `${ts}-${idx}`} className="relative">
                        <span
                          className={`absolute -left-6 top-0.5 w-5 h-5 rounded-full border flex items-center justify-center ${visuals.dotClass}`}
                        >
                          <IconComponent className="w-3 h-3" />
                        </span>

                        <div className="bg-[#121314] border border-[#2A2B2C] rounded-md p-3 space-y-1.5">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <span
                              className={`text-[11px] font-medium px-2 py-0.5 rounded border ${visuals.badgeClass}`}
                            >
                              {visuals.label}
                            </span>
                            {ts && (
                              <span
                                className="text-[11px] text-[#8C8C8C] flex items-center gap-1"
                                title={new Date(ts).toLocaleString()}
                              >
                                <Clock className="w-3 h-3 text-[#555555]" />
                                {formatRelativeTime(ts)} · {new Date(ts).toLocaleString()}
                              </span>
                            )}
                          </div>

                          <p className="text-xs text-[#bfbfbf] leading-relaxed">{item.message}</p>

                          {(hasHashTransition || item.toCommit) && (
                            <div className="pt-1 flex items-center gap-1.5 text-[11px] font-mono text-[#8C8C8C]">
                              {hasHashTransition ? (
                                <>
                                  <span className="px-1.5 py-0.5 rounded bg-[#191A1B] border border-[#2A2B2C] text-[#ededed]">
                                    {item.fromCommit.slice(0, 7)}
                                  </span>
                                  <ArrowRight className="w-3 h-3 text-emerald-400" />
                                  <span className="px-1.5 py-0.5 rounded bg-emerald-950/60 border border-emerald-700/60 text-emerald-300">
                                    {item.toCommit.slice(0, 7)}
                                  </span>
                                </>
                              ) : (
                                <span className="px-1.5 py-0.5 rounded bg-[#191A1B] border border-[#2A2B2C] text-[#8C8C8C]">
                                  HEAD: {item.toCommit.slice(0, 7)}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </section>
        )}

        {/* COLUMN 2: Local Git Commit Log */}
        {showCommitsCol && (
          <section className="flex flex-col bg-[#191A1B] rounded-lg border border-[#2A2B2C] overflow-hidden h-fit">
            <div className="px-4 py-3 border-b border-[#2A2B2C] flex items-center justify-between bg-[#202122]">
              <div className="flex items-center gap-2 font-semibold text-xs text-[#ededed] uppercase tracking-wider">
                <GitCommit className="w-4 h-4 text-[#48A0C7]" />
                <span>Recent Git Commits (Local)</span>
              </div>
              <span className="text-[11px] text-[#8C8C8C]">
                {repo.isGitRepo ? `Latest ${gitCommits.length}` : 'Non-Git Folder'}
              </span>
            </div>

            {!repo.isGitRepo ? (
              <div className="p-8 text-center text-xs text-[#555555]">
                This folder is not a Git repository, so commit history is unavailable.
              </div>
            ) : gitCommits.length === 0 ? (
              <div className="p-8 text-center text-xs text-[#555555]">
                {loading ? 'Loading commit history...' : 'No Git commits found in this repository.'}
              </div>
            ) : (
              <div className="divide-y divide-[#2A2B2C]">
                {gitCommits.map((commit, idx) => {
                  const fullHash = commit.hash || commit.shortHash || '';
                  const shortHash = commit.shortHash || fullHash.slice(0, 7);
                  const subject = commit.subject || commit.message || '(No commit message)';
                  const author = commit.author || commit.authorName || 'Unknown author';
                  const commitDate = commit.date || commit.isoDate || '';

                  return (
                    <div
                      key={fullHash || idx}
                      className="p-3.5 hover:bg-white/[0.04] transition flex items-start justify-between gap-3"
                    >
                      <div className="min-w-0 space-y-1">
                        <p className="text-xs font-medium text-[#ededed] leading-snug break-words">
                          {subject}
                        </p>
                        <div className="flex items-center gap-2 text-[11px] text-[#8C8C8C] flex-wrap">
                          <span className="text-[#48A0C7] font-medium">{author}</span>
                          {commitDate && (
                            <>
                              <span>•</span>
                              <span title={new Date(commitDate).toLocaleString()}>
                                {commit.relativeDate || formatRelativeTime(commitDate)}
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      {shortHash && (
                        <button
                          onClick={() => handleCopyHash(fullHash || shortHash)}
                          className="flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded bg-[#121314] hover:bg-[#242526] text-[#bfbfbf] border border-[#2A2B2C] shrink-0 select-none transition"
                          title="Copy commit hash"
                        >
                          <span>{shortHash}</span>
                          {copiedHash === (fullHash || shortHash) ? (
                            <Check className="w-3 h-3 text-emerald-400" />
                          ) : (
                            <Copy className="w-3 h-3 text-[#555555]" />
                          )}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}
      </div>

      {/* Modern Shadcn Confirm Clear Log Dialog */}
      <AlertDialog open={showClearConfirm} onOpenChange={setShowClearConfirm}>
        <AlertDialogContent className="bg-[#191A1B] border-[#2A2B2C] text-[#ededed] max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[#ededed] flex items-center gap-2">
              <Trash2 className="w-4 h-4 text-red-400" />
              Clear Sync Timeline?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[#8C8C8C] text-xs leading-relaxed">
              Clear GitCairn's saved sync activity log for <span className="font-semibold text-[#ededed]">{repo.name}</span>? Your Git commits and files are completely untouched.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4 gap-2">
            <AlertDialogCancel className="bg-[#242526] text-[#ededed] border-[#2A2B2C] hover:bg-[#333536] hover:text-white text-xs h-8">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmClearSyncLog}
              className="bg-red-950/80 hover:bg-red-900 text-red-200 border border-red-800/60 text-xs h-8"
            >
              Clear Log
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
