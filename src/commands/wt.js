const fs = require('node:fs');
const path = require('node:path');
const {
  getBaseWorktreePath,
  getCurrentTopLevel,
  listWorktrees,
  resolveWorktreeRef,
  safeRealpath
} = require('../lib/git');
const { runCommand } = require('../lib/shell');
const { expandHome, readConfig, writeDefaultConfig } = require('../lib/config');
const { ensurePluginLink } = require('../lib/symlink');
const { findHookFile, runHook } = require('../lib/hooks');

function runWt(argv, options = {}) {
  const cwd = options.cwd || process.cwd();
  const command = argv[0] || 'help';

  switch (command) {
    case 'ls':
    case 'list':
      return commandList(cwd, argv.slice(1));
    case 'current':
      return commandCurrent(cwd, argv.slice(1));
    case 'switch':
      return commandSwitch(cwd, argv.slice(1));
    case 'new':
      return commandNew(cwd, argv.slice(1));
    case 'get':
      return commandGet(cwd, argv.slice(1));
    case 'extract':
      return commandExtract(cwd);
    case 'mv':
      return commandMove(cwd, argv.slice(1));
    case 'del':
      return commandDelete(cwd, argv.slice(1));
    case 'cd':
      return commandCd(cwd, argv.slice(1));
    case 'home':
      return commandHome(cwd);
    case 'use':
      return commandUse(cwd);
    case 'gone':
      return commandGone(cwd);
    case 'copy':
      return commandCopy(cwd, argv.slice(1));
    case 'link':
      return commandLink(cwd, argv.slice(1));
    case 'invoke':
      return commandInvoke(cwd, argv.slice(1));
    case 'config':
      return commandConfig(cwd, argv.slice(1));
    case 'help':
    case '--help':
    case '-h':
      printWtHelp();
      return 0;
    default:
      throw new Error(`Unknown wt command '${command}'. Run 'linchpin wt help'.`);
  }
}

function commandList(cwd, argv) {
  const worktrees = listWorktrees(cwd);
  const current = safeRealpath(getCurrentTopLevel(cwd));
  const useJson = argv.includes('--json');

  if (useJson) {
    const payload = worktrees.map((item) => ({
      worktree: item.worktree,
      branch: item.branch,
      detached: item.detached,
      current: item.resolvedWorktree === current
    }));

    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
    return 0;
  }

  process.stdout.write('Worktrees\n');

  for (const item of worktrees) {
    const marker = item.resolvedWorktree === current ? '*' : ' ';
    const label = item.branch || `detached (${item.head.slice(0, 7)})`;
    process.stdout.write(`${marker} ${label.padEnd(30)} ${item.worktree}\n`);
  }

  return 0;
}

function commandCurrent(cwd, argv) {
  const basePath = getBaseWorktreePath(cwd);
  const worktrees = listWorktrees(cwd);
  const currentPath = safeRealpath(getCurrentTopLevel(cwd));
  const current = worktrees.find((item) => item.resolvedWorktree === currentPath);

  if (!current) {
    throw new Error(`Current directory is not an active git worktree: ${cwd}`);
  }

  const envOption = readOptionValue(argv, '--env');
  const output = {
    basePath,
    worktree: current.worktree,
    branch: current.branch,
    detached: current.detached
  };

  const wantsLink = argv.includes('--link') || !!envOption;
  if (wantsLink) {
    const config = readConfig(basePath);
    const envName = envOption || config.wordpress.defaultEnvironment;
    const targetPath = config.wordpress.environments[envName];

    if (!targetPath) {
      throw new Error(`Unknown environment '${envName}'.`);
    }

    output.environment = envName;
    output.linkPath = path.resolve(expandHome(targetPath));
  }

  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
  return 0;
}

function commandSwitch(cwd, argv) {
  const basePath = getBaseWorktreePath(cwd);
  const worktrees = listWorktrees(cwd);

  const options = parseSwitchArgs(argv);
  const config = readConfig(basePath);
  const environmentName = options.environment || config.wordpress.defaultEnvironment;
  const targetPathRaw = config.wordpress.environments[environmentName];

  if (!targetPathRaw) {
    throw new Error(
      `Environment '${environmentName}' is not configured. Available: ${Object.keys(config.wordpress.environments).join(', ')}`
    );
  }

  const selected = resolveWorktreeRef({
    ref: options.ref,
    worktrees,
    cwd
  });

  const sourcePath = selected.worktree;
  const targetPath = path.resolve(expandHome(targetPathRaw));

  const result = ensurePluginLink({
    sourcePath,
    targetPath,
    force: options.force,
    dryRun: options.dryRun
  });

  process.stdout.write(`${result.action}\n`);
  process.stdout.write(
    `Environment: ${environmentName} | Worktree: ${selected.worktree} | Branch: ${selected.branch || 'detached'}\n`
  );

  return 0;
}

function commandNew(cwd, argv) {
  const branchName = argv[0] || `wip-${Math.floor(Math.random() * 100000)}`;

  validateBranchName(branchName);

  const basePath = getBaseWorktreePath(cwd);
  const worktreePath = branchWorktreePath(basePath, branchName);

  runHook(basePath, 'pre-new', {
    LINCHPIN_BRANCH: branchName,
    LINCHPIN_WORKTREE: worktreePath
  });

  fetchAll(basePath);

  if (pathExists(worktreePath)) {
    throw new Error(`Worktree path already exists: ${worktreePath}`);
  }

  runCommand('git', ['worktree', 'add', '--detach', worktreePath, remoteHead(basePath)], { cwd: basePath });
  runCommand('git', ['switch', '--create', branchName, '--no-track'], { cwd: worktreePath });

  runHook(basePath, 'post-new', {
    LINCHPIN_BRANCH: branchName,
    LINCHPIN_WORKTREE: worktreePath
  });

  process.stdout.write(`${worktreePath}\n`);
  return 0;
}

function commandGet(cwd, argv) {
  const branchName = argv[0];
  if (!branchName) {
    throw new Error('Usage: linchpin wt get <branch>');
  }

  const basePath = getBaseWorktreePath(cwd);
  const worktreePath = branchWorktreePath(basePath, branchName);

  runHook(basePath, 'pre-get', {
    LINCHPIN_BRANCH: branchName,
    LINCHPIN_WORKTREE: worktreePath
  });

  fetchAll(basePath);

  if (!remoteBranchExists(basePath, branchName)) {
    throw new Error(`Remote branch origin/${branchName} does not exist.`);
  }

  if (pathExists(worktreePath)) {
    throw new Error(`Worktree path already exists: ${worktreePath}`);
  }

  if (localBranchExists(basePath, branchName)) {
    runCommand('git', ['worktree', 'add', worktreePath, branchName], { cwd: basePath });
  } else {
    runCommand('git', ['worktree', 'add', '-b', branchName, '--track', worktreePath, `origin/${branchName}`], {
      cwd: basePath
    });
  }

  runHook(basePath, 'post-get', {
    LINCHPIN_BRANCH: branchName,
    LINCHPIN_WORKTREE: worktreePath
  });

  process.stdout.write(`${worktreePath}\n`);
  return 0;
}

function commandExtract(cwd) {
  const basePath = getBaseWorktreePath(cwd);
  const currentTopLevel = getCurrentTopLevel(cwd);

  if (safeRealpath(currentTopLevel) !== safeRealpath(basePath)) {
    throw new Error('Extract must be run from the base worktree.');
  }

  const branchName = runCommand('git', ['branch', '--show-current'], { cwd: basePath }).stdout;

  if (!branchName) {
    throw new Error('Not on a branch (detached HEAD).');
  }

  const worktreePath = branchWorktreePath(basePath, branchName);

  if (pathExists(worktreePath)) {
    throw new Error(`Worktree path already exists: ${worktreePath}`);
  }

  runHook(basePath, 'pre-extract', {
    LINCHPIN_BRANCH: branchName,
    LINCHPIN_WORKTREE: worktreePath
  });

  runCommand('git', ['switch', '--detach', remoteHead(basePath)], { cwd: basePath });
  runCommand('git', ['worktree', 'add', worktreePath, branchName], { cwd: basePath });

  runHook(basePath, 'post-extract', {
    LINCHPIN_BRANCH: branchName,
    LINCHPIN_WORKTREE: worktreePath
  });

  process.stdout.write(`${worktreePath}\n`);
  return 0;
}

function commandMove(cwd, argv) {
  const newName = argv[0];
  if (!newName) {
    throw new Error('Usage: linchpin wt mv <new-branch-name>');
  }

  validateBranchName(newName);

  const basePath = getBaseWorktreePath(cwd);
  assertInLinkedWorktree(cwd, basePath);

  const currentPath = getCurrentTopLevel(cwd);
  const currentBranch = runCommand('git', ['branch', '--show-current'], { cwd: currentPath }).stdout;

  if (!currentBranch) {
    throw new Error('Cannot rename while in detached HEAD state.');
  }

  const newPath = branchWorktreePath(basePath, newName);

  runHook(basePath, 'pre-mv', {
    LINCHPIN_BRANCH: newName,
    LINCHPIN_WORKTREE: newPath,
    LINCHPIN_OLD_BRANCH: currentBranch,
    LINCHPIN_OLD_WORKTREE: currentPath
  });

  if (pathExists(newPath)) {
    throw new Error(`Target worktree path already exists: ${newPath}`);
  }

  runCommand('git', ['branch', '-m', newName], { cwd: currentPath });
  runCommand('git', ['worktree', 'move', currentPath, newPath], { cwd: basePath });

  runHook(basePath, 'post-mv', {
    LINCHPIN_BRANCH: newName,
    LINCHPIN_WORKTREE: newPath,
    LINCHPIN_OLD_BRANCH: currentBranch,
    LINCHPIN_OLD_WORKTREE: currentPath
  });

  process.stdout.write(`${newPath}\n`);
  return 0;
}

function commandDelete(cwd, argv) {
  const force = argv.includes('--force') || argv.includes('-f');

  const basePath = getBaseWorktreePath(cwd);
  assertInLinkedWorktree(cwd, basePath);

  const currentPath = getCurrentTopLevel(cwd);
  const branchName = runCommand('git', ['branch', '--show-current'], { cwd: currentPath }).stdout;

  if (!branchName) {
    throw new Error('Cannot delete: current worktree is detached and has no branch.');
  }

  runHook(basePath, 'pre-del', {
    LINCHPIN_BRANCH: branchName,
    LINCHPIN_WORKTREE: currentPath
  });

  if (!force) {
    const dirty = runCommand('git', ['status', '--porcelain'], { cwd: currentPath }).stdout;

    if (dirty) {
      throw new Error('Worktree has uncommitted changes. Re-run with --force.');
    }

    if (!isMergedIntoRemoteHead(basePath, branchName)) {
      throw new Error(`Branch '${branchName}' is not merged into ${remoteHead(basePath)}. Re-run with --force.`);
    }
  }

  process.chdir(basePath);

  const removeArgs = ['worktree', 'remove'];
  if (force) {
    removeArgs.push('--force');
  }
  removeArgs.push(currentPath);

  runCommand('git', removeArgs, { cwd: basePath });

  runCommand('git', ['branch', force ? '-D' : '-d', branchName], { cwd: basePath });

  runHook(basePath, 'post-del', {
    LINCHPIN_BRANCH: branchName,
    LINCHPIN_WORKTREE: currentPath
  });

  process.stdout.write(`Deleted ${branchName} (${currentPath})\n`);
  process.stdout.write(`${basePath}\n`);
  return 0;
}

function commandCd(cwd, argv) {
  const basePath = getBaseWorktreePath(cwd);
  const worktrees = listWorktrees(cwd);

  if (argv[0]) {
    const selected = resolveWorktreeRef({ ref: argv[0], worktrees, cwd });
    process.stdout.write(`${selected.worktree}\n`);
    return 0;
  }

  if (!hasCommand('fzf')) {
    throw new Error("fzf is not installed. Provide a reference: linchpin wt cd <branch|path>");
  }

  const lines = worktrees.map((item) => {
    const label = item.branch || `detached ${item.head.slice(0, 7)}`;
    return `${label}\t${item.worktree}`;
  });

  const selected = runCommand(
    'fzf',
    ['--no-multi', '--exit-0', '-d', '\t', '--with-nth=1', '--preview', 'git -C {2} log -15 --oneline --decorate'],
    {
      input: lines.join('\n'),
      allowFailure: true
    }
  );

  if (!selected.ok || !selected.stdout) {
    return 0;
  }

  const outputPath = selected.stdout.split('\t')[1] || '';
  if (outputPath) {
    process.stdout.write(`${outputPath.trim()}\n`);
  }

  return 0;
}

function commandHome(cwd) {
  const basePath = getBaseWorktreePath(cwd);
  process.stdout.write(`${basePath}\n`);
  return 0;
}

function commandUse(cwd) {
  const basePath = getBaseWorktreePath(cwd);
  assertInLinkedWorktree(cwd, basePath);

  const commit = runCommand('git', ['rev-parse', 'HEAD'], { cwd }).stdout;
  runCommand('git', ['-C', basePath, '-c', 'advice.detachedHead=false', 'switch', '--detach', commit], { cwd: basePath });

  process.stdout.write(`Base switched to ${commit.slice(0, 12)}\n`);
  return 0;
}

function commandGone(cwd) {
  const basePath = getBaseWorktreePath(cwd);

  fetchAll(basePath);

  const goneLines = runCommand('git', ['branch', '-vv'], { cwd: basePath }).stdout;
  const goneBranches = goneLines
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.includes(': gone]'))
    .map((line) => line.replace(/^\*\s+/, '').split(/\s+/)[0])
    .filter(Boolean);

  if (!goneBranches.length) {
    process.stdout.write('No gone branches found\n');
    return 0;
  }

  const worktrees = listWorktrees(basePath);

  for (const branch of goneBranches) {
    const wt = worktrees.find((item) => item.branch === branch);
    if (wt) {
      process.stdout.write(`Removing worktree: ${wt.worktree}\n`);
      const removed = runCommand('git', ['worktree', 'remove', wt.worktree], {
        cwd: basePath,
        allowFailure: true
      });

      if (!removed.ok) {
        process.stderr.write(`Failed removing worktree ${wt.worktree}: ${removed.stderr}\n`);
        continue;
      }
    }

    process.stdout.write(`Deleting branch: ${branch}\n`);
    const deleted = runCommand('git', ['branch', '-d', branch], { cwd: basePath, allowFailure: true });
    if (!deleted.ok) {
      process.stderr.write(`Failed deleting branch ${branch}: ${deleted.stderr}\n`);
    }
  }

  return 0;
}

function commandCopy(cwd, argv) {
  const target = argv[0];
  if (!target) {
    throw new Error('Usage: linchpin wt copy <path>');
  }

  const basePath = getBaseWorktreePath(cwd);
  assertInLinkedWorktree(cwd, basePath);

  const currentPath = getCurrentTopLevel(cwd);
  const source = path.join(basePath, target);
  const destination = path.join(currentPath, target);

  if (!pathExists(source)) {
    throw new Error(`'${target}' does not exist in base worktree.`);
  }

  if (pathExists(destination)) {
    throw new Error(`'${target}' already exists in current worktree.`);
  }

  fs.cpSync(source, destination, { recursive: true });
  process.stdout.write(`Copied ${target}\n`);
  return 0;
}

function commandLink(cwd, argv) {
  const target = argv[0];
  if (!target) {
    throw new Error('Usage: linchpin wt link <path>');
  }

  const basePath = getBaseWorktreePath(cwd);
  assertInLinkedWorktree(cwd, basePath);

  const currentPath = getCurrentTopLevel(cwd);
  const source = path.join(basePath, target);
  const destination = path.join(currentPath, target);

  if (!pathExists(source)) {
    throw new Error(`'${target}' does not exist in base worktree.`);
  }

  if (pathExists(destination)) {
    throw new Error(`'${target}' already exists in current worktree.`);
  }

  const parent = path.dirname(destination);
  if (!pathExists(parent)) {
    fs.mkdirSync(parent, { recursive: true });
  }

  fs.symlinkSync(source, destination, fs.lstatSync(source).isDirectory() ? 'dir' : 'file');
  process.stdout.write(`Linked ${target}\n`);
  return 0;
}

function commandInvoke(cwd, argv) {
  const hookName = argv[0];
  if (!hookName) {
    throw new Error('Usage: linchpin wt invoke <hook>');
  }

  const basePath = getBaseWorktreePath(cwd);
  const hookFile = findHookFile(basePath, hookName);

  if (!hookFile) {
    throw new Error(`Hook '${hookName}' does not exist in .linchpin/hooks.`);
  }

  runHook(basePath, hookName);
  process.stdout.write(`Ran ${hookFile}\n`);
  return 0;
}

function commandConfig(cwd, argv) {
  const sub = argv[0] || 'help';

  if (sub === 'init') {
    const basePath = getBaseWorktreePath(cwd);
    const pluginSlug = readOptionValue(argv.slice(1), '--plugin-slug');
    const force = argv.includes('--force');

    const filePath = writeDefaultConfig(basePath, {
      force,
      pluginSlug
    });

    process.stdout.write(`Created ${filePath}\n`);
    process.stdout.write('Update environment paths before running linchpin wt switch.\n');
    return 0;
  }

  if (sub === 'show') {
    const basePath = getBaseWorktreePath(cwd);
    const config = readConfig(basePath);
    process.stdout.write(`${JSON.stringify(config, null, 2)}\n`);
    return 0;
  }

  printConfigHelp();
  return 0;
}

function parseSwitchArgs(argv) {
  let ref = null;
  let environment = null;
  let force = false;
  let dryRun = false;

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === '--env') {
      environment = argv[index + 1];
      index += 1;
      continue;
    }

    if (token.startsWith('--env=')) {
      environment = token.slice('--env='.length);
      continue;
    }

    if (token === '--force') {
      force = true;
      continue;
    }

    if (token === '--dry-run') {
      dryRun = true;
      continue;
    }

    if (!token.startsWith('-') && ref === null) {
      ref = token;
      continue;
    }

    throw new Error(`Unexpected argument '${token}' for 'linchpin wt switch'.`);
  }

  return {
    ref,
    environment,
    force,
    dryRun
  };
}

function readOptionValue(argv, flag) {
  const index = argv.indexOf(flag);
  if (index === -1) {
    return null;
  }

  const nextValue = argv[index + 1];
  if (!nextValue || nextValue.startsWith('-')) {
    throw new Error(`Expected a value after ${flag}.`);
  }

  return nextValue;
}

function assertInLinkedWorktree(cwd, basePath) {
  const current = safeRealpath(getCurrentTopLevel(cwd));
  const base = safeRealpath(basePath);

  if (current === base) {
    throw new Error('This command must be run inside a linked worktree (not base).');
  }
}

function pathExists(filePath) {
  return fs.existsSync(filePath);
}

function remoteHead(cwd) {
  return runCommand('git', ['symbolic-ref', 'refs/remotes/origin/HEAD'], { cwd }).stdout;
}

function fetchAll(cwd) {
  runCommand('git', ['fetch', '--all', '--prune', '--quiet'], { cwd });
}

function validateBranchName(branchName) {
  const result = runCommand('git', ['check-ref-format', '--branch', branchName], { allowFailure: true });
  if (!result.ok) {
    throw new Error(`Invalid branch name '${branchName}'.`);
  }
}

function branchWorktreePath(basePath, branchName) {
  return `${basePath}@${branchName}`;
}

function localBranchExists(cwd, branchName) {
  return runCommand('git', ['show-ref', '--verify', '--quiet', `refs/heads/${branchName}`], { allowFailure: true }).ok;
}

function remoteBranchExists(cwd, branchName) {
  return runCommand('git', ['show-ref', '--verify', '--quiet', `refs/remotes/origin/${branchName}`], {
    allowFailure: true
  }).ok;
}

function isMergedIntoRemoteHead(cwd, branchName) {
  const mergeCheck = runCommand('git', ['merge-base', '--is-ancestor', branchName, remoteHead(cwd)], {
    cwd,
    allowFailure: true
  });
  return mergeCheck.ok;
}

function hasCommand(commandName) {
  return runCommand('which', [commandName], { allowFailure: true }).ok;
}

function printWtHelp() {
  process.stdout.write(`linchpin wt\n\n`);
  process.stdout.write(`Usage:\n`);
  process.stdout.write(`  linchpin wt ls [--json]\n`);
  process.stdout.write(`  linchpin wt current [--link] [--env <name>]\n`);
  process.stdout.write(`  linchpin wt switch [worktree|branch] [--env <name>] [--force] [--dry-run]\n`);
  process.stdout.write(`  linchpin wt new [name]\n`);
  process.stdout.write(`  linchpin wt get <branch>\n`);
  process.stdout.write(`  linchpin wt extract\n`);
  process.stdout.write(`  linchpin wt mv <new-branch-name>\n`);
  process.stdout.write(`  linchpin wt del [-f|--force]\n`);
  process.stdout.write(`  linchpin wt cd [branch|path]\n`);
  process.stdout.write(`  linchpin wt home\n`);
  process.stdout.write(`  linchpin wt use\n`);
  process.stdout.write(`  linchpin wt gone\n`);
  process.stdout.write(`  linchpin wt copy <path>\n`);
  process.stdout.write(`  linchpin wt link <path>\n`);
  process.stdout.write(`  linchpin wt invoke <hook>\n`);
  process.stdout.write(`  linchpin wt config init [--plugin-slug <slug>] [--force]\n`);
  process.stdout.write(`  linchpin wt config show\n`);
  process.stdout.write(`\n`);
  process.stdout.write(`Tips:\n`);
  process.stdout.write(`  cd \"$(linchpin wt cd)\"               # interactive jump with fzf\n`);
  process.stdout.write(`  cd \"$(linchpin wt home)\"             # jump to base worktree\n`);
}

function printConfigHelp() {
  process.stdout.write('linchpin wt config\n\n');
  process.stdout.write('Usage:\n');
  process.stdout.write('  linchpin wt config init [--plugin-slug <slug>] [--force]\n');
  process.stdout.write('  linchpin wt config show\n');
}

module.exports = {
  runWt
};
