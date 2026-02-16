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
  const result = runCommand('git', ['rev-parse', '--show-toplevel'], { cwd });
  return result.stdout;
}

function listWorktrees(cwd) {
  const result = runCommand('git', ['worktree', 'list', '--porcelain'], { cwd });
  const parsed = parseWorktreePorcelain(result.stdout);

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

module.exports = {
  getBaseWorktreePath,
  getCurrentTopLevel,
  listWorktrees,
  parseWorktreePorcelain,
  resolveWorktreeRef,
  safeRealpath
};
