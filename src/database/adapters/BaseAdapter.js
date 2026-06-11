/**
 * Basis-Interface für Database-Adapter.
 * Bot-Projekte können eigene Adapter in src/database/db.js exportieren
 * oder zukünftig eingebaute Adapter (Postgres, SQLite) nutzen.
 */
class BaseAdapter {
  async connect() {
    throw new Error('connect() nicht implementiert');
  }

  async disconnect() {
    throw new Error('disconnect() nicht implementiert');
  }

  async get(_key) {
    throw new Error('get() nicht implementiert');
  }

  async set(_key, _value) {
    throw new Error('set() nicht implementiert');
  }

  async delete(_key) {
    throw new Error('delete() nicht implementiert');
  }

  async has(_key) {
    throw new Error('has() nicht implementiert');
  }
}

module.exports = BaseAdapter;
