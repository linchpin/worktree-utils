const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const CONFIG_FILE_NAME = '.linchpin.json';

function configPathFor(basePath) {
  return path.join(basePath, CONFIG_FILE_NAME);
}

function readConfig(basePath) {
  const filePath = configPathFor(basePath);

  if (!fs.existsSync(filePath)) {
    throw new Error(
      `Missing ${CONFIG_FILE_NAME} at ${basePath}. Run 'linchpin wt config init' to create one.`
    );
  }

  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    throw new Error(`Unable to parse ${CONFIG_FILE_NAME}: ${error.message}`);
  }

  return normalizeConfig(parsed);
}

const AGENT_VALUES = Object.freeze(['conductor', 'claude-code', 'codex', 'custom']);

/** Default base path per agent (repos live under this directory). Custom has no default. */
const AGENT_BASE_PATHS = Object.freeze({
  conductor: '~/conductor',
  'claude-code': '~/Documents',
  codex: '~/Documents/GitHub',
  custom: null
});

function getAgentBasePath(agent) {
  if (!agent || agent === 'custom') {
    return null;
  }
  const raw = AGENT_BASE_PATHS[agent];
  return raw ? path.resolve(expandHome(raw)) : null;
}

function normalizeConfig(input) {
  const root = input || {};
  const wp = root.wordpress || {};
  const environments = normalizeEnvironments(wp.environments || root.environments);

  if (!Object.keys(environments).length) {
    throw new Error('Config is missing wordpress.environments.');
  }

  const defaultEnvironment = wp.defaultEnvironment || Object.keys(environments)[0];

  if (!environments[defaultEnvironment]) {
    throw new Error(
      `Config defaultEnvironment '${defaultEnvironment}' is not defined in wordpress.environments.`
    );
  }

  const agent = root.agent && AGENT_VALUES.includes(root.agent) ? root.agent : null;
  const agentBasePath =
    typeof root.agentBasePath === 'string' && root.agentBasePath.trim()
      ? root.agentBasePath.trim()
      : null;

  return {
    agent,
    agentBasePath,
    wordpress: {
      pluginSlug: wp.pluginSlug || root.pluginSlug || null,
      defaultEnvironment,
      environments
    }
  };
}

function normalizeEnvironments(rawEnvironments) {
  if (!rawEnvironments) {
    return {};
  }

  if (Array.isArray(rawEnvironments)) {
    const normalized = {};
    for (const item of rawEnvironments) {
      if (!item || !item.name || !item.path) {
        continue;
      }
      normalized[item.name] = String(item.path);
    }
    return normalized;
  }

  if (typeof rawEnvironments === 'object') {
    return Object.fromEntries(
      Object.entries(rawEnvironments).map(([name, targetPath]) => [name, String(targetPath)])
    );
  }

  return {};
}

function expandHome(inputPath) {
  if (!inputPath || typeof inputPath !== 'string') {
    return inputPath;
  }

  if (inputPath === '~') {
    return os.homedir();
  }

  if (inputPath.startsWith('~/')) {
    return path.join(os.homedir(), inputPath.slice(2));
  }

  return inputPath;
}

function writeConfig(basePath, config, options = {}) {
  const filePath = configPathFor(basePath);

  if (fs.existsSync(filePath) && !options.force) {
    throw new Error(`${CONFIG_FILE_NAME} already exists. Use --force to overwrite it.`);
  }

  const payload = {
    ...(config.agent && { agent: config.agent }),
    ...(config.agentBasePath && { agentBasePath: config.agentBasePath }),
    wordpress: {
      pluginSlug: config.wordpress.pluginSlug,
      defaultEnvironment: config.wordpress.defaultEnvironment,
      environments: config.wordpress.environments
    }
  };

  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

  return filePath;
}

function writeDefaultConfig(basePath, options = {}) {
  const pluginSlug = options.pluginSlug || path.basename(basePath);

  const defaultConfig = {
    wordpress: {
      pluginSlug,
      defaultEnvironment: 'studio',
      environments: {
        studio: `/path/to/wordpress/wp-content/plugins/${pluginSlug}`,
        'wp-env': `/path/to/.wp-env/.../plugins/${pluginSlug}`,
        localwp: `${os.homedir()}/Local Sites/<site>/app/public/wp-content/plugins/${pluginSlug}`
      }
    }
  };

  return writeConfig(basePath, defaultConfig, options);
}

module.exports = {
  AGENT_BASE_PATHS,
  AGENT_VALUES,
  CONFIG_FILE_NAME,
  configPathFor,
  expandHome,
  getAgentBasePath,
  normalizeConfig,
  readConfig,
  writeConfig,
  writeDefaultConfig
};
