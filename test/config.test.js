const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  normalizeConfig,
  normalizePostSwitchCommands,
  writeConfig,
  writeDefaultConfig
} = require('../src/lib/config');

test('normalizeConfig accepts object environments', () => {
  const config = normalizeConfig({
    wordpress: {
      defaultEnvironment: 'studio',
      environments: {
        studio: '/tmp/studio/plugin',
        localwp: '/tmp/localwp/plugin'
      }
    }
  });

  assert.equal(config.wordpress.defaultEnvironment, 'studio');
  assert.equal(config.wordpress.environments.localwp, '/tmp/localwp/plugin');
});

test('normalizeConfig accepts array environments', () => {
  const config = normalizeConfig({
    environments: [
      { name: 'studio', path: '/tmp/studio/plugin' },
      { name: 'localwp', path: '/tmp/localwp/plugin' }
    ]
  });

  assert.equal(config.wordpress.defaultEnvironment, 'studio');
  assert.equal(config.wordpress.environments.studio, '/tmp/studio/plugin');
});

test('writeConfig stores home-based paths using ~', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'linchpin-config-'));
  const home = os.homedir();
  const homeStudioPath = path.join(home, 'Local Sites', 'Example', 'app', 'public', 'wp-content', 'plugins', 'plugin');

  writeConfig(tempDir, {
    agentBasePath: path.join(home, 'Documents', 'GitHub'),
    wordpress: {
      pluginSlug: 'plugin',
      defaultEnvironment: 'studio',
      environments: {
        studio: homeStudioPath,
        ci: '/tmp/plugin'
      }
    }
  });

  const saved = JSON.parse(fs.readFileSync(path.join(tempDir, '.linchpin.json'), 'utf8'));
  assert.equal(saved.agentBasePath, '~/Documents/GitHub');
  assert.equal(saved.wordpress.environments.studio, '~/Local Sites/Example/app/public/wp-content/plugins/plugin');
  assert.equal(saved.wordpress.environments.ci, '/tmp/plugin');

  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('writeDefaultConfig stores localwp path with ~', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'linchpin-config-default-'));
  writeDefaultConfig(tempDir, { pluginSlug: 'sample-plugin' });

  const saved = JSON.parse(fs.readFileSync(path.join(tempDir, '.linchpin.json'), 'utf8'));
  assert.match(saved.wordpress.environments.localwp, /^~\/Local Sites\//);

  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('normalizePostSwitchCommands handles array of strings', () => {
  const result = normalizePostSwitchCommands(['composer install', 'npm run build']);
  assert.deepEqual(result, ['composer install', 'npm run build']);
});

test('normalizePostSwitchCommands handles single string', () => {
  const result = normalizePostSwitchCommands('composer install');
  assert.deepEqual(result, ['composer install']);
});

test('normalizePostSwitchCommands filters non-string and empty values', () => {
  const result = normalizePostSwitchCommands(['composer install', '', null, 42, 'npm run build']);
  assert.deepEqual(result, ['composer install', 'npm run build']);
});

test('normalizePostSwitchCommands returns empty array for falsy input', () => {
  assert.deepEqual(normalizePostSwitchCommands(undefined), []);
  assert.deepEqual(normalizePostSwitchCommands(null), []);
  assert.deepEqual(normalizePostSwitchCommands(false), []);
});

test('normalizeConfig includes postSwitchCommands when present', () => {
  const config = normalizeConfig({
    postSwitchCommands: ['composer install', 'npm run build'],
    wordpress: {
      defaultEnvironment: 'studio',
      environments: { studio: '/tmp/studio/plugin' }
    }
  });

  assert.deepEqual(config.postSwitchCommands, ['composer install', 'npm run build']);
});

test('normalizeConfig defaults postSwitchCommands to empty array', () => {
  const config = normalizeConfig({
    wordpress: {
      defaultEnvironment: 'studio',
      environments: { studio: '/tmp/studio/plugin' }
    }
  });

  assert.deepEqual(config.postSwitchCommands, []);
});

test('writeConfig persists postSwitchCommands', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'linchpin-config-hooks-'));

  writeConfig(tempDir, {
    wordpress: {
      pluginSlug: 'plugin',
      defaultEnvironment: 'studio',
      environments: { studio: '/tmp/plugin' }
    },
    postSwitchCommands: ['composer install', 'npm run build']
  });

  const saved = JSON.parse(fs.readFileSync(path.join(tempDir, '.linchpin.json'), 'utf8'));
  assert.deepEqual(saved.postSwitchCommands, ['composer install', 'npm run build']);

  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('writeConfig omits postSwitchCommands when empty', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'linchpin-config-hooks-empty-'));

  writeConfig(tempDir, {
    wordpress: {
      pluginSlug: 'plugin',
      defaultEnvironment: 'studio',
      environments: { studio: '/tmp/plugin' }
    },
    postSwitchCommands: []
  });

  const saved = JSON.parse(fs.readFileSync(path.join(tempDir, '.linchpin.json'), 'utf8'));
  assert.equal(saved.postSwitchCommands, undefined);

  fs.rmSync(tempDir, { recursive: true, force: true });
});
