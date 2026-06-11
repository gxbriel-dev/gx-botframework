const fs = require('fs');
const path = require('path');

class AutoReloader {
  constructor(client) {
    this.client = client;
    this.projectRoot = client.projectRoot;
    this._watchers = [];
    this._timers = new Map();
    this._enabled = false;
  }

  _debounce(key, fn, delay = 800) {
    if (this._timers.has(key)) {
      clearTimeout(this._timers.get(key));
    }

    this._timers.set(
      key,
      setTimeout(async () => {
        this._timers.delete(key);
        try {
          await fn();
        } catch (error) {
          console.error(`[auto] Reload fehlgeschlagen (${key}):`, error);
        }
      }, delay)
    );
  }

  _watchDir(relativeDir, key, onReload) {
    const absoluteDir = path.join(this.projectRoot, relativeDir);

    if (!fs.existsSync(absoluteDir)) {
      fs.mkdirSync(absoluteDir, { recursive: true });
    }

    const watcher = fs.watch(absoluteDir, { recursive: true }, (_event, filename) => {
      if (!filename || !filename.endsWith('.js')) return;
      console.log(`[auto] Änderung erkannt: ${relativeDir}/${filename}`);
      this._debounce(key, onReload);
    });

    this._watchers.push(watcher);
  }

  _watchFile(relativePath, key, onReload) {
    const absolutePath = path.join(this.projectRoot, relativePath);
    const dir = path.dirname(absolutePath);
    const fileName = path.basename(absolutePath);

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    if (!fs.existsSync(absolutePath)) {
      fs.writeFileSync(absolutePath, '{}\n', 'utf8');
    }

    const watcher = fs.watch(dir, (_event, changed) => {
      if (changed !== fileName) return;
      console.log(`[auto] Änderung erkannt: ${relativePath}`);
      this._debounce(key, onReload);
    });

    this._watchers.push(watcher);
  }

  async _reloadCommands() {
    await this.client.commandManager.loadAll();
    if (this.client._token) {
      await this.client._deploySlashCommands(this.client._token);
    }
    console.log('[auto] Commands neu geladen und registriert.');
  }

  async _reloadEvents() {
    await this.client.eventManager.reload();
    console.log('[auto] Events neu geladen.');
  }

  async _reloadModules() {
    await this.client.moduleManager.reload();
    console.log('[auto] Module neu geladen.');
  }

  async _reloadApi() {
    if (!this.client.apiManager) return;
    await this.client.apiManager.restart();
    console.log('[auto] API-Routen neu geladen.');
  }

  async _reloadConfig() {
    this.client.config = this.client.configLoader.reload();
    if (this.client.componentLoader) {
      this.client.componentLoader.config = this.client.config;
    }
    if (this.client.apiManager) {
      this.client.apiManager.config = this.client.config;
    }
    console.log('[auto] config.json neu geladen.');
  }

  _reloadComponents() {
    if (this.client.componentLoader) {
      this.client.componentLoader.reload();
      console.log('[auto] components.json neu geladen.');
    }
  }

  start() {
    if (this._enabled) return;
    this._enabled = true;

    this._watchDir('src/commands', 'commands', () => this._reloadCommands());
    this._watchDir('src/events', 'events', () => this._reloadEvents());
    this._watchDir('src/modules', 'modules', () => this._reloadModules());
    this._watchDir('src/api', 'api', () => this._reloadApi());
    this._watchFile('config.json', 'config', () => this._reloadConfig());
    this._watchFile('src/data/components.json', 'components', () => this._reloadComponents());

    console.log('[auto] Datei-Watcher aktiv – neue .js-Dateien werden automatisch geladen.');
  }

  stop() {
    for (const watcher of this._watchers) {
      watcher.close();
    }
    this._watchers = [];
    this._enabled = false;
  }
}

module.exports = AutoReloader;
