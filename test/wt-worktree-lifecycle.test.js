const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { createFixture, runCli } = require('../test-utils/cli-fixture');

function assertOk(result, message) {
  assert.equal(result.code, 0, `${message}\nSTDERR:\n${result.stderr}`);
}

test(
  'wt lifecycle commands for local linked worktrees work',
  {
    timeout: 120_000
  },
  () => {
    const fixture = createFixture();

    const switchDryRun = runCli(fixture.basePath, ['wt', 'switch', '--dry-run', '--env', 'studio']);
    assertOk(switchDryRun, 'linchpin wt switch --dry-run should succeed');
    assert.match(switchDryRun.stderr, /Would create parent directory|Would create symlink|Already linked/);

    const createNew = runCli(fixture.basePath, ['wt', 'new', 'feature/smoke']);
    assertOk(createNew, 'linchpin wt new should succeed');
    const createdWorktree = createNew.stdout.split('\n').at(-1);
    assert.ok(createdWorktree.endsWith('@feature/smoke'));
    assert.equal(fs.existsSync(createdWorktree), true);

    const cdBranch = runCli(fixture.basePath, ['wt', 'cd', 'feature/smoke']);
    assertOk(cdBranch, 'linchpin wt cd <branch> should succeed');
    assert.equal(cdBranch.stdout, createdWorktree);

    const switchLinked = runCli(fixture.basePath, ['wt', 'switch', 'feature/smoke', '--env', 'studio']);
    assertOk(switchLinked, 'linchpin wt switch <branch> should succeed');
    assert.match(switchLinked.stderr, /Environment: studio/);
    assert.equal(fs.realpathSync(fixture.pluginPath), fs.realpathSync(createdWorktree));

    fs.rmSync(path.join(createdWorktree, 'COPY_SOURCE.txt'), { force: true });
    const copy = runCli(createdWorktree, ['wt', 'copy', 'COPY_SOURCE.txt']);
    assertOk(copy, 'linchpin wt copy should succeed');
    assert.match(copy.stdout, /Copied COPY_SOURCE\.txt/);
    assert.equal(fs.readFileSync(path.join(createdWorktree, 'COPY_SOURCE.txt'), 'utf8'), 'copy source\n');

    fs.rmSync(path.join(createdWorktree, 'LINK_SOURCE.txt'), { force: true });
    const link = runCli(createdWorktree, ['wt', 'link', 'LINK_SOURCE.txt']);
    assertOk(link, 'linchpin wt link should succeed');
    assert.match(link.stdout, /Linked LINK_SOURCE\.txt/);
    assert.equal(fs.lstatSync(path.join(createdWorktree, 'LINK_SOURCE.txt')).isSymbolicLink(), true);
    assert.equal(
      fs.realpathSync(path.join(createdWorktree, 'LINK_SOURCE.txt')),
      fs.realpathSync(path.join(fixture.basePath, 'LINK_SOURCE.txt'))
    );

    const move = runCli(createdWorktree, ['wt', 'mv', 'feature/renamed']);
    assertOk(move, 'linchpin wt mv should succeed');
    const renamedWorktree = move.stdout;
    assert.ok(renamedWorktree.endsWith('@feature/renamed'));
    assert.equal(fs.existsSync(renamedWorktree), true);
    assert.equal(fs.existsSync(createdWorktree), false);

    const deleteWithoutForce = runCli(renamedWorktree, ['wt', 'del']);
    assert.equal(deleteWithoutForce.code, 1);
    assert.match(deleteWithoutForce.stderr, /uncommitted changes|not merged/);

    const deleteWithForce = runCli(renamedWorktree, ['wt', 'del', '--force']);
    assertOk(deleteWithForce, 'linchpin wt del --force should succeed');
    assert.match(deleteWithForce.stdout, /Deleted feature\/renamed/);
    assert.equal(fs.existsSync(renamedWorktree), false);
  }
);
