const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
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

    const hooksHelp = runCli(fixture.basePath, ['wt', 'config', 'hooks', 'help']);
    assertOk(hooksHelp, 'linchpin wt config hooks help should succeed');
    assert.match(hooksHelp.stdout, /post-switch/i);
  }
);

test(
  'wt config hooks add/list/remove cycle works',
  {
    timeout: 60_000
  },
  () => {
    const fixture = createFixture();

    const listEmpty = runCli(fixture.basePath, ['wt', 'config', 'hooks', 'list']);
    assertOk(listEmpty, 'hooks list should succeed when empty');
    assert.match(listEmpty.stdout, /No post-switch commands/);

    const add1 = runCli(fixture.basePath, ['wt', 'config', 'hooks', 'add', 'composer install']);
    assertOk(add1, 'hooks add should succeed');
    assert.match(add1.stdout, /Added.*composer install/);

    const add2 = runCli(fixture.basePath, ['wt', 'config', 'hooks', 'add', 'npm install && npm run build']);
    assertOk(add2, 'hooks add should succeed for second command');
    assert.match(add2.stdout, /Added.*npm install/);

    const listTwo = runCli(fixture.basePath, ['wt', 'config', 'hooks', 'list']);
    assertOk(listTwo, 'hooks list should show both commands');
    assert.match(listTwo.stdout, /1\.\s+composer install/);
    assert.match(listTwo.stdout, /2\.\s+npm install && npm run build/);

    const configJson = JSON.parse(
      fs.readFileSync(path.join(fixture.basePath, '.linchpin.json'), 'utf8')
    );
    assert.deepEqual(configJson.postSwitchCommands, [
      'composer install',
      'npm install && npm run build'
    ]);

    const remove = runCli(fixture.basePath, ['wt', 'config', 'hooks', 'remove', '1']);
    assertOk(remove, 'hooks remove should succeed');
    assert.match(remove.stdout, /Removed.*composer install/);

    const listOne = runCli(fixture.basePath, ['wt', 'config', 'hooks', 'list']);
    assertOk(listOne, 'hooks list should show remaining command');
    assert.match(listOne.stdout, /1\.\s+npm install && npm run build/);
    assert.doesNotMatch(listOne.stdout, /composer install/);

    const removeLast = runCli(fixture.basePath, ['wt', 'config', 'hooks', 'rm', '1']);
    assertOk(removeLast, 'hooks rm alias should work');

    const listFinal = runCli(fixture.basePath, ['wt', 'config', 'hooks', 'ls']);
    assertOk(listFinal, 'hooks ls alias should work');
    assert.match(listFinal.stdout, /No post-switch commands/);

    const updatedJson = JSON.parse(
      fs.readFileSync(path.join(fixture.basePath, '.linchpin.json'), 'utf8')
    );
    assert.equal(updatedJson.postSwitchCommands, undefined);
  }
);

test(
  'wt config hooks remove rejects invalid index',
  {
    timeout: 60_000
  },
  () => {
    const fixture = createFixture();

    const addCmd = runCli(fixture.basePath, ['wt', 'config', 'hooks', 'add', 'echo test']);
    assertOk(addCmd, 'hooks add should succeed');

    const badIndex = runCli(fixture.basePath, ['wt', 'config', 'hooks', 'remove', '5']);
    assert.notEqual(badIndex.code, 0, 'hooks remove with out-of-range index should fail');

    const zeroIndex = runCli(fixture.basePath, ['wt', 'config', 'hooks', 'remove', '0']);
    assert.notEqual(zeroIndex.code, 0, 'hooks remove with index 0 should fail');
  }
);
