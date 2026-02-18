const fs = require('node:fs');
const path = require('node:path');
const { runCommand } = require('./shell');

function parseWorktreePorcelain(input) {
  const rows = input.split(/\r?\n/);
  const worktrees = [];
  let current = null;

  for (const row of rows) {
    if (!row) {
      if (current && current.worktree) {
        worktrees.push(current);
      }
      current = null;
      continue;
    }

    const firstSpace = row.indexOf(' ');
    const key = firstSpace === -1 ? row : row.slice(0, firstSpace);
    const value = firstSpace === -1 ? '' : row.slice(firstSpace + 1);

    if (key === 'worktree') {
      current = {
        worktree: value,
        head: '',
        branch: null,
        detached: false
      };
      continue;
    }

    if (!current) {
      continue;
    }

    if (key === 'HEAD') {
      current.head = value;
    } else if (key === 'branch') {
      current.branch = value.replace(/^refs\/heads\//, '');
    } else if (key === 'detached') {
      current.detached = true;
      current.branch = null;
    }
  }

  if (current && current.worktree) {
    worktrees.push(current);
  }

  return worktrees;
}

function getCurrentTopLevel(cwd) {
  const resolvedCwd = safeRealpath(cwd);
  const result = runCommand('git', ['rev-parse', '--show-toplevel'], {
    cwd: resolvedCwd,
    allowFailure: true
  });

  if (result.ok) {
    return result.stdout;
  }

  const anchor = findGitAnchor(resolvedCwd);
  if (anchor) {
    return safeRealpath(anchor);
  }

  throw new Error(result.stderr || `fatal: not a git repository: ${resolvedCwd}`);
}

function listWorktrees(cwd) {
  const resolvedCwd = safeRealpath(cwd);
  const attempts = [resolvedCwd];
  const inferredBasePath = inferBaseRepoPath(resolvedCwd);

  if (inferredBasePath && inferredBasePath !== resolvedCwd) {
    attempts.push(inferredBasePath);
  }

  let parsed = null;
  let lastError = '';

  for (const attemptCwd of attempts) {
    const result = runCommand('git', ['worktree', 'list', '--porcelain'], {
      cwd: attemptCwd,
      allowFailure: true
    });

    if (result.ok) {
      parsed = parseWorktreePorcelain(result.stdout);
      break;
    }

    lastError = result.stderr || lastError;
  }

  if (!parsed) {
    throw new Error(lastError || 'Unable to list git worktrees.');
  }

  return parsed.map((entry) => ({
    ...entry,
    resolvedWorktree: safeRealpath(entry.worktree)
  }));
}

function getBaseWorktreePath(cwd) {
  const worktrees = listWorktrees(cwd);

  if (!worktrees.length) {
    throw new Error('No git worktrees found in this repository.');
  }

  return worktrees[0].worktree;
}

function resolveWorktreeRef({ ref, worktrees, cwd }) {
  const selectedRef = ref || getCurrentTopLevel(cwd);

  const byBranch = worktrees.find((item) => item.branch === selectedRef);
  if (byBranch) {
    return byBranch;
  }

  const absoluteRef = path.resolve(cwd, selectedRef);
  if (fs.existsSync(absoluteRef)) {
    const resolvedInput = safeRealpath(absoluteRef);
    const pathMatch = worktrees.find((item) => item.resolvedWorktree === resolvedInput);

    if (pathMatch) {
      return pathMatch;
    }

    throw new Error(`'${selectedRef}' exists but is not a tracked git worktree.`);
  }

  const fallbackMatches = worktrees.filter((item) => {
    const basename = path.basename(item.worktree);
    return basename === selectedRef || item.worktree.endsWith(`@${selectedRef}`) || basename.endsWith(`@${selectedRef}`);
  });

  if (fallbackMatches.length === 1) {
    return fallbackMatches[0];
  }

  if (fallbackMatches.length > 1) {
    throw new Error(`Ambiguous worktree reference '${selectedRef}'. Use a full branch name or full path.`);
  }

  throw new Error(`Unable to resolve worktree '${selectedRef}'. Run 'linchpin wt ls' to view available worktrees.`);
}

function safeRealpath(inputPath) {
  try {
    return fs.realpathSync(inputPath);
  } catch (_error) {
    return path.resolve(inputPath);
  }
}

function findGitAnchor(startPath) {
  let current = safeRealpath(startPath);

  try {
    if (!fs.statSync(current).isDirectory()) {
      current = path.dirname(current);
    }
  } catch (_error) {
    current = path.dirname(current);
  }

  while (true) {
    if (fs.existsSync(path.join(current, '.git'))) {
      return current;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      return null;
    }
    current = parent;
  }
}

function inferBaseRepoPath(startPath) {
  const anchor = findGitAnchor(startPath);
  if (!anchor) {
    return null;
  }

  const candidates = [anchor, safeRealpath(anchor)];
  for (const candidate of candidates) {
    const baseCandidate = stripWorktreeSuffix(candidate);
    if (!baseCandidate || baseCandidate === candidate) {
      continue;
    }

    if (!fs.existsSync(path.join(baseCandidate, '.git'))) {
      continue;
    }

    return safeRealpath(baseCandidate);
  }

  return null;
}

function stripWorktreeSuffix(repoPath) {
  let current = path.resolve(repoPath);

  while (true) {
    const basename = path.basename(current);
    const atIndex = basename.lastIndexOf('@');
    if (atIndex > 0) {
      const repoName = basename.slice(0, atIndex);
      return path.join(path.dirname(current), repoName);
    }

    const parent = path.dirname(current);
    if (parent === current) {
      break;
    }
    current = parent;
  }

  return null;
}

module.exports = {
  findGitAnchor,
  getBaseWorktreePath,
  getCurrentTopLevel,
  inferBaseRepoPath,
  listWorktrees,
  parseWorktreePorcelain,
  resolveWorktreeRef,
  safeRealpath
};
