const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { ensurePluginLink } = require('../src/lib/symlink');

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'linchpin-'));
}

test('ensurePluginLink creates and repoints symlink', () => {
  const root = makeTempDir();
  const sourceA = path.join(root, 'repo@a');
  const sourceB = path.join(root, 'repo@b');
  const target = path.join(root, 'wp-content', 'plugins', 'my-plugin');

  fs.mkdirSync(sourceA, { recursive: true });
  fs.mkdirSync(sourceB, { recursive: true });

  const first = ensurePluginLink({ sourcePath: sourceA, targetPath: target });
  assert.equal(first.changed, true);

  const firstReal = fs.realpathSync(target);
  assert.equal(firstReal, fs.realpathSync(sourceA));

  const second = ensurePluginLink({ sourcePath: sourceB, targetPath: target });
  assert.equal(second.changed, true);

  const secondReal = fs.realpathSync(target);
  assert.equal(secondReal, fs.realpathSync(sourceB));
});
