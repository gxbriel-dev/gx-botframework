const fs = require('fs');
const path = require('path');

class EventManager {
  constructor(client, projectRoot) {
    this.client = client;
    this.projectRoot = projectRoot;
    this.eventsPath = path.join(projectRoot, 'src', 'events');
    this._boundHandlers = [];
    this._bus = client.bus;
  }

  On(event, handler) {
    return this._bus.On(event, handler);
  }

  Once(event, handler) {
    return this._bus.Once(event, handler);
  }

  async Emit(event, payload) {
    return this._bus.Emit(event, payload);
  }

  Off(event, handler) {
    return this._bus.Off(event, handler);
  }

  _getEventFiles() {
    if (!fs.existsSync(this.eventsPath)) {
      fs.mkdirSync(this.eventsPath, { recursive: true });
      return [];
    }

    return fs
      .readdirSync(this.eventsPath)
      .filter((file) => file.endsWith('.js') && !file.startsWith('_') && file !== 'interactionCreate.js');
  }

  _clearCache(filePath) {
    delete require.cache[require.resolve(filePath)];
  }

  _removeBoundHandlers() {
    for (const { eventName, handler, once } of this._boundHandlers) {
      if (once) this.client.removeListener(eventName, handler);
      else this.client.off(eventName, handler);
    }
    this._boundHandlers = [];
  }

  async loadAll() {
    this._removeBoundHandlers();
    const files = this._getEventFiles();
    const db = this.client.db;
    const utils = this.client.utils;
    const container = this.client.container;

    for (const file of files) {
      const filePath = path.join(this.eventsPath, file);
      this._clearCache(filePath);
      const event = require(filePath);

      if (!event.name || typeof event.execute !== 'function') {
        console.warn(`[events] Überspringe ${file}: name oder execute fehlt.`);
        continue;
      }

      const handler = async (...args) => {
        await this._bus.Emit(`discord:before:${event.name}`, { args, file });
        const result = await event.execute(...args, this.client, db, utils, container);
        await this._bus.Emit(`discord:after:${event.name}`, { args, file });
        return result;
      };

      if (event.once) {
        this.client.once(event.name, handler);
      } else {
        this.client.on(event.name, handler);
      }

      this._boundHandlers.push({ eventName: event.name, handler, once: Boolean(event.once) });
      console.log(`[events] Geladen: ${event.name}`);
    }
  }

  async reload() {
    return this.loadAll();
  }
}

module.exports = EventManager;
