# gx-botframework – Feature-Referenz

Vollständige Dokumentation aller Framework-Features, APIs und Konfigurationsoptionen.

---

## Inhaltsverzeichnis

1. [BotClient](#botclient)
2. [BotContext (ctx)](#botcontext-ctx)
3. [CommandManager & Commands](#commandmanager--commands)
4. [InteractionHandler](#interactionhandler)
5. [ConfigLoader](#configloader)
6. [DatabaseWrapper](#databasewrapper)
7. [UtilsManager](#utilsmanager)
8. [ComponentLoader](#componentloader)
9. [ApiManager](#apimanager)
10. [EventManager](#eventmanager)
11. [ModuleManager](#modulemanager)
12. [AutoReloader](#autoreloader)
13. [CLI (mybot-cli)](#cli-mybot-cli)
14. [Umgebungsvariablen](#umgebungsvariablen)
15. [Konfiguration](#konfiguration)

---

## BotClient

Zentrale Klasse – erweitert `discord.js` `Client` und orchestriert alle Manager.

### Erstellung

```javascript
const { BotClient } = require('gx-botframework');

const client = new BotClient({
  projectRoot: __dirname,
  autoWatch: true,        // Standard: Datei-Watcher für Drop-in-Reload
  intents: [...],       // optional
  partials: [...],      // optional
  clientOptions: {},    // weitere discord.js Client-Optionen
});
```

### Lebenszyklus

| Methode | Beschreibung |
|---|---|
| `await client.Start(token)` | Config validieren → DB → Commands → Login → Slash-Deploy → Events → Module → API |
| `await client.Stop()` | API stoppen, Module beenden, DB trennen, Client zerstören |
| `await client.Reload()` | Alles neu laden inkl. Slash-Command-Deploy |

### Start-Reihenfolge

1. `ConfigLoader` – Validierung & Freeze
2. `DatabaseWrapper.connect()`
3. `ComponentLoader.load()`
4. `CommandManager.loadAll()`
5. `InteractionHandler` registrieren
6. `client.login(token)`
7. Slash-Commands via REST global deployen
8. `EventManager.loadAll()`
9. `ModuleManager.loadAll()`
10. `ApiManager.start()`
11. `AutoReloader.start()` (wenn `autoWatch: true`)

### Drop-in-Registrierung

Beim Start werden **alle** `.js`-Dateien in `src/commands`, `src/events`, `src/modules` und `src/api` automatisch geladen. Es ist **kein manuelles Importieren** in `index.js` erforderlich – einfach Datei anlegen.

### Wrapper-Methoden

```javascript
await client.GetGuild(guildId);
await client.GetUser(userId);
await client.GetChannel(channelId);
await client.GetMember(guildId, userOrId);
await client.SendMessage(channelId, content, options);
```

### Instanz-Eigenschaften

| Property | Typ | Beschreibung |
|---|---|---|
| `client.config` | `Object` (frozen) | Validierte Konfiguration |
| `client.db` | `DatabaseWrapper` | Datenbank-Zugriff |
| `client.utils` | `UtilsManager` | Hilfsfunktionen |
| `client.commands` | `CommandManager` | Command-Registry |
| `client.events` | `EventManager` | Event-Loader |
| `client.modules` | `ModuleManager` | Modul-Loader |
| `client.components` | `ComponentLoader` | UI-Komponenten |
| `client.api` | `ApiManager` | Express-Server |

---

## BotContext (ctx)

Wird bei jedem Slash-Command automatisch erstellt und an `execute(ctx)` übergeben. Eliminiert direkten discord.js-Boilerplate.

### Eigenschaften

| Property | Beschreibung |
|---|---|
| `ctx.user` | Ausführender User |
| `ctx.member` | Ausführendes Mitglied (null in DMs) |
| `ctx.guild` | Aktueller Server (null in DMs) |
| `ctx.channel` | Aktueller Kanal |
| `ctx.db` | DatabaseWrapper |
| `ctx.utils` | UtilsManager |
| `ctx.client` | BotClient |
| `ctx.interaction` | Rohe discord.js Interaction (Fallback) |
| `ctx.args` | Flaches Objekt aller Slash-Optionen |

### ctx.args

Optionen werden rekursiv aufgelöst – inkl. Subcommands:

```javascript
// /mute user:@User duration:2h
ctx.args.user      // → User-Objekt
ctx.args.duration  // → "2h"

// /config set key:prefix value:!
ctx.args.set.key   // → "prefix" (bei Subcommand-Struktur)
```

Unterstützte Typen: `String`, `Integer`, `Number`, `Boolean`, `User`, `Channel`, `Role`, `Mentionable`, `Attachment`.

### Entitäten schnell auflösen

```javascript
// Mitglied aus ctx.args.user – ersetzt guild.members.fetch().catch(...)
const target = await ctx.getMember(ctx.args.user);

// Aktueller Ausführer
const me = await ctx.getMember();

// Kanal aus Option oder aktueller Kanal
const logChannel = await ctx.getChannel(ctx.args.channel);
const here = await ctx.getChannel();

// User global
const user = await ctx.getUser(ctx.args.user);

// Rolle
const role = await ctx.getRole(ctx.args.role);
```

Alle `get*`-Methoden akzeptieren:

- Snowflake-String (`"123456789012345678"`)
- Mention (`"<@123>"`, `"<#123>"`, `"<@&123>"`)
- discord.js-Objekt (User, Member, Channel, Role)

**Rückgabe:** Objekt oder `null` (kein Throw) – ideal für einfache `if (!target)`-Checks.

### Antwort-Shortcuts

```javascript
await ctx.reply('Text', { ephemeral: true });
await ctx.success('Gespeichert!');
await ctx.error('Nicht erlaubt.');
await ctx.warn('Zu schnell!');
await ctx.info('Hinweis.');
```

`success`, `error`, `warn`, `info` senden standardmäßig **ephemere** farbige Embeds. `reply()` fängt bereits beantwortete/deferred Interactions ab.

### Interaktive UI (ohne manuelle Collectors)

#### askWithButtons

```javascript
const choice = await ctx.askWithButtons(
  'Bist du sicher?',
  [
    { id: 'yes', label: 'Ja', style: 'danger' },
    { id: 'no', label: 'Nein', style: 'secondary' },
  ],
  60_000 // Timeout in ms
);

if (choice === 'yes') { /* ... */ }
// choice === null bei Timeout
```

- Erstellt intern einen `ComponentCollector`
- Führt bei Klick automatisch `deferUpdate()` aus
- Deaktiviert Buttons nach Timeout
- Gibt die geklickte `id` als String zurück

#### askWithSelect

```javascript
const value = await ctx.askWithSelect(
  'Wähle eine Kategorie:',
  [
    { label: 'Support', value: 'support' },
    { label: 'Bewerbung', value: 'apply' },
  ],
  60_000
);
```

Gibt den gewählten `value`-String zurück (oder `null`).

#### openModal

```javascript
const input = await ctx.openModal('Grund angeben', [
  {
    id: 'reason',
    label: 'Grund',
    style: 'Paragraph',
    placeholder: 'Beschreibe den Grund…',
    required: true,
    minLength: 3,
    maxLength: 500,
  },
], 60_000);

if (!input) return; // Timeout oder abgebrochen
console.log(input.reason);
```

Gibt ein Key-Value-Objekt der Felder zurück. Muss als **erste Antwort** auf die Interaction erfolgen (vor anderen `reply()`-Aufrufen).

---

## CommandManager & Commands

### Command-Datei-Format

```javascript
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Bannt einen User')
    .addUserOption(o => o.setName('user').setRequired(true)),

  cooldown: 30, // Sekunden pro User

  permissions: {
    roles: ['Moderator', 'Admin'],           // Rollenname oder ID
    discord: ['BanMembers'],                   // PermissionFlagsBits-Name
    permissions: ['BanMembers'],               // Alias für discord
    ownerOnly: false,
    adminOnly: false,
  },

  async execute(ctx) {
    const target = await ctx.getMember(ctx.args.user);
    if (!target) return ctx.error('User nicht gefunden.');
    await ctx.success(`${target.user.tag} gebannt.`);
  },
};
```

### Manager-API

| Methode | Beschreibung |
|---|---|
| `commands.loadAll()` | Scannt `src/commands/` |
| `commands.RegisterCommand(cmdObj)` | Command manuell registrieren |
| `commands.UnregisterCommand(name)` | Command entfernen |
| `commands.ReloadCommand(name)` | Require-Cache leeren & neu laden |
| `commands.GetCommand(name)` | Command-Objekt abrufen |
| `commands.getSlashCommandsPayload()` | JSON für Discord REST API |

### Cooldown-System

- Map-basiert: `commandName:userId → Ablaufzeit`
- Automatisch durch `InteractionHandler` erzwungen
- Bei aktivem Cooldown: `ctx.warn()` mit verbleibender Zeit

### Slash-Command-Deploy

Automatisch in `BotClient.Start()` nach erfolgreichem Login:

```javascript
REST.put(Routes.applicationCommands(CLIENT_ID), { body: commands })
```

`CLIENT_ID` aus `.env` oder `client.user.id`.

---

## InteractionHandler

Zentraler Handler für `InteractionCreate` – ersetzt projekt-eigene `interactionCreate.js`.

### Ablauf bei Slash-Commands

1. Command in Registry suchen
2. Cooldown prüfen
3. Permissions prüfen (`roles`, `discord`, `ownerOnly`, `adminOnly`)
4. `BotContext` erstellen
5. `command.execute(ctx)` aufrufen
6. Fehler → Terminal-Log + `ctx.error("Ein interner Fehler ist aufgetreten.")`

### Modal-Handler

Wartet auf `ModalSubmit`-Interaktionen mit registrierten `customId`s aus `ctx.openModal()`.

---

## ConfigLoader

Lädt und validiert **`config.json`** gegen **`config.schema.json`**.

### Verhalten

1. Beide JSON-Dateien aus `projectRoot` parsen
2. `.env`-Overrides anwenden (`API_PORT`, `CLIENT_ID`, `CLIENT_SECRET`)
3. Defaults anwenden (`withDefaults`)
4. Typen & Pflichtfelder prüfen (`validateConfig`)
5. Bei Fehler: präzise Terminal-Ausgabe + `process.exit(1)`
6. Bei Erfolg: `Object.freeze()` – Config ist immutable

### config.json

```json
{
  "bot": {
    "name": "Mein Bot",
    "prefix": "!",
    "owners": []
  },
  "api": { "port": 3000, "enabled": true },
  "database": { "type": "json" },
  "oauth": { "clientId": "", "clientSecret": "" },
  "embed": { "color": "#5865F2", "footer": "Mein Bot" }
}
```

### config.schema.json

```json
{
  "bot": {
    "name": { "type": "string", "required": true },
    "prefix": { "type": "string", "required": false, "default": "!" }
  },
  "database": {
    "type": { "type": "string", "required": true, "enum": ["json", "mysql", "none"] }
  }
}
```

Unterstützte Typen: `string`, `number`, `boolean`, `array` + `enum`-Einschränkung.

---

## DatabaseWrapper

Einheitliche API unabhängig vom DB-Adapter (`json`, `mysql`, `none`).

### Methoden

```javascript
await db.get(key, path?)       // Wert oder verschachtelter Pfad
await db.set(key, value, path?)
await db.delete(key, path?)
await db.has(key, path?)
await db.incr(key, amount?, path?)  // Standard: +1
await db.decr(key, amount?, path?)  // Standard: -1
await db.all()                     // Alle Einträge
await db.clear()                   // Alles löschen
await db.connect()
await db.disconnect()
```

### Pfad-Syntax

```javascript
await db.set('guild:123', { stats: { mutes: 0, warns: 5 } });
await db.get('guild:123', 'stats.mutes');     // → 0
await db.incr('guild:123', 1, 'stats.mutes'); // → 1
await db.has('guild:123', 'stats.warns');      // → true
await db.delete('guild:123', 'stats.warns');
```

### Adapter-Anforderungen

`src/database/db.js` muss exportieren:

| Methode | Erforderlich |
|---|---|
| `connect()` | Ja |
| `disconnect()` | Ja |
| `get(key)` | Ja |
| `set(key, value)` | Ja |
| `delete(key)` | Ja |
| `has(key)` | Ja |
| `all()` | Optional |
| `clear()` | Optional |

---

## UtilsManager

Zugriff über `client.utils` oder `ctx.utils`.

### Entitäten auflösen

| Methode | Verhalten |
|---|---|
| `ExtractId(input)` | ID aus Snowflake, Mention oder Objekt |
| `ResolveUser(input)` | User oder `null` |
| `ResolveMember(guildId, input)` | GuildMember oder `null` |
| `ResolveChannel(guildId, input)` | Channel oder `null` |
| `ResolveRole(guildId, input)` | Role oder `null` |
| `GetUser(input)` | Wie Resolve, wirft bei Fehler |
| `GetMember(guildId, input)` | Wie Resolve, wirft bei Fehler |
| `GetChannel(guildId, input)` | Wie Resolve, wirft bei Fehler |
| `GetRole(guildId, input)` | Wie Resolve, wirft bei Fehler |
| `GetGuild(guildId)` | Guild abrufen |

### Berechtigungen

```javascript
utils.CheckRole(member, 'Moderator');        // Name oder ID
utils.CheckPermission(member, 'BanMembers'); // PermissionFlagsBits-Name
utils.IsOwner(guild, userId);
utils.IsAdmin(member);
```

### Zeit

```javascript
utils.ParseTime('1d 5h 30m');  // → Millisekunden
utils.FormatTime(95400000);   // → "1d 5h 30m"
```

Unterstützte Einheiten: `ms`, `s/sec/sek`, `m/min`, `h/std/stunde`, `d/tag`, `w/woche` (und Pluralformen).

### Zufall & Async

```javascript
utils.GenerateId(16);        // Krypto-sichere Hex-ID
utils.Sleep(5000);             // Promise, 5 Sekunden
utils.Random(1, 100);          // Ganzzahl inkl. Grenzen
utils.RandomElement(['a', 'b']);
```

### Nachrichten senden (ohne Interaction)

```javascript
await client.SendMessage(channelId, 'Hallo!');

await client.SendMessage(channelId, 'Fehler!', {
  type: 'error',           // success | error | warn | info
  guildId: guild.id,
});

await client.SendMessage(channelId, null, {
  guildId: guild.id,
  componentKey: 'welcome',
  placeholders: { user: 'Max', guild: 'Mein Server' },
});

// Components V2 direkt senden
const v2 = client.components.build('githubExample');
await client.SendMessage(channelId, null, { guildId: guild.id, ...v2 });
```

---

## ComponentLoader

Lädt **`src/data/components.json`** – ein Key-Value-Objekt, bei dem jeder Key eine Komponente definiert.

### Components V2 (Discord Raw JSON)

JSON direkt reinkopieren – z. B. aus dem Discord Developer Portal:

```json
{
  "githubExample": [
    {
      "type": 17,
      "accent_color": 9225410,
      "spoiler": false,
      "components": [
        { "type": 10, "content": "Example components:" },
        {
          "type": 12,
          "items": [
            {
              "media": { "url": "https://example.com/image.png" },
              "spoiler": false
            }
          ]
        }
      ]
    }
  ]
}
```

Erkennung: Wert ist ein **Array** oder enthält `components` mit numerischen `type`-Feldern (1–18). Das Framework setzt automatisch `MessageFlags.IsComponentsV2`.

Alternative Schreibweisen:

```json
{
  "panel": {
    "v2": [ { "type": 17, "components": [] } ]
  }
}
```

### Legacy V1 (Embeds & Buttons)

```json
{
  "welcome": {
    "content": "Hallo {user}!",
    "embed": {
      "title": "Willkommen",
      "description": "Schön, dass du da bist!",
      "color": "#57F287"
    },
    "buttonRows": [
      {
        "buttons": [
          { "id": "ok", "label": "OK", "style": "primary" }
        ]
      }
    ]
  }
}
```

### API

```javascript
client.components.load();
client.components.reload();

const payload = client.components.build('githubExample', {
  user: 'Gabriel',
});
// V2 → { components: [...], flags: MessageFlags.IsComponentsV2 }
// V1 → { content, embeds, components }

client.components.buildV2('githubExample'); // erzwingt V2-Flag
```

Platzhalter `{key}` werden rekursiv in allen Strings ersetzt.

Button-Styles (V1): `primary`, `secondary`, `success`, `danger`, `link`.

---

## ApiManager

Express-Server auf `config.api.port` (Standard: 3000).

### Aktivierung

```json
"api": { "port": 3000, "enabled": true }
```

### Route-Format

```javascript
// src/api/meineRoute.js
module.exports = {
  method: 'GET',       // GET, POST, PUT, DELETE, PATCH
  path: '/api/users',
  async execute(req, res, client) {
    const count = await client.db.get('stats', 'users');
    res.json({ users: count, bot: client.user.tag });
  },
};
```

`client` in `execute` = volle `BotClient`-Instanz.

### Eingebaute Route

`GET /health` – immer verfügbar (Status, Uptime, Discord-Ready).

### OAuth2-Helfer (UtilsManager)

```javascript
// Token austauschen
const tokens = await client.utils.exchangeOAuthCode(code, redirectUri);
// → { access_token, refresh_token, expires_in, ... }

// User-Daten
const user = await client.utils.fetchUserData(tokens.access_token);
// → { id, username, avatarUrl, createdAt, ... }

// Guilds des Users (Scope: guilds)
const guilds = await client.utils.fetchUserGuilds(tokens.access_token);
```

Benötigt in `.env`:

```
CLIENT_ID=...
CLIENT_SECRET=...
```

---

## EventManager

Lädt alle `.js`-Dateien aus `src/events/` (außer `interactionCreate.js`).

### Signatur

```javascript
module.exports = {
  name: Events.MessageCreate,  // oder String 'messageCreate'
  once: false,                 // optional
  async execute(...discordArgs, client, db, utils) {
    // discordArgs = originale discord.js Event-Argumente
  },
};
```

### Dependency Injection

Jedes Event erhält automatisch:

- `client` – BotClient
- `db` – DatabaseWrapper
- `utils` – UtilsManager

---

## ModuleManager

Für autarke, wiederverwendbare Erweiterungen in `src/modules/`.

```javascript
module.exports = {
  async init(client, { db, utils, config }) {
    // Setup, Intervalle, Listener registrieren
  },

  async destroy(client) {
    // Cleanup bei Stop/Reload
  },
};
```

---

## AutoReloader

Überwacht Projektordner und lädt Änderungen automatisch nach (Standard: aktiv).

### Überwachte Pfade

| Pfad | Reload-Aktion |
|---|---|
| `src/commands/*.js` | Commands laden + Slash-Deploy |
| `src/events/*.js` | Events neu binden |
| `src/modules/*.js` | Module neu initialisieren |
| `src/api/*.js` | API-Server neu starten |
| `config.json` | Config neu validieren |
| `src/data/components.json` | Komponenten neu laden |

### Konfiguration

```javascript
new BotClient({ autoWatch: true });  // Standard
```

```env
BOT_AUTO_WATCH=false   # Watcher deaktivieren
```

Debounce: 800 ms – verhindert Mehrfach-Reloads bei schnellen Speichervorgängen.

---

## CLI (mybot-cli)

| Befehl | Beschreibung |
|---|---|
| `npx mybot-cli init [ziel]` | Neues Bot-Projekt |
| `npx mybot-cli --help` | Hilfe |
| `npx mybot-cli --version` | Version |

### Interaktive Auswahl

1. Bot-Name
2. Datenbank: JSON / MySQL / Keine

### Generierte Abhängigkeiten

- `gx-botframework`
- `discord.js`
- `dotenv`
- `express`
- `mysql2` (nur bei MySQL)

---

## Umgebungsvariablen

```env
# Pflicht
DISCORD_TOKEN=          # Bot-Token vom Developer Portal
CLIENT_ID=              # Application ID (für Slash-Deploy & OAuth)

# Optional
GUILD_ID=               # Für Dev-Tests
API_PORT=3000
CLIENT_SECRET=          # OAuth2

# MySQL (nur bei DB-Typ mysql)
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=
MYSQL_DATABASE=bot_db
```

---

## Konfiguration

Siehe [ConfigLoader](#configloader). Alle Einstellungen in **`config.json`**, Validierung in **`config.schema.json`**. Secrets über `.env` – werden beim Laden in die Config gemerged.

---

## Typischer Command-Workflow

```javascript
async execute(ctx) {
  // 1. Server-Only prüfen
  if (!ctx.guild) return ctx.warn('Nur auf Servern nutzbar.');

  // 2. Argumente & Entitäten
  const target = await ctx.getMember(ctx.args.user);
  if (!target) return ctx.error('User nicht auf dem Server.');

  // 3. Modal für Eingabe
  const form = await ctx.openModal('Details', [
    { id: 'note', label: 'Notiz', style: 'Paragraph', required: true },
  ]);
  if (!form) return ctx.info('Abgebrochen.');

  // 4. Bestätigung
  const ok = await ctx.askWithButtons('Wirklich ausführen?', [
    { id: 'yes', label: 'Ja', style: 'danger' },
    { id: 'no', label: 'Nein', style: 'secondary' },
  ]);
  if (ok !== 'yes') return ctx.info('Abgebrochen.');

  // 5. DB & Antwort
  await ctx.db.set(`action:${target.id}`, { note: form.note, at: Date.now() });
  await ctx.success(`${target.user.tag} bearbeitet.`);
}
```

---

## Exportierte Klassen

```javascript
const {
  BotClient,
  BotContext,
  CommandManager,
  ConfigLoader,
  DatabaseWrapper,
  UtilsManager,
  ComponentLoader,
  ApiManager,
  EventManager,
  ModuleManager,
  InteractionHandler,
  AutoReloader,
} = require('gx-botframework');
```
