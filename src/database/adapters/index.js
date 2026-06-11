/**
 * Adapter-Registry für zukünftige @framework/redis, Postgres, SQLite-Packages.
 * Aktuell lädt DatabaseAdapter weiterhin src/database/db.js aus dem Bot-Projekt.
 */
const BaseAdapter = require('./BaseAdapter');

const ADAPTER_TYPES = ['json', 'mysql', 'none', 'postgres', 'sqlite', 'redis'];

module.exports = {
  BaseAdapter,
  ADAPTER_TYPES,
  // Platzhalter für zukünftige eingebaute Adapter
  postgres: null,
  sqlite: null,
  redis: null,
};
