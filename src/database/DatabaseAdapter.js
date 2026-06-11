const DatabaseWrapper = require('../DatabaseWrapper');

class DatabaseAdapter {
  constructor(projectRoot, config) {
    this._wrapper = new DatabaseWrapper(projectRoot, config);
    this._connected = false;
  }

  get wrapper() {
    return this._wrapper;
  }

  async Connect() {
    await this._wrapper.connect();
    this._connected = true;
    return this;
  }

  async Disconnect() {
    await this._wrapper.disconnect();
    this._connected = false;
    return this;
  }

  async Get(key, path) {
    return this._wrapper.get(key, path);
  }

  async Set(key, value, path) {
    return this._wrapper.set(key, value, path);
  }

  async Delete(key, path) {
    return this._wrapper.delete(key, path);
  }

  async Has(key, path) {
    return this._wrapper.has(key, path);
  }

  async Incr(key, amount = 1, path) {
    return this._wrapper.incr(key, amount, path);
  }

  async Decr(key, amount = 1, path) {
    return this._wrapper.decr(key, amount, path);
  }

  async All() {
    return this._wrapper.all();
  }

  async Clear() {
    return this._wrapper.clear();
  }

  // Backward compatibility – lowercase API
  connect() { return this.Connect(); }
  disconnect() { return this.Disconnect(); }
  get(key, path) { return this.Get(key, path); }
  set(key, value, path) { return this.Set(key, value, path); }
  delete(key, path) { return this.Delete(key, path); }
  has(key, path) { return this.Has(key, path); }
  incr(key, amount, path) { return this.Incr(key, amount, path); }
  decr(key, amount, path) { return this.Decr(key, amount, path); }
  all() { return this.All(); }
  clear() { return this.Clear(); }
}

module.exports = DatabaseAdapter;
