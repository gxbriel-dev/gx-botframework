class NoDatabase {
  constructor() {
    this._store = new Map();
    this._connected = false;
  }

  async connect() {
    this._connected = true;
    console.log('[db] Keine Persistenz aktiv (In-Memory-Stub).');
  }

  async disconnect() {
    this._store.clear();
    this._connected = false;
    console.log('[db] In-Memory-Stub geleert.');
  }

  async get(key) {
    return this._store.has(key) ? this._store.get(key) : null;
  }

  async set(key, value) {
    this._store.set(key, value);
    return value;
  }

  async delete(key) {
    return this._store.delete(key);
  }

  async has(key) {
    return this._store.has(key);
  }

  async all() {
    return Object.fromEntries(this._store.entries());
  }

  async clear() {
    this._store.clear();
  }
}

module.exports = new NoDatabase();
