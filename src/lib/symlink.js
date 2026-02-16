const fs = require('node:fs');
const path = require('node:path');

function ensurePluginLink({ sourcePath, targetPath, force = false, dryRun = false }) {
  const resolvedSource = path.resolve(sourcePath);
  const resolvedTarget = path.resolve(targetPath);

  if (!fs.existsSync(resolvedSource)) {
    throw new Error(`Worktree path does not exist: ${resolvedSource}`);
  }

  const parent = path.dirname(resolvedTarget);
  if (!fs.existsSync(parent)) {
    if (dryRun) {
      return {
        changed: false,
        action: `Would create parent directory ${parent}`
      };
    }

    fs.mkdirSync(parent, { recursive: true });
  }

  const existing = readExistingTarget(resolvedTarget);

  if (existing.exists && existing.isSymlink) {
    const currentResolved = safeReadlinkResolved(resolvedTarget);
    if (currentResolved === resolvedSource) {
      return {
        changed: false,
        action: `Already linked: ${resolvedTarget} -> ${resolvedSource}`
      };
    }

    if (!dryRun) {
      fs.rmSync(resolvedTarget, { force: true, recursive: true });
      fs.symlinkSync(
        resolvedSource,
        resolvedTarget,
        process.platform === 'win32' ? 'junction' : 'dir'
      );
    }

    return {
      changed: true,
      action: `Repointed symlink: ${resolvedTarget} -> ${resolvedSource}`
    };
  }

  if (existing.exists && !existing.isSymlink) {
    if (!force) {
      throw new Error(
        `Target exists and is not a symlink: ${resolvedTarget}. Re-run with --force to replace it.`
      );
    }

    if (!dryRun) {
      fs.rmSync(resolvedTarget, { force: true, recursive: true });
    }
  }

  if (!dryRun) {
    fs.symlinkSync(resolvedSource, resolvedTarget, process.platform === 'win32' ? 'junction' : 'dir');
  }

  return {
    changed: true,
    action: `${dryRun ? 'Would create' : 'Created'} symlink: ${resolvedTarget} -> ${resolvedSource}`
  };
}

function readExistingTarget(targetPath) {
  try {
    const stat = fs.lstatSync(targetPath);
    return {
      exists: true,
      isSymlink: stat.isSymbolicLink()
    };
  } catch (_error) {
    return {
      exists: false,
      isSymlink: false
    };
  }
}

function safeReadlinkResolved(targetPath) {
  try {
    return fs.realpathSync(targetPath);
  } catch (_error) {
    return null;
  }
}

module.exports = {
  ensurePluginLink
};
