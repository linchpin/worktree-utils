const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const { createFixture, runCli } = require('../test-utils/cli-fixture');

function assertOk(result, message) {
  assert.equal(result.code, 0, `${message}\nSTDERR:\n${result.stderr}`);
}

test(
  'wt commands recover when current worktree gitdir points at a repointed symlink path',
  {
    timeout: 120_000
  },
  () => {
    const fixture = createFixture();

    const createNew = runCli(fixture.basePath, ['wt', 'new', 'feature/boise']);
    assertOk(createNew, 'linchpin wt new should succeed');
    const createdWorktree = createNew.stdout.split('\n').at(-1);

    const gitFilePath = path.join(createdWorktree, '.git');
    const gitFileContent = fs.readFileSync(gitFilePath, 'utf8').trim();
    const gitDirMatch = gitFileContent.match(/^gitdir:\s+(.+\/\.git\/worktrees\/([^/\n]+))$/);
    assert.ok(gitDirMatch, 'worktree .git file should include a gitdir worktree pointer');

    const worktreeId = gitDirMatch[2];
    const brokenGitdirPath = path.join(fixture.pluginPath, '.git', 'worktrees', worktreeId);
    fs.writeFileSync(gitFilePath, `gitdir: ${brokenGitdirPath}\n`, 'utf8');

    fs.mkdirSync(path.dirname(fixture.pluginPath), { recursive: true });
    fs.symlinkSync(createdWorktree, fixture.pluginPath, 'dir');

    const listFromSymlink = runCli(fixture.pluginPath, ['wt', 'ls']);
    assertOk(listFromSymlink, 'linchpin wt ls should recover from broken gitdir when run via symlink path');
    assert.match(listFromSymlink.stdout, /Worktrees/);

    const switchFromSymlink = runCli(fixture.pluginPath, ['wt', 'switch', 'feature/boise', '--env', 'studio']);
    assertOk(
      switchFromSymlink,
      'linchpin wt switch should recover from broken gitdir when run via symlink path'
    );
    assert.match(switchFromSymlink.stdout, /Environment: studio/);
  }
);

test(
  'wt commands recover for workspaces/<repo>/<branch> layout when gitdir points at symlink path',
  {
    timeout: 120_000
  },
  () => {
    const fixture = createFixture();
    const cleanEnv = Object.fromEntries(
      Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_'))
    );

    const createNew = runCli(fixture.basePath, ['wt', 'new', 'feature/boise']);
    assertOk(createNew, 'linchpin wt new should succeed');
    const createdWorktree = createNew.stdout.split('\n').at(-1);

    const movedWorktree = path.join(fixture.root, 'workspaces', 'plugin-repo', 'boise');
    fs.mkdirSync(path.dirname(movedWorktree), { recursive: true });
    execFileSync('git', ['worktree', 'move', createdWorktree, movedWorktree], {
      cwd: fixture.basePath,
      encoding: 'utf8',
      env: cleanEnv
    });

    const gitFilePath = path.join(movedWorktree, '.git');
    const gitFileContent = fs.readFileSync(gitFilePath, 'utf8').trim();
    const gitDirMatch = gitFileContent.match(/^gitdir:\s+(.+\/\.git\/worktrees\/([^/\n]+))$/);
    assert.ok(gitDirMatch, 'worktree .git file should include a gitdir worktree pointer');

    const worktreeId = gitDirMatch[2];
    const brokenGitdirPath = path.join(fixture.pluginPath, '.git', 'worktrees', worktreeId);
    fs.writeFileSync(gitFilePath, `gitdir: ${brokenGitdirPath}\n`, 'utf8');

    fs.mkdirSync(path.dirname(fixture.pluginPath), { recursive: true });
    fs.symlinkSync(movedWorktree, fixture.pluginPath, 'dir');

    const listFromSymlink = runCli(fixture.pluginPath, ['wt', 'ls']);
    assertOk(
      listFromSymlink,
      'linchpin wt ls should recover in workspaces/<repo>/<branch> layout when run via symlink path'
    );
    assert.match(listFromSymlink.stdout, /Worktrees/);
  }
);
