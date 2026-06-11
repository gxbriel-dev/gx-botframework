module.exports = {
  method: 'GET',
  path: '/api/status',
  async execute(_req, res, client) {
    res.json({
      bot: client.config.bot.name,
      ready: client.isReady(),
      guilds: client.guilds.cache.size,
      database: client.config.database.type,
      uptime: process.uptime(),
    });
  },
};
