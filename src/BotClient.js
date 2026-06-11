const { REST, Routes } = require('discord.js');

const DiscordGateway = require('./core/DiscordGateway');
const Container = require('./core/Container');
const MiddlewarePipeline = require('./core/MiddlewarePipeline');
const LifecycleHooks = require('./core/LifecycleHooks');
const EventBus = require('./core/EventBus');

const ConfigLoader = require('./ConfigLoader');
const DatabaseAdapter = require('./database/DatabaseAdapter');
const CommandManager = require('./CommandManager');
const EventManager = require('./EventManager');
const ModuleManager = require('./ModuleManager');
const ComponentLoader = require('./ComponentLoader');
const ApiManager = require('./ApiManager');
const UtilsManager = require('./UtilsManager');
const InteractionHandler = require('./InteractionHandler');
const AutoReloader = require('./AutoReloader');

const {
  createPermissionMiddleware,
  createCooldownMiddleware,
  createErrorMiddleware,
} = require('./middleware/coreMiddleware');

class BotClient {
  #gateway;

  constructor(options = {}) {
    this.projectRoot = options.projectRoot || process.cwd();
    this._token = null;
    this._modalWaiters = new Map();
    this.autoWatch = options.autoWatch ?? process.env.BOT_AUTO_WATCH !== 'false';

    this.#gateway = new DiscordGateway(options);
    this.container = options.container || new Container();
    this.middleware = options.middleware || new MiddlewarePipeline();
    this.lifecycle = options.lifecycle || new LifecycleHooks();
    this.bus = options.bus || new EventBus();

    this.configLoader = new ConfigLoader(this.projectRoot);
    this.commandManager = new CommandManager(this, this.projectRoot);
    this.eventManager = new EventManager(this, this.projectRoot);
    this.moduleManager = new ModuleManager(this, this.projectRoot);
    this.componentLoader = new ComponentLoader(this.projectRoot, null);
    this.apiManager = null;

    this.config = null;
    this.db = null;
    this.utils = null;
    this.components = null;
    this.api = null;
    this._interactionHandler = null;
    this._autoReloader = null;

    this.commands = this.commandManager;
    this.events = this.eventManager;
    this.modules = this.moduleManager;
    this.components = this.componentLoader;

    this._registerCoreMiddleware();
  }

  /** Express-style middleware registration */
  Use(middleware) {
    this.middleware.use(middleware);
    return this;
  }

  _registerCoreMiddleware() {
    this.middleware
      .use(createErrorMiddleware())
      .use(createPermissionMiddleware())
      .use(createCooldownMiddleware());
  }

  /** @deprecated Direkter discord.js-Zugriff – nur für Migration */
  get discord() {
    return this.#gateway.raw;
  }

  get user() { return this.#gateway.user; }
  get guilds() { return this.#gateway.guilds; }
  get channels() { return this.#gateway.channels; }
  get users() { return this.#gateway.users; }
  get ws() { return this.#gateway.ws; }

  isReady() { return this.#gateway.isReady(); }
  on(...args) { return this.#gateway.on(...args); }
  once(...args) { return this.#gateway.once(...args); }
  off(...args) { return this.#gateway.off(...args); }
  removeListener(...args) { return this.#gateway.removeListener(...args); }
  login(token) { return this.#gateway.login(token); }
  destroy() { return this.#gateway.destroy(); }

  async GetGuild(id) { return this.utils.GetGuild(id); }
  async GetUser(id) { return this.utils.GetUser(id); }
  async GetChannel(id) { return this.utils.GetChannel(null, id); }
  async GetMember(guildId, memberInput) { return this.utils.GetMember(guildId, memberInput); }
  async SendMessage(channelId, content, options = {}) {
    return this.utils.SendMessage(channelId, content, options);
  }

  _registerCoreServices() {
    this.container.Singleton('client', () => this);
    this.container.Singleton('config', () => this.config);
    this.container.Singleton('db', () => this.db);
    this.container.Singleton('utils', () => this.utils);
    this.container.Singleton('bus', () => this.bus);
    this.container.Singleton('components', () => this.components);
  }

  async _deploySlashCommands(token) {
    const applicationId = process.env.CLIENT_ID || this.user?.id;
    if (!applicationId) {
      throw new Error('[bot] CLIENT_ID fehlt – Slash-Commands können nicht registriert werden.');
    }

    const rest = new REST({ version: '10' }).setToken(token);
    const body = this.commandManager.getSlashCommandsPayload();

    console.log(`[bot] Registriere ${body.length} Slash-Command(s) global…`);
    await rest.put(Routes.applicationCommands(applicationId), { body });
    console.log('[bot] Slash-Commands erfolgreich registriert.');
  }

  async Start(token) {
    this._token = token;

    await this.lifecycle.emit('booting', { client: this });

    this.config = this.configLoader.load();

    this.db = new DatabaseAdapter(this.projectRoot, this.config);
    await this.db.Connect();

    this.componentLoader.config = this.config;
    this.componentLoader.load();

    this.utils = new UtilsManager(this);
    this.apiManager = new ApiManager(this, this.projectRoot, this.config);
    this.api = this.apiManager;

    this._registerCoreServices();

    await this.commandManager.loadAll();

    this._interactionHandler = new InteractionHandler(this);
    this._interactionHandler.register();

    await this.login(token);
    await this._deploySlashCommands(token);

    await this.eventManager.loadAll();
    await this.moduleManager.loadAll();
    await this.apiManager.start();

    if (this.autoWatch) {
      this._autoReloader = new AutoReloader(this);
      this._autoReloader.start();
    }

    await this.lifecycle.emit('booted', { client: this });
    await this.bus.Emit('framework:ready', { client: this });

    console.log(`[bot] ${this.config.bot.name} ist online als ${this.user.tag}`);
    return this;
  }

  async Stop() {
    console.log('[bot] Fahre herunter…');
    await this.lifecycle.emit('stopping', { client: this });

    if (this._autoReloader) {
      this._autoReloader.stop();
      this._autoReloader = null;
    }

    await this.moduleManager.disableAll();

    if (this.apiManager) await this.apiManager.stop();
    if (this.db) await this.db.Disconnect();

    this.destroy();
    await this.lifecycle.emit('stopped', { client: this });
    console.log('[bot] Heruntergefahren.');
  }

  async Reload() {
    if (!this._token) throw new Error('[bot] Reload nicht möglich – Bot wurde noch nicht gestartet.');

    await this.lifecycle.emit('reloading', { client: this });

    this.config = this.configLoader.reload();
    this.componentLoader.config = this.config;
    this.componentLoader.reload();

    await this.commandManager.loadAll();
    await this._deploySlashCommands(this._token);
    await this.eventManager.reload();
    await this.moduleManager.reload();
    if (this.apiManager) await this.apiManager.restart();

    await this.lifecycle.emit('reloaded', { client: this });
    await this.bus.Emit('framework:reloaded', { client: this });
    console.log('[bot] Reload abgeschlossen.');
    return this;
  }
}

module.exports = BotClient;
