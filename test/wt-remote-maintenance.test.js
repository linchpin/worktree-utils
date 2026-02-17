const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { createFixture, runCli } = require('../test-utils/cli-fixture');

function assertOk(result, message) {
  assert.equal(result.code, 0, `${message}\nSTDERR:\n${result.stderr}`);
}

test(
  'wt remote and maintenance commands work',
  {
    timeout: 120_000
  },
  () => {
    const fixture = createFixture();

    const getRemote = runCli(fixture.basePath, ['wt', 'get', 'remote-only']);
    assertOk(getRemote, 'linchpin wt get should succeed');
    const remoteOnlyPath = getRemote.stdout;
    assert.ok(remoteOnlyPath.endsWith('@remote-only'));
    assert.equal(fs.existsSync(remoteOnlyPath), true);

    const extract = runCli(fixture.basePath, ['wt', 'extract']);
    assertOk(extract, 'linchpin wt extract should succeed');
    const extractedPath = extract.stdout;
    assert.ok(extractedPath.endsWith(`@${fixture.defaultBranch}`));
    assert.equal(fs.existsSync(extractedPath), true);

    const use = runCli(remoteOnlyPath, ['wt', 'use']);
    assertOk(use, 'linchpin wt use should succeed');
    assert.match(use.stdout, /Base switched to [a-f0-9]{12}/);

    const deleteRemoteOnly = runCli(remoteOnlyPath, ['wt', 'del', '--force']);
    assertOk(deleteRemoteOnly, 'linchpin wt del --force should delete remote-only worktree');
    assert.equal(fs.existsSync(remoteOnlyPath), false);

    const gone = runCli(fixture.basePath, ['wt', 'gone']);
    assertOk(gone, 'linchpin wt gone should succeed');
    assert.match(gone.stdout, /Deleting branch: gone-branch/);

    const configInit = runCli(fixture.basePath, ['wt', 'config', 'init', '--plugin-slug', 'override-plugin', '--force']);
    assertOk(configInit, 'linchpin wt config init --force should succeed');
    assert.match(configInit.stdout, /Created .*\.linchpin\.json/);

    const rewrittenConfig = JSON.parse(fs.readFileSync(path.join(fixture.basePath, '.linchpin.json'), 'utf8'));
    assert.equal(rewrittenConfig.wordpress.pluginSlug, 'override-plugin');
  }
);
