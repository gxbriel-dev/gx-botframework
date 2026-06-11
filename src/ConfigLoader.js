const path = require('path');
const fs = require('fs');
const { validateConfig, withDefaults } = require('./configValidator');

class ConfigLoader {
  constructor(projectRoot) {
    this.projectRoot = projectRoot;
    this.config = null;
    this.schema = null;
  }

  _readJson(filePath) {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  }

  _applyEnvOverrides(config) {
    const result = structuredClone(config);

    if (process.env.API_PORT) {
      result.api = result.api || {};
      result.api.port = Number(process.env.API_PORT);
    }

    if (process.env.CLIENT_ID) {
      result.oauth = result.oauth || {};
      result.oauth.clientId = process.env.CLIENT_ID;
    }

    if (process.env.CLIENT_SECRET) {
      result.oauth = result.oauth || {};
      result.oauth.clientSecret = process.env.CLIENT_SECRET;
    }

    return result;
  }

  load() {
    const configPath = path.join(this.projectRoot, 'config.json');
    const schemaPath = path.join(this.projectRoot, 'config.schema.json');

    if (!fs.existsSync(configPath)) {
      console.error('[config] config.json nicht gefunden:', configPath);
      process.exit(1);
    }

    if (!fs.existsSync(schemaPath)) {
      console.error('[config] config.schema.json nicht gefunden:', schemaPath);
      process.exit(1);
    }

    let rawConfig;
    try {
      rawConfig = this._readJson(configPath);
    } catch (error) {
      console.error('[config] config.json ist ungültiges JSON:', error.message);
      process.exit(1);
    }

    let schema;
    try {
      schema = this._readJson(schemaPath);
    } catch (error) {
      console.error('[config] config.schema.json ist ungültiges JSON:', error.message);
      process.exit(1);
    }

    this.schema = schema;
    const merged = this._applyEnvOverrides(rawConfig);
    const configWithDefaults = withDefaults(schema, merged);
    const { valid, errors } = validateConfig(schema, configWithDefaults);

    if (!valid) {
      console.error('[config] Konfigurationsvalidierung fehlgeschlagen:');
      for (const error of errors) {
        console.error(`  ✖ ${error}`);
      }
      process.exit(1);
    }

    this.config = Object.freeze(structuredClone(configWithDefaults));
    console.log('[config] config.json geladen, validiert und eingefroren.');
    return this.config;
  }

  get() {
    if (!this.config) {
      return this.load();
    }
    return this.config;
  }

  reload() {
    return this.load();
  }
}

module.exports = ConfigLoader;
