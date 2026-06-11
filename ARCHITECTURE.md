# Architecture Evolution – gx-botframework

## Step 1: Component Analysis

| Component | Purpose | Verdict | Action |
|---|---|---|---|
| `BotClient.js` | Orchestrator, extends discord.js `Client` | **REFINE** | Composition over inheritance; hide `#discord` via `DiscordGateway` |
| `BotContext.js` | Command context (`ctx`) | **REFINE** | Evolve into `FrameworkContext`; keep `BotContext` alias |
| `CommandManager.js` | Scan/load slash commands | **KEEP** | No structural change; inject `Container` later |
| `EventManager.js` | Load Discord event files | **REFINE** | Add internal `EventBus`; bind via `DiscordGateway` |
| `ModuleManager.js` | Load bot modules | **REFINE** | Add lifecycle hooks + service providers + folder modules |
| `InteractionHandler.js` | Slash command pipeline | **REFINE** | Route through `MiddlewarePipeline` |
| `ConfigLoader.js` | JSON config + schema | **KEEP** | Stable |
| `configValidator.js` | Schema validation | **KEEP** | Stable |
| `DatabaseWrapper.js` | KV store with paths | **KEEP** | Wrap with `DatabaseAdapter` (uppercase API) |
| `ComponentLoader.js` | JSON/V2 UI registry | **KEEP** | Complement with `Component` abstraction |
| `UtilsManager.js` | Helpers, OAuth, SendMessage | **KEEP** | Register as container service |
| `ApiManager.js` | Express routes | **KEEP** | Future `@framework/web` extraction |
| `AutoReloader.js` | File watcher hot reload | **KEEP** | Stable |
| `bin/cli.js` | Scaffolding CLI | **KEEP** | Future `@framework/cli` package |
| `templates/` | Bot project templates | **KEEP** | Update incrementally |
| `index.js` | Public exports | **REFINE** | Export core layer |

### Verdict Summary

- **KEEP (11):** CommandManager, ConfigLoader, configValidator, DatabaseWrapper, ComponentLoader, UtilsManager, ApiManager, AutoReloader, CLI, templates, most loader logic
- **REFINE (6):** BotClient, BotContext→FrameworkContext, EventManager, ModuleManager, InteractionHandler, index.js
- **REPLACE (0):** Nothing removed; new layers added alongside

## Before / After

```
BEFORE                          AFTER
──────                          ─────
BotClient extends Client   →    BotClient composes DiscordGateway (#discord)
BotContext                 →    FrameworkContext (+ BotContext alias)
interaction → command      →    interaction → middleware → permissions → cooldown → command
EventManager (Discord)     →    EventManager + EventBus (internal)
ModuleManager.init()       →    onLoad/onEnable/onDisable/onReload + services
DatabaseWrapper            →    DatabaseAdapter wraps Wrapper (both APIs)
ComponentLoader            →    ComponentLoader + Component abstraction
```

## Migration Impact

| Change | Breaking? | Migration |
|---|---|---|
| `BotClient` no longer `extends Client` | Low | `instanceof Client` fails; use `client.discord` if needed |
| `ctx.interaction` | Low | Still available (deprecated getter) |
| `ctx.services.*` | None | Additive |
| `app.Use()` middleware | None | Additive |
| Module `onLoad` vs `init` | None | `init` still works |
| `Database.Get()` | None | `db.get()` still works |

## Future Packages (prepared, not split yet)

```
packages/
  core/       ← src/core, src/abstractions, src/database
  cli/        ← bin/cli.js
  web/        ← ApiManager
  cluster/    ← LifecycleHooks + EventBus hooks
  redis/      ← DatabaseAdapter slot
  plugins/    ← ModuleManager + Container
```
