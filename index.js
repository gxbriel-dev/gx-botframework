const BotClient = require('./src/BotClient');
const FrameworkContext = require('./src/FrameworkContext');
const BotContext = require('./src/BotContext');
const CommandManager = require('./src/CommandManager');
const ConfigLoader = require('./src/ConfigLoader');
const DatabaseWrapper = require('./src/DatabaseWrapper');
const DatabaseAdapter = require('./src/database/DatabaseAdapter');
const UtilsManager = require('./src/UtilsManager');
const ComponentLoader = require('./src/ComponentLoader');
const ApiManager = require('./src/ApiManager');
const EventManager = require('./src/EventManager');
const ModuleManager = require('./src/ModuleManager');
const InteractionHandler = require('./src/InteractionHandler');
const AutoReloader = require('./src/AutoReloader');

const Container = require('./src/core/Container');
const MiddlewarePipeline = require('./src/core/MiddlewarePipeline');
const LifecycleHooks = require('./src/core/LifecycleHooks');
const EventBus = require('./src/core/EventBus');
const DiscordGateway = require('./src/core/DiscordGateway');

const Component = require('./src/abstractions/Component');
const EmbedFactory = require('./src/abstractions/Embed');

module.exports = {
  BotClient,
  FrameworkContext,
  BotContext,
  CommandManager,
  ConfigLoader,
  DatabaseWrapper,
  DatabaseAdapter,
  UtilsManager,
  ComponentLoader,
  ApiManager,
  EventManager,
  ModuleManager,
  InteractionHandler,
  AutoReloader,
  Container,
  MiddlewarePipeline,
  LifecycleHooks,
  EventBus,
  DiscordGateway,
  Component,
  Embed: EmbedFactory,
};
