const { Events } = require('discord.js');
const FrameworkContext = require('./FrameworkContext');

class InteractionHandler {
  constructor(client) {
    this.client = client;
    this._registered = false;
  }

  register() {
    if (this._registered) return;

    this.client.on(Events.InteractionCreate, (interaction) => this.handle(interaction));
    this._registered = true;
    console.log('[handler] Interaction-Handler registriert.');
  }

  async _handleModalSubmit(interaction) {
    const waiter = this.client._modalWaiters.get(interaction.customId);
    if (!waiter) return false;

    if (waiter.userId && waiter.userId !== interaction.user.id) {
      await interaction.reply({ content: 'Dieses Formular ist nicht für dich bestimmt.', ephemeral: true });
      return true;
    }

    await waiter.callback(interaction);
    return true;
  }

  async handle(interaction) {
    if (interaction.isModalSubmit()) {
      const handled = await this._handleModalSubmit(interaction);
      if (handled) return;
    }

    if (!interaction.isChatInputCommand()) return;

    const command = this.client.commands.GetCommand(interaction.commandName);
    if (!command) return;

    const ctx = new FrameworkContext(interaction, this.client, command);

    await this.client.bus.Emit('command:before', { ctx, command });

    await this.client.middleware.run(ctx, async () => {
      await command.execute(ctx);
    });

    await this.client.bus.Emit('command:after', { ctx, command });
  }
}

module.exports = InteractionHandler;
