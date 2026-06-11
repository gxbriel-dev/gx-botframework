const fs = require('fs');
const path = require('path');

const STORE_PATH = path.join(__dirname, '..', 'data', 'store.json');

class JsonDatabase {
  constructor() {
    this._data = {};
    this._connected = false;
  }

  _readFile() {
    if (!fs.existsSync(STORE_PATH)) {
      fs.writeFileSync(STORE_PATH, '{}', 'utf8');
    }

    const raw = fs.readFileSync(STORE_PATH, 'utf8');
    return raw.trim() ? JSON.parse(raw) : {};
  }

  _writeFile() {
    fs.writeFileSync(STORE_PATH, JSON.stringify(this._data, null, 2), 'utf8');
  }

  async connect() {
    this._data = this._readFile();
    this._connected = true;
    console.log('[db] JSON-Datenbank verbunden:', STORE_PATH);
  }

  async disconnect() {
    if (this._connected) {
      this._writeFile();
      this._connected = false;
      console.log('[db] JSON-Datenbank getrennt.');
    }
  }

  async get(key) {
    return this._data[key] ?? null;
  }

  async set(key, value) {
    this._data[key] = value;
    this._writeFile();
    return value;
  }

  async delete(key) {
    const existed = Object.prototype.hasOwnProperty.call(this._data, key);
    delete this._data[key];
    if (existed) this._writeFile();
    return existed;
  }

  async has(key) {
    return Object.prototype.hasOwnProperty.call(this._data, key);
  }

  async all() {
    return { ...this._data };
  }

  async clear() {
    this._data = {};
    this._writeFile();
  }
}

module.exports = new JsonDatabase();
