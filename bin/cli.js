#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const {
  intro,
  outro,
  text,
  select,
  cancel,
  isCancel,
  spinner,
  note,
} = require('@clack/prompts');

const TEMPLATES_DIR = path.join(__dirname, '..', 'templates');
const COMMANDS = ['init'];

function parseArgs(argv) {
  const args = argv.slice(2);
  const command = args[0];

  if (!command || command === '--help' || command === '-h') {
    return { command: 'help' };
  }

  if (command === '--version' || command === '-v') {
    return { command: 'version' };
  }

  return { command, targetDir: args[1] || process.cwd() };
}

function printHelp() {
  console.log(`
mybot-cli – Discord-Bot-Framework Scaffolding

Verwendung:
  npx mybot-cli init [zielverzeichnis]

Befehle:
  init    Erstellt ein neues Bot-Projekt im Zielverzeichnis (Standard: aktuelles Verzeichnis)
  help    Zeigt diese Hilfe an

Optionen:
  -h, --help     Hilfe anzeigen
  -v, --version  Version anzeigen
`);
}

function printVersion() {
  const pkg = require(path.join(__dirname, '..', 'package.json'));
  console.log(pkg.version);
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function readTemplate(fileName) {
  const filePath = path.join(TEMPLATES_DIR, fileName);
  return fs.readFileSync(filePath, 'utf8');
}

function writeFile(filePath, content) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, content, 'utf8');
}

function copyTemplate(templateName, destPath, replacements = {}) {
  let content = readTemplate(templateName);

  for (const [key, value] of Object.entries(replacements)) {
    content = content.replaceAll(`{{${key}}}`, value);
  }

  writeFile(destPath, content);
}

function slugify(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'discord-bot';
}

function getDbTemplateFile(dbChoice) {
  const map = {
    mysql: 'db.mysql.js',
    json: 'db.json.js',
    none: 'db.none.js',
  };

  return map[dbChoice];
}

function getFrameworkPackagePath() {
  return path.resolve(__dirname, '..');
}

function buildGeneratedPackageJson(botName, dbChoice) {
  const packageName = slugify(botName);
  const frameworkPath = getFrameworkPackagePath().replace(/\\/g, '/');

  const dependencies = {
    'gx-botframework': `file:${frameworkPath}`,
    'discord.js': '^14.16.3',
    dotenv: '^16.4.7',
    express: '^4.21.2',
  };

  if (dbChoice === 'mysql') {
    dependencies.mysql2 = '^3.12.0';
  }

  const pkg = {
    name: packageName,
    version: '1.0.0',
    description: `${botName} – Discord Bot`,
    main: 'index.js',
    type: 'commonjs',
    scripts: {
      start: 'node index.js',
      dev: 'node --watch index.js',
    },
    engines: {
      node: '>=18.0.0',
    },
    keywords: ['discord', 'bot'],
    license: 'MIT',
    dependencies,
  };

  return JSON.stringify(pkg, null, 2);
}

function buildEnvFile(dbChoice) {
  const lines = [
    '# Discord',
    'DISCORD_TOKEN=',
    'CLIENT_ID=',
    'GUILD_ID=',
    '',
    '# Server',
    'API_PORT=3000',
    '',
  ];

  if (dbChoice === 'mysql') {
    lines.push(
      '# MySQL',
      'MYSQL_HOST=localhost',
      'MYSQL_PORT=3306',
      'MYSQL_USER=root',
      'MYSQL_PASSWORD=',
      'MYSQL_DATABASE=bot_db',
      ''
    );
  }

  return lines.join('\n');
}

function createPlaceholderReadme(dirPath, name) {
  const content = `# ${name}

Discord-Bot, generiert mit mybot-cli (gx-botframework).

## Starten

\`\`\`bash
npm start
\`\`\`

1. \`.env\` mit \`DISCORD_TOKEN\` und \`CLIENT_ID\` befüllen
2. \`npm start\`

## Dokumentation

- Framework-Aufbau & Erweiterung: siehe \`gx-botframework/README.md\`
- Feature-Referenz: siehe \`gx-botframework/FEATURES.md\`
`;
  writeFile(path.join(dirPath, 'README.md'), content);
}

function createGitkeep(dirPath) {
  writeFile(path.join(dirPath, '.gitkeep'), '');
}

function scaffoldProject(targetDir, botName, dbChoice) {
  const replacements = {
    BOT_NAME: botName,
    PACKAGE_NAME: slugify(botName),
    DB_TYPE: dbChoice,
  };

  const dirs = [
    'src/commands',
    'src/modules',
    'src/events',
    'src/api',
    'src/data',
    'src/database',
  ];

  for (const dir of dirs) {
    ensureDir(path.join(targetDir, dir));
  }

  createGitkeep(path.join(targetDir, 'src', 'modules'));

  copyTemplate('event.ready.js', path.join(targetDir, 'src', 'events', 'ready.js'), replacements);
  copyTemplate('command.ping.js', path.join(targetDir, 'src', 'commands', 'ping.js'), replacements);
  copyTemplate('api.status.js', path.join(targetDir, 'src', 'api', 'status.js'), replacements);

  copyTemplate('index.js', path.join(targetDir, 'index.js'), replacements);
  copyTemplate('config.json', path.join(targetDir, 'config.json'), replacements);
  copyTemplate('config.schema.json', path.join(targetDir, 'config.schema.json'), replacements);
  copyTemplate('components.json', path.join(targetDir, 'src', 'data', 'components.json'), replacements);

  const dbTemplate = getDbTemplateFile(dbChoice);
  copyTemplate(dbTemplate, path.join(targetDir, 'src', 'database', 'db.js'), replacements);

  writeFile(path.join(targetDir, 'package.json'), buildGeneratedPackageJson(botName, dbChoice));
  writeFile(path.join(targetDir, '.env'), buildEnvFile(dbChoice));
  createPlaceholderReadme(targetDir, botName);

  if (dbChoice === 'json') {
    writeFile(path.join(targetDir, 'src', 'data', 'store.json'), '{}\n');
  }
}

function installDependencies(targetDir, dbChoice) {
  const packages = ['discord.js', 'dotenv', 'express'];

  if (dbChoice === 'mysql') {
    packages.push('mysql2');
  }

  const command = `npm install ${packages.join(' ')}`;

  execSync(command, {
    cwd: targetDir,
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: 'development' },
  });
}

async function runInit(targetDir) {
  intro('mybot-cli – Neues Discord-Bot-Projekt');

  const botName = await text({
    message: 'Wie soll dein Bot heißen?',
    placeholder: 'Mein Discord Bot',
    validate(value) {
      if (!value || !value.trim()) {
        return 'Bitte gib einen Bot-Namen ein.';
      }
    },
  });

  if (isCancel(botName)) {
    cancel('Abgebrochen.');
    process.exit(0);
  }

  const dbChoice = await select({
    message: 'Welche Datenbank möchtest du verwenden?',
    options: [
      { value: 'json', label: 'JSON (lokale Datei)', hint: 'Einfach, ohne externen Server' },
      { value: 'mysql', label: 'MySQL', hint: 'Produktionsreif mit mysql2' },
      { value: 'none', label: 'Keine', hint: 'In-Memory-Stub ohne Persistenz' },
    ],
  });

  if (isCancel(dbChoice)) {
    cancel('Abgebrochen.');
    process.exit(0);
  }

  const resolvedTarget = path.resolve(targetDir);

  if (fs.existsSync(resolvedTarget)) {
    const entries = fs.readdirSync(resolvedTarget);
    if (entries.length > 0) {
      const hasPackageJson = fs.existsSync(path.join(resolvedTarget, 'package.json'));
      if (hasPackageJson) {
        cancel('Das Zielverzeichnis enthält bereits ein package.json. Wähle ein leeres Verzeichnis.');
        process.exit(1);
      }
    }
  }

  ensureDir(resolvedTarget);

  const s = spinner();
  s.start('Projektstruktur wird erstellt…');

  try {
    scaffoldProject(resolvedTarget, botName.trim(), dbChoice);
    s.message('Abhängigkeiten werden installiert…');
    installDependencies(resolvedTarget, dbChoice);
    s.stop('Projekt erfolgreich erstellt.');
  } catch (error) {
    s.stop('Fehler beim Erstellen des Projekts.');
    console.error(error.message);
    process.exit(1);
  }

  note(
    [
      `Verzeichnis: ${resolvedTarget}`,
      `Datenbank:   ${dbChoice}`,
      '',
      'Nächste Schritte:',
      '  1. .env mit deinen Discord-Credentials befüllen',
      '  2. npm start',
    ].join('\n'),
    'Fertig'
  );

  outro(`Bot "${botName}" ist bereit. Viel Erfolg!`);
}

async function main() {
  const { command, targetDir } = parseArgs(process.argv);

  if (command === 'help') {
    printHelp();
    process.exit(0);
  }

  if (command === 'version') {
    printVersion();
    process.exit(0);
  }

  if (!COMMANDS.includes(command)) {
    console.error(`Unbekannter Befehl: ${command}`);
    printHelp();
    process.exit(1);
  }

  if (command === 'init') {
    await runInit(targetDir);
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = {
  scaffoldProject,
  installDependencies,
  slugify,
};
