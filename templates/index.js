require('dotenv').config();

const path = require('path');
const { BotClient } = require('gx-botframework');

const client = new BotClient({
  projectRoot: __dirname,
});

process.on('unhandledRejection', (error) => {
  console.error('[fatal] Unhandled Rejection:', error);
});

process.on('SIGINT', async () => {
  await client.Stop();
  process.exit(0);
});

client.Start(process.env.DISCORD_TOKEN).catch((error) => {
  console.error('[fatal] Start fehlgeschlagen:', error);
  process.exit(1);
});
