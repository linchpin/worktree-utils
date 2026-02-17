const test = require('node:test');
const assert = require('node:assert/strict');

const { createFixture, runCli } = require('../test-utils/cli-fixture');

function assertOk(result, message) {
  assert.equal(result.code, 0, `${message}\nSTDERR:\n${result.stderr}`);
}

test('top-level CLI commands work', () => {
  const fixture = createFixture();

  const help = runCli(fixture.basePath, ['--help']);
  assertOk(help, 'linchpin --help should succeed');
  assert.match(help.stdout, /Usage:/);

  const version = runCli(fixture.basePath, ['--version']);
  assertOk(version, 'linchpin --version should succeed');
  assert.match(version.stdout, /^0\.1\.0$/);

  const unknown = runCli(fixture.basePath, ['unknown']);
  assert.equal(unknown.code, 1);
  assert.match(unknown.stderr, /Unknown command 'unknown'/);
});
