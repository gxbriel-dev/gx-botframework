const fs = require('fs');
const path = require('path');
const { Collection } = require('discord.js');

class CommandManager {
  constructor(client, projectRoot) {
    this.client = client;
    this.projectRoot = projectRoot;
    this.commands = new Collection();
    this.cooldowns = new Map();
    this.commandsPath = path.join(projectRoot, 'src', 'commands');
  }

  _getCommandFiles() {
    if (!fs.existsSync(this.commandsPath)) {
      fs.mkdirSync(this.commandsPath, { recursive: true });
      return [];
    }

    return fs
      .readdirSync(this.commandsPath)
      .filter((file) => file.endsWith('.js') && !file.startsWith('_'));
  }

  _resolveCommandPath(nameOrFile) {
    const directPath = path.join(this.commandsPath, `${nameOrFile}.js`);
    if (fs.existsSync(directPath)) return directPath;

    for (const file of this._getCommandFiles()) {
      const filePath = path.join(this.commandsPath, file);
      this._clearCache(filePath);
      const cmd = require(filePath);
      const cmdName = cmd.name || cmd.data?.name;
      if (cmdName === nameOrFile) return filePath;
    }

    return null;
  }

  _clearCache(filePath) {
    const resolved = require.resolve(filePath);
    delete require.cache[resolved];
  }

  _extractCommandName(cmdObj, filePath) {
    if (cmdObj.name) return cmdObj.name;
    if (cmdObj.data?.name) return cmdObj.data.name;
    return path.basename(filePath, '.js');
  }

  _validateCommand(cmdObj, filePath) {
    if (!cmdObj || typeof cmdObj.execute !== 'function') {
      throw new Error(`[commands] ${filePath}: execute() fehlt.`);
    }

    if (!cmdObj.data && !cmdObj.name) {
      throw new Error(`[commands] ${filePath}: data (SlashCommandBuilder) oder name fehlt.`);
    }
  }

  async loadAll() {
    this.commands.clear();
    const files = this._getCommandFiles();

    for (const file of files) {
      const filePath = path.join(this.commandsPath, file);
      this._clearCache(filePath);
      const cmdObj = require(filePath);
      this._validateCommand(cmdObj, filePath);
      const name = this._extractCommandName(cmdObj, filePath);
      cmdObj._filePath = filePath;
      cmdObj._fileName = file;
      this.commands.set(name, cmdObj);
      console.log(`[commands] Geladen: ${name}`);
    }

    return this.commands;
  }

  RegisterCommand(cmdObj) {
    this._validateCommand(cmdObj, 'inline');
    const name = this._extractCommandName(cmdObj, 'inline');
    this.commands.set(name, cmdObj);
    console.log(`[commands] Registriert: ${name}`);
    return cmdObj;
  }

  UnregisterCommand(name) {
    const removed = this.commands.delete(name);
    if (removed) {
      console.log(`[commands] Entfernt: ${name}`);
    }
    return removed;
  }

  async ReloadCommand(name) {
    const filePath = this._resolveCommandPath(name);
    if (!filePath) {
      throw new Error(`[commands] Command "${name}" nicht gefunden.`);
    }

    this._clearCache(filePath);
    const cmdObj = require(filePath);
    this._validateCommand(cmdObj, filePath);
    const cmdName = this._extractCommandName(cmdObj, filePath);
    cmdObj._filePath = filePath;
    cmdObj._fileName = path.basename(filePath);
    this.commands.set(cmdName, cmdObj);
    console.log(`[commands] Neu geladen: ${cmdName}`);
    return cmdObj;
  }

  GetCommand(name) {
    return this.commands.get(name) || null;
  }

  isOnCooldown(userId, commandName, cooldownSeconds) {
    if (!cooldownSeconds || cooldownSeconds <= 0) return null;

    const key = `${commandName}:${userId}`;
    const expiresAt = this.cooldowns.get(key);
    if (!expiresAt) return null;

    const remaining = expiresAt - Date.now();
    if (remaining <= 0) {
      this.cooldowns.delete(key);
      return null;
    }

    return Math.ceil(remaining / 1000);
  }

  setCooldown(userId, commandName, cooldownSeconds) {
    if (!cooldownSeconds || cooldownSeconds <= 0) return;
    const key = `${commandName}:${userId}`;
    this.cooldowns.set(key, Date.now() + cooldownSeconds * 1000);
  }

  getSlashCommandsPayload() {
    const payload = [];

    for (const [, cmd] of this.commands) {
      if (cmd.data?.toJSON) {
        payload.push(cmd.data.toJSON());
      } else if (cmd.data && typeof cmd.data === 'object') {
        payload.push(cmd.data);
      } else {
        payload.push({
          name: cmd.name,
          description: cmd.description || 'Keine Beschreibung',
          options: cmd.options || [],
        });
      }
    }

    return payload;
  }
}

module.exports = CommandManager;
