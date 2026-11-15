// src/main/gitService.js
const { execFile } = require('child_process');
const path = require('path');

// Helper to run git commands safely without popping up credential windows
function runGit(args, cwd, timeoutMs = 20000) {
  return new Promise((resolve) => {
    execFile(
      'git',
      args,
      {
        cwd,
        timeout: timeoutMs,
        env: {
          ...process.env,
          GIT_TERMINAL_PROMPT: '0',
          GCM_INTERACTIVE: 'never',
        },
      },
      (error, stdout, stderr) => {
        resolve({
          ok: !error,
          stdout: (stdout || '').trim(),
          stderr: (stderr || '').trim(),
          code: error ? error.code : 0,
        });
      }
    );
  });
}

async function getShortHeadHash(repoPath) {
  const res = await runGit(['rev-parse', '--short', 'HEAD'], repoPath, 5000);
  return res.ok ? res.stdout : null;
}

// 1. Safe Update / Pull for a Single Repo (Preserves data if offline/deleted/private)
async function safePullRepo(repoPath, isGitRepo = true) {
  if (!isGitRepo) {
    return {
      status: 'non-git',
      message: 'Skipped plain local folder (not a Git repository).',
    };
  }

  const beforeHash = await getShortHeadHash(repoPath);

  // Step A: Verify remote is still public & reachable
  const check = await runGit(['ls-remote', '--exit-code', 'origin', 'HEAD'], repoPath, 12000);

  if (!check.ok) {
    const errText = check.stderr.toLowerCase();
    if (
      errText.includes('not found') ||
      errText.includes('authentication failed') ||
      errText.includes('could not read username') ||
      errText.includes('repository access blocked') ||
      errText.includes('dmca')
    ) {
      return {
        status: 'archived-offline',
        message: 'Online repo is missing or private. Local files preserved untouched!',
        fromCommit: beforeHash,
        toCommit: beforeHash,
      };
    }
    if (
      errText.includes('429') ||
      errText.includes('rate limit') ||
      errText.includes('too many requests')
    ) {
      return {
        status: 'rate-limited',
        message: 'GitHub rate limit reached. Pausing requests to stay safe.',
        fromCommit: beforeHash,
        toCommit: beforeHash,
      };
    }
    return {
      status: 'offline-error',
      message: `Skipped (Connection/Remote issue): ${check.stderr.split('\n')[0] || 'Unreachable'}`,
      fromCommit: beforeHash,
      toCommit: beforeHash,
    };
  }

  // Step B: Fast-forward pull only (never overwrites local changes)
  const pull = await runGit(['pull', '--ff-only'], repoPath, 60000);
  if (!pull.ok) {
    return {
      status: 'skipped-local-changes',
      message: 'Skipped pull to preserve local state (non-fast-forward).',
      fromCommit: beforeHash,
      toCommit: beforeHash,
    };
  }

  const afterHash = await getShortHeadHash(repoPath);
  const isAlreadyUpToDate =
    pull.stdout.toLowerCase().includes('already up to date') || beforeHash === afterHash;

  return {
    status: isAlreadyUpToDate ? 'up-to-date' : 'updated',
    message: isAlreadyUpToDate
      ? 'Already up to date'
      : `Updated (${beforeHash || '?'} → ${afterHash || '?'})`,
    fromCommit: beforeHash,
    toCommit: afterHash,
  };
}

// 2. Dry-Run Check: See if remote has new commits without pulling
async function checkRepoForUpdates(repoPath, isGitRepo = true) {
  if (!isGitRepo) {
    return { status: 'non-git', message: 'Plain local folder (not a Git repo)' };
  }

  const local = await runGit(['rev-parse', 'HEAD'], repoPath, 5000);
  if (!local.ok) {
    return { status: 'error', message: 'Could not read local HEAD' };
  }

  const remote = await runGit(['ls-remote', 'origin', 'HEAD'], repoPath, 10000);
  if (!remote.ok) {
    return {
      status: 'archived-offline',
      message: 'Remote unavailable or private (Local files preserved)',
      fromCommit: local.stdout.slice(0, 7),
    };
  }

  const remoteHash = remote.stdout.split(/\s+/)[0];
  const hasUpdate = Boolean(remoteHash && remoteHash !== local.stdout);

  return {
    status: hasUpdate ? 'update-available' : 'up-to-date',
    message: hasUpdate ? 'New commits available on GitHub!' : 'Up to date with GitHub',
    fromCommit: local.stdout.slice(0, 7),
    toCommit: remoteHash ? remoteHash.slice(0, 7) : null,
  };
}

// 3. Full Git Clone into rootFolder
async function clonePublicRepo(rootFolder, repoUrl) {
  const cleanUrl = (repoUrl || '').trim();
  if (!cleanUrl) {
    return { ok: false, message: 'Repository URL cannot be empty.' };
  }

  const res = await runGit(['clone', cleanUrl], rootFolder, 180000);
  if (!res.ok) {
    return { ok: false, message: res.stderr || 'Failed to clone repository.' };
  }

  // Infer cloned folder name from URL (e.g., https://github.com/user/repo.git -> repo)
  const repoName = path
    .basename(cleanUrl.replace(/\/+$/, ''))
    .replace(/\.git$/i, '');

  const clonedPath = path.join(rootFolder, repoName);
  const headHash = await getShortHeadHash(clonedPath);

  return {
    ok: true,
    repoName,
    toCommit: headHash,
    message: `Repository "${repoName}" cloned successfully!`,
  };
}

// 4. Local Git Commit History Timeline (works 100% offline)
async function getGitCommitHistory(repoPath, isGitRepo = true, limit = 40) {
  if (!isGitRepo) return [];

  const format = '%H%x1f%h%x1f%an%x1f%ad%x1f%ar%x1f%s%x1e';
  const res = await runGit(
    ['log', '-n', String(limit), '--date=iso-strict', `--pretty=format:${format}`],
    repoPath,
    10000
  );

  if (!res.ok || !res.stdout) return [];

  return res.stdout
    .split('\x1e')
    .map((record) => record.trim())
    .filter(Boolean)
    .map((record) => {
      const [hash, shortHash, author, date, relativeDate, subject] = record.split('\x1f');
      return {
        hash: hash || '',
        shortHash: shortHash || '',
        author: author || 'Unknown',
        date: date || '',
        relativeDate: relativeDate || '',
        subject: subject || '(No commit message)',
      };
    });
}

module.exports = {
  safePullRepo,
  checkRepoForUpdates,
  checkRepoUpdateAvailable: checkRepoForUpdates,
  clonePublicRepo,
  cloneNewRepo: (repoUrl, rootFolder) => clonePublicRepo(rootFolder, repoUrl),
  getGitCommitHistory,
};
