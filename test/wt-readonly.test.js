const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const { canonicalPath, createFixture, runCli } = require('../test-utils/cli-fixture');

function assertOk(result, message) {
  assert.equal(result.code, 0, `${message}\nSTDERR:\n${result.stderr}`);
}

test(
  'wt read-only and informational commands work',
  {
    timeout: 60_000
  },
  () => {
    const fixture = createFixture();

    const wtHelp = runCli(fixture.basePath, ['wt', 'help']);
    assertOk(wtHelp, 'linchpin wt help should succeed');
    assert.match(wtHelp.stdout, /linchpin wt/);

    const configShow = runCli(fixture.basePath, ['wt', 'config', 'show']);
    assertOk(configShow, 'linchpin wt config show should succeed');
    const shown = JSON.parse(configShow.stdout);
    assert.equal(shown.wordpress.defaultEnvironment, 'studio');

    const listPlain = runCli(fixture.basePath, ['wt', 'ls']);
    assertOk(listPlain, 'linchpin wt ls should succeed');
    assert.match(listPlain.stdout, /Worktrees/);

    const listJson = runCli(fixture.basePath, ['wt', 'ls', '--json']);
    assertOk(listJson, 'linchpin wt ls --json should succeed');
    const listed = JSON.parse(listJson.stdout);
    assert.equal(Array.isArray(listed), true);
    assert.ok(listed.some((item) => item.current === true));

    const current = runCli(fixture.basePath, ['wt', 'current']);
    assertOk(current, 'linchpin wt current should succeed');
    const currentPayload = JSON.parse(current.stdout);
    assert.equal(currentPayload.branch, fixture.defaultBranch);

    const currentLink = runCli(fixture.basePath, ['wt', 'current', '--link', '--env', 'studio']);
    assertOk(currentLink, 'linchpin wt current --link should succeed');
    const currentLinkPayload = JSON.parse(currentLink.stdout);
    assert.equal(currentLinkPayload.linkPath, path.resolve(fixture.pluginPath));

    const home = runCli(fixture.basePath, ['wt', 'home']);
    assertOk(home, 'linchpin wt home should succeed');
    assert.equal(canonicalPath(home.stdout), canonicalPath(fixture.basePath));

    const invoke = runCli(fixture.basePath, ['wt', 'invoke', 'pre-new']);
    assertOk(invoke, 'linchpin wt invoke should succeed');
    assert.match(invoke.stdout, /Ran .*\.linchpin\/hooks\/pre-new$/);
  }
);
