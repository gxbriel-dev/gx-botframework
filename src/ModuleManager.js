const fs = require('fs');
const path = require('path');

class ModuleManager {
  constructor(client, projectRoot) {
    this.client = client;
    this.projectRoot = projectRoot;
    this.modulesPath = path.join(projectRoot, 'src', 'modules');
    this._loadedModules = [];
  }

  _discoverModuleEntries() {
    if (!fs.existsSync(this.modulesPath)) {
      fs.mkdirSync(this.modulesPath, { recursive: true });
      return [];
    }

    const entries = [];

    for (const entry of fs.readdirSync(this.modulesPath, { withFileTypes: true })) {
      if (entry.name.startsWith('_')) continue;

      if (entry.isFile() && entry.name.endsWith('.js')) {
        entries.push({
          name: path.basename(entry.name, '.js'),
          mainPath: path.join(this.modulesPath, entry.name),
          rootPath: null,
        });
        continue;
      }

      if (entry.isDirectory()) {
        const indexPath = path.join(this.modulesPath, entry.name, 'index.js');
        if (fs.existsSync(indexPath)) {
          entries.push({
            name: entry.name,
            mainPath: indexPath,
            rootPath: path.join(this.modulesPath, entry.name),
          });
        }
      }
    }

    return entries;
  }

  _clearCache(filePath) {
    delete require.cache[require.resolve(filePath)];
  }

  _clearDirectoryCache(dirPath) {
    if (!dirPath || !fs.existsSync(dirPath)) return;
    for (const file of fs.readdirSync(dirPath)) {
      if (!file.endsWith('.js')) continue;
      const filePath = path.join(dirPath, file);
      this._clearCache(filePath);
    }
  }

  async _invokeLifecycle(mod, hook, ...args) {
    if (typeof mod[hook] === 'function') {
      await mod[hook](...args);
    }
  }

  async disableAll() {
    for (const entry of [...this._loadedModules].reverse()) {
      try {
        await this._invokeLifecycle(entry.module, 'onDisable', this.client);
        await this._invokeLifecycle(entry.module, 'destroy', this.client);
      } catch (error) {
        console.error(`[modules] Fehler beim Deaktivieren von ${entry.name}:`, error);
      }
    }
    this._loadedModules = [];
  }

  async destroyAll() {
    return this.disableAll();
  }

  async _loadModuleSubresources(entry, mod) {
    if (!entry.rootPath) return;

    const subdirs = ['commands', 'events', 'middleware', 'services', 'providers'];
    for (const sub of subdirs) {
      const subPath = path.join(entry.rootPath, sub);
      if (!fs.existsSync(subPath)) continue;
      console.log(`[modules] ${entry.name}/${sub} erkannt (Drop-in über Haupt-Loader)`);
    }
  }

  async loadAll() {
    await this.disableAll();

    const entries = this._discoverModuleEntries();
    const config = this.client.config;
    const db = this.client.db;
    const utils = this.client.utils;
    const container = this.client.container;
    const deps = { db, utils, config, container, client: this.client };

    for (const entry of entries) {
      this._clearCache(entry.mainPath);
      this._clearDirectoryCache(entry.rootPath);
      const mod = require(entry.mainPath);

      if (mod.services) {
        this.client.container.registerModuleServices(mod.services, this.client);
      }

      if (mod.providers && Array.isArray(mod.providers)) {
        for (const provider of mod.providers) {
          if (typeof provider === 'function') provider(this.client, container);
        }
      }

      await this._invokeLifecycle(mod, 'onLoad', this.client, deps);
      await this._invokeLifecycle(mod, 'init', this.client, deps);
      await this._invokeLifecycle(mod, 'onEnable', this.client, deps);

      await this._loadModuleSubresources(entry, mod);

      this._loadedModules.push({ name: entry.name, module: mod, entry });
      console.log(`[modules] Aktiviert: ${entry.name}`);
    }
  }

  async reload() {
    for (const entry of this._loadedModules) {
      try {
        await this._invokeLifecycle(entry.module, 'onReload', this.client);
      } catch (error) {
        console.error(`[modules] onReload fehlgeschlagen (${entry.name}):`, error);
      }
    }
    return this.loadAll();
  }
}

module.exports = ModuleManager;
