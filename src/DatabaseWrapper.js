const path = require('path');

function splitPath(dotPath) {
  if (!dotPath || typeof dotPath !== 'string' || !dotPath.trim()) {
    return [];
  }
  return dotPath.split('.').filter(Boolean);
}

function getAtPath(target, dotPath) {
  const parts = splitPath(dotPath);
  if (parts.length === 0) return target;

  let current = target;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    current = current[part];
  }
  return current;
}

function setAtPath(target, dotPath, value) {
  const parts = splitPath(dotPath);
  if (parts.length === 0) return value;

  const root = target !== null && typeof target === 'object' && !Array.isArray(target)
    ? { ...target }
    : {};

  let current = root;
  for (let i = 0; i < parts.length - 1; i += 1) {
    const part = parts[i];
    const next = current[part];
    if (next !== null && typeof next === 'object' && !Array.isArray(next)) {
      current[part] = { ...next };
    } else {
      current[part] = {};
    }
    current = current[part];
  }

  current[parts[parts.length - 1]] = value;
  return root;
}

function deleteAtPath(target, dotPath) {
  const parts = splitPath(dotPath);
  if (parts.length === 0) return null;

  if (target === null || typeof target !== 'object') return target;

  const root = Array.isArray(target) ? [...target] : { ...target };
  let current = root;

  for (let i = 0; i < parts.length - 1; i += 1) {
    const part = parts[i];
    if (current[part] === undefined) return root;
    current = current[part];
    if (current === null || typeof current !== 'object') return root;
  }

  delete current[parts[parts.length - 1]];
  return root;
}

function hasAtPath(target, dotPath) {
  const parts = splitPath(dotPath);
  if (parts.length === 0) return target !== undefined && target !== null;

  let current = target;
  for (const part of parts) {
    if (current === null || current === undefined) return false;
    if (!Object.prototype.hasOwnProperty.call(current, part)) return false;
    current = current[part];
  }
  return true;
}

class DatabaseWrapper {
  constructor(projectRoot, config) {
    this.projectRoot = projectRoot;
    this.config = config;
    this._adapter = null;
    this._connected = false;
  }

  _loadAdapter() {
    const dbPath = path.join(this.projectRoot, 'src', 'database', 'db.js');
    delete require.cache[require.resolve(dbPath)];
    this._adapter = require(dbPath);
    return this._adapter;
  }

  async connect() {
    this._loadAdapter();
    if (typeof this._adapter.connect === 'function') {
      await this._adapter.connect();
    }
    this._connected = true;
    console.log(`[db] Wrapper verbunden (Typ: ${this.config.database.type}).`);
  }

  async disconnect() {
    if (this._adapter && typeof this._adapter.disconnect === 'function') {
      await this._adapter.disconnect();
    }
    this._connected = false;
    console.log('[db] Wrapper getrennt.');
  }

  async get(key, dotPath) {
    const record = await this._adapter.get(key);
    if (record === null || record === undefined) return null;
    if (!dotPath) return record;
    const value = getAtPath(record, dotPath);
    return value === undefined ? null : value;
  }

  async set(key, value, dotPath) {
    if (!dotPath) {
      return this._adapter.set(key, value);
    }

    const existing = await this._adapter.get(key);
    const base = existing !== null && typeof existing === 'object' ? existing : {};
    const updated = setAtPath(base, dotPath, value);
    return this._adapter.set(key, updated);
  }

  async delete(key, dotPath) {
    if (!dotPath) {
      return this._adapter.delete(key);
    }

    const existing = await this._adapter.get(key);
    if (existing === null || typeof existing !== 'object') {
      return false;
    }

    const updated = deleteAtPath(existing, dotPath);
    await this._adapter.set(key, updated);
    return true;
  }

  async has(key, dotPath) {
    const record = await this._adapter.get(key);
    if (record === null || record === undefined) return false;
    if (!dotPath) return true;
    return hasAtPath(record, dotPath);
  }

  async incr(key, amount = 1, dotPath) {
    const current = (await this.get(key, dotPath)) ?? 0;
    if (typeof current !== 'number' || Number.isNaN(current)) {
      throw new Error(`[db] incr: Wert unter "${key}${dotPath ? `.${dotPath}` : ''}" ist keine Zahl.`);
    }
    const next = current + amount;
    await this.set(key, next, dotPath);
    return next;
  }

  async decr(key, amount = 1, dotPath) {
    return this.incr(key, -amount, dotPath);
  }

  async all() {
    if (typeof this._adapter.all === 'function') {
      return this._adapter.all();
    }
    return {};
  }

  async clear() {
    if (typeof this._adapter.clear === 'function') {
      return this._adapter.clear();
    }
    return undefined;
  }
}

module.exports = DatabaseWrapper;
