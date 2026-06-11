# gx-botframework

Modulares NPM-Framework für Discord-Bots auf Basis von **discord.js v14+**. Es abstrahiert wiederkehrende Boilerplate-Logik, stellt ein einheitliches Command-/Event-/API-System bereit und generiert neue Bot-Projekte per CLI.

**Drop-in-Prinzip:** Dateien in die richtigen Ordner legen – das Framework lädt und registriert sie automatisch. Kein manuelles Importieren in `index.js` nötig.

**Enterprise-Evolution:** Siehe [ARCHITECTURE.md](./ARCHITECTURE.md) für KEEP/REFINE-Analyse, DI, Middleware, Event Bus und Migrationshinweise.

---

## Inhaltsverzeichnis

- [Schnellstart](#schnellstart)
- [Automatisches Laden](#automatisches-laden)
- [Repository-Struktur](#repository-struktur)
- [Bot-Projektstruktur](#bot-projektstruktur)
- [Framework erweitern](#framework-erweitern)
- [Beispielprojekt](#beispielprojekt)
- [Weiterführende Dokumentation](#weiterführende-dokumentation)

---

## Schnellstart

```bash
cd gx-botframework && npm install
npx mybot-cli init ./mein-bot
cd mein-bot
# .env: DISCORD_TOKEN, CLIENT_ID
npm start
```

Slash-Commands werden beim Start **automatisch global registriert**.

---

## Automatisches Laden

Beim Start scannt das Framework alle relevanten Ordner und registriert den Inhalt:

| Ordner / Datei | Was passiert |
|---|---|
| `src/commands/*.js` | Slash-Commands laden + bei Discord registrieren |
| `src/events/*.js` | Discord-Events binden (außer `interactionCreate`) |
| `src/modules/*.js` | Module via `init()` starten |
| `src/api/*.js` | Express-Routen mounten |
| `config.json` | Laden, validieren, einfrieren |
| `src/data/components.json` | UI-Komponenten (V1 + V2) registrieren |

### Live-Reload (Datei-Watcher)

Standardmäßig aktiv (`autoWatch: true`). Neue oder geänderte `.js`-Dateien werden **ohne Neustart** neu geladen:

```javascript
const client = new BotClient({
  projectRoot: __dirname,
  autoWatch: true, // Standard; mit false oder BOT_AUTO_WATCH=false deaktivieren
});
```

| Änderung an | Aktion |
|---|---|
| `src/commands/` | Commands neu laden + Slash-Deploy |
| `src/events/` | Events neu binden |
| `src/modules/` | Module neu initialisieren |
| `src/api/` | API-Server neu starten |
| `config.json` | Config neu validieren |
| `components.json` | Komponenten-Registry neu laden |

**Du musst nur Dateien anlegen** – kein Eintrag in `index.js`, keine manuelle Registry.

---

## Repository-Struktur

```
gx-botframework/
├── bin/cli.js
├── index.js
├── README.md
├── FEATURES.md
├── src/
│   ├── BotClient.js
│   ├── AutoReloader.js       # Datei-Watcher
│   ├── ConfigLoader.js
│   ├── ComponentLoader.js
│   └── ...
└── templates/
    ├── config.json
    ├── config.schema.json
    ├── components.json
    └── ...
```

---

## Bot-Projektstruktur

```
mein-bot/
├── index.js
├── config.json              # Bot-Konfiguration (JSON)
├── config.schema.json       # Validierungsschema (JSON)
├── .env
├── package.json
└── src/
    ├── commands/            # → automatisch geladen
    ├── events/              # → automatisch geladen
    ├── modules/             # → automatisch geladen
    ├── api/                 # → automatisch geladen
    ├── data/
    │   ├── components.json  # UI-Komponenten (Keys → V1 oder V2 JSON)
    │   └── store.json
    └── database/
        └── db.js
```

### `index.js` (minimal)

```javascript
require('dotenv').config();
const { BotClient } = require('gx-botframework');

const client = new BotClient({ projectRoot: __dirname });

process.on('SIGINT', async () => {
  await client.Stop();
  process.exit(0);
});

client.Start(process.env.DISCORD_TOKEN);
```

### `config.json`

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

Secrets kommen aus `.env` und überschreiben beim Start automatisch:

- `API_PORT` → `api.port`
- `CLIENT_ID` → `oauth.clientId`
- `CLIENT_SECRET` → `oauth.clientSecret`

Schema in `config.schema.json` – gleiche Struktur wie bisher, nur als JSON.

---

## Framework erweitern

### Command hinzufügen

`src/commands/hallo.js` anlegen – fertig:

```javascript
const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('hallo')
    .setDescription('Sagt Hallo'),
  async execute(ctx) {
    await ctx.success(`Hallo, ${ctx.user.username}!`);
  },
};
```

### Event hinzufügen

`src/events/messageCreate.js` anlegen – fertig. Kein `interactionCreate` nötig (Framework).

### Modul hinzufügen

`src/modules/scheduler.js` mit `init()` und optional `destroy()`.

### API-Route hinzufügen

`src/api/callback.js`:

```javascript
module.exports = {
  method: 'GET',
  path: '/api/callback',
  async execute(req, res, client) {
    res.json({ ok: true });
  },
};
```

### Components V2 (JSON einfügen)

In `src/data/components.json` einen Key mit Discord-Components-V2-JSON definieren:

```json
{
  "githubExample": [
    {
      "type": 17,
      "accent_color": 9225410,
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

Nutzen:

```javascript
const payload = ctx.client.components.build('githubExample');
await ctx.client.SendMessage(channelId, null, {
  guildId: ctx.guild.id,
  ...payload,
});
```

Platzhalter `{key}` in Strings werden automatisch ersetzt. V2-JSON kannst du direkt aus dem Discord-Developer-Portal oder Builder reinkopieren.

Legacy-Embeds (V1) funktionieren weiterhin im selben File:

```json
{
  "welcome": {
    "embed": {
      "title": "Willkommen {user}",
      "color": "#57F287"
    }
  }
}
```

### Config erweitern

1. Feld in `config.json` hinzufügen
2. Schema in `config.schema.json` ergänzen
3. Speichern – bei aktivem Watcher wird automatisch neu geladen

### User & Kanäle

```javascript
const member = await ctx.getMember(ctx.args.user);
const channel = await ctx.getChannel(ctx.args.channel);
```

---

## Beispielprojekt

`gx-bot-example/` – Demo mit `/ping`, `/mute`, Components V2 und JSON-Config.

```bash
cd ../gx-bot-example && npm install && npm start
```

---

## Weiterführende Dokumentation

**[FEATURES.md](./FEATURES.md)** – vollständige API-Referenz

---

## Lizenz

MIT
