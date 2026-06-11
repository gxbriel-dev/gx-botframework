const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Zeigt die aktuelle Bot-Latenz an.'),

  async execute(ctx) {
    const roundtrip = Date.now() - ctx.interaction.createdTimestamp;
    const wsPing = ctx.client.ws.ping;

    await ctx.success(
      `Roundtrip: **${roundtrip}ms**\nWebSocket: **${wsPing}ms**`,
      { ephemeral: true }
    );
  },
};
