const test = require('node:test');
const assert = require('node:assert/strict');

const { normalizeConfig } = require('../src/lib/config');

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
