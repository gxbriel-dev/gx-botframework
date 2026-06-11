const { Client, GatewayIntentBits, Partials } = require('discord.js');

const DEFAULT_INTENTS = [
  GatewayIntentBits.Guilds,
  GatewayIntentBits.GuildMessages,
  GatewayIntentBits.MessageContent,
  GatewayIntentBits.GuildMembers,
];

class DiscordGateway {
  constructor(options = {}) {
    this._client = new Client({
      intents: options.intents || DEFAULT_INTENTS,
      partials: options.partials || [Partials.Channel, Partials.Message],
      ...options.clientOptions,
    });
  }

  get raw() {
    return this._client;
  }

  get user() {
    return this._client.user;
  }

  get guilds() {
    return this._client.guilds;
  }

  get channels() {
    return this._client.channels;
  }

  get users() {
    return this._client.users;
  }

  get ws() {
    return this._client.ws;
  }

  isReady() {
    return this._client.isReady();
  }

  on(event, listener) {
    return this._client.on(event, listener);
  }

  once(event, listener) {
    return this._client.once(event, listener);
  }

  off(event, listener) {
    return this._client.off(event, listener);
  }

  removeListener(event, listener) {
    return this._client.removeListener(event, listener);
  }

  login(token) {
    return this._client.login(token);
  }

  destroy() {
    return this._client.destroy();
  }
}

module.exports = DiscordGateway;
