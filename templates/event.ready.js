const { Events, ActivityType } = require('discord.js');

module.exports = {
  name: Events.ClientReady,
  once: true,
  execute(_readyClient, client, _db, _utils) {
    console.log(`[discord] Eingeloggt als ${client.user.tag}`);
    console.log(`[discord] Aktiv in ${client.guilds.cache.size} Server(n)`);

    client.user.setActivity({
      name: `${client.config.bot.prefix}help | ${client.config.bot.name}`,
      type: ActivityType.Playing,
    });
  },
};
