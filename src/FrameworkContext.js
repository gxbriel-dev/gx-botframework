const { ApplicationCommandOptionType, ComponentType } = require('discord.js');
const Component = require('./abstractions/Component');
const EmbedFactory = require('./abstractions/Embed');

class FrameworkContext {
  #interaction;

  constructor(interaction, client, command = null) {
    this.#interaction = interaction;
    this.client = client;
    this.command = command;
    this.db = client.db;
    this.utils = client.utils;
    this.user = interaction.user;
    this.guild = interaction.guild;
    this.channel = interaction.channel;
    this.member = interaction.member;
    this.args = this._buildArgs(interaction);
    this.values = { ...this.args };

    this._embed = new EmbedFactory(client.config?.embed?.footer);
    this._services = client.container;

    this.services = new Proxy(
      {},
      {
        get: (_target, prop) => {
          if (prop === 'then') return undefined;
          return this._services.TryResolve(String(prop));
        },
      }
    );
  }

  /** @deprecated Nutze ctx-Methoden statt direktem Zugriff auf discord.js */
  get interaction() {
    return this.#interaction;
  }

  get Embed() {
    return this._embed;
  }

  get Component() {
    return Component;
  }

  async getUser(input) {
    if (input === undefined) return this.user;
    return this.utils.ResolveUser(input);
  }

  async getMember(input) {
    if (!this.guild) return null;
    if (input === undefined) return this.member;
    return this.utils.ResolveMember(this.guild.id, input);
  }

  async getChannel(input) {
    if (input === undefined) return this.channel;
    return this.utils.ResolveChannel(this.guild?.id ?? null, input);
  }

  async getRole(input) {
    if (!this.guild || !input) return null;
    return this.utils.ResolveRole(this.guild.id, input);
  }

  _resolveLeafValue(interaction, option) {
    const name = option.name;
    switch (option.type) {
      case ApplicationCommandOptionType.String:
        return interaction.options.getString(name);
      case ApplicationCommandOptionType.Integer:
        return interaction.options.getInteger(name);
      case ApplicationCommandOptionType.Number:
        return interaction.options.getNumber(name);
      case ApplicationCommandOptionType.Boolean:
        return interaction.options.getBoolean(name);
      case ApplicationCommandOptionType.User:
        return interaction.options.getUser(name);
      case ApplicationCommandOptionType.Channel:
        return interaction.options.getChannel(name);
      case ApplicationCommandOptionType.Role:
        return interaction.options.getRole(name);
      case ApplicationCommandOptionType.Mentionable:
        return interaction.options.getMentionable(name);
      case ApplicationCommandOptionType.Attachment:
        return interaction.options.getAttachment(name);
      default:
        return option.value ?? null;
    }
  }

  _buildArgs(interaction) {
    const args = {};
    if (!interaction.options?.data) return args;

    const walk = (options, target) => {
      for (const option of options) {
        if (option.type === ApplicationCommandOptionType.Subcommand) {
          target[option.name] = {};
          walk(option.options || [], target[option.name]);
        } else if (option.type === ApplicationCommandOptionType.SubcommandGroup) {
          target[option.name] = {};
          walk(option.options || [], target[option.name]);
        } else {
          target[option.name] = this._resolveLeafValue(interaction, option);
        }
      }
    };

    walk(interaction.options.data, args);
    return args;
  }

  async defer(options = {}) {
    if (this.#interaction.deferred || this.#interaction.replied) return;
    return this.#interaction.deferReply({
      ephemeral: options.ephemeral ?? false,
    });
  }

  async reply(content, options = {}) {
    const payload = { ...options };
    if (typeof content === 'string') payload.content = content;
    else if (content && typeof content === 'object') Object.assign(payload, content);
    if (options.ephemeral !== undefined) payload.ephemeral = options.ephemeral;

    try {
      if (this.#interaction.replied) return this.#interaction.followUp(payload);
      if (this.#interaction.deferred) return this.#interaction.editReply(payload);
      return this.#interaction.reply(payload);
    } catch (error) {
      if (error.code === 'InteractionAlreadyReplied') {
        return this.#interaction.followUp(payload);
      }
      throw error;
    }
  }

  async followUp(content, options = {}) {
    const payload = { ...options };
    if (typeof content === 'string') payload.content = content;
    else if (content && typeof content === 'object') Object.assign(payload, content);
    return this.#interaction.followUp(payload);
  }

  async edit(content, options = {}) {
    const payload = { ...options };
    if (typeof content === 'string') payload.content = content;
    else if (content && typeof content === 'object') Object.assign(payload, content);
    return this.#interaction.editReply(payload);
  }

  async delete() {
    if (this.#interaction.deferred || this.#interaction.replied) {
      return this.#interaction.deleteReply();
    }
    return null;
  }

  async success(message, options = {}) {
    return this.reply({
      embeds: [this._embed.Success(message, options)],
      ephemeral: options.ephemeral !== false,
    });
  }

  async error(message, options = {}) {
    return this.reply({
      embeds: [this._embed.Error(message, options)],
      ephemeral: options.ephemeral !== false,
    });
  }

  async warn(message, options = {}) {
    return this.reply({
      embeds: [this._embed.Warn(message, options)],
      ephemeral: options.ephemeral !== false,
    });
  }

  async info(message, options = {}) {
    return this.reply({
      embeds: [this._embed.Info(message, options)],
      ephemeral: options.ephemeral !== false,
    });
  }

  _normalizeMessagePayload(textOrEmbed) {
    if (typeof textOrEmbed === 'string') return { content: textOrEmbed };
    if (textOrEmbed?.embeds || textOrEmbed?.content || textOrEmbed?.components) return textOrEmbed;
    return { embeds: [textOrEmbed] };
  }

  async _getReplyMessage(initialReply) {
    if (initialReply?.createMessageComponentCollector) return initialReply;
    return this.#interaction.fetchReply();
  }

  async _disableComponents(message, rows) {
    if (!message?.editable) return;
    const { ButtonBuilder, StringSelectMenuBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');

    const disabledRows = rows.map((row) => {
      const newRow = new ActionRowBuilder();
      for (const component of row.components) {
        if (component.data.style === ButtonStyle.Link) {
          newRow.addComponents(ButtonBuilder.from(component));
        } else if (component.data.custom_id) {
          newRow.addComponents(ButtonBuilder.from(component).setDisabled(true));
        } else if (component.data.options) {
          newRow.addComponents(StringSelectMenuBuilder.from(component).setDisabled(true));
        }
      }
      return newRow;
    });

    try {
      await message.edit({ components: disabledRows });
    } catch {
      // ignore
    }
  }

  async askWithButtons(textOrEmbed, buttonsArray, timeout = 60000) {
    const prefix = `ctxbtn_${this.utils.GenerateId(10)}`;
    const row = Component.Row(
      ...buttonsArray.map((btn) =>
        Component.Button({
          id: `${prefix}_${btn.id}`,
          label: btn.label,
          style: btn.style,
          disabled: btn.disabled,
          emoji: btn.emoji,
        })
      )
    );

    const sent = await this.reply({ ...this._normalizeMessagePayload(textOrEmbed), components: [row] });
    const message = await this._getReplyMessage(sent);

    return new Promise((resolve) => {
      const collector = message.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: timeout,
        filter: (i) => i.user.id === this.user.id && i.customId.startsWith(`${prefix}_`),
      });

      collector.on('collect', async (btnInteraction) => {
        try { await btnInteraction.deferUpdate(); } catch { /* ignore */ }
        const selectedId = btnInteraction.customId.slice(prefix.length + 1);
        collector.stop('answered');
        resolve(selectedId);
      });

      collector.on('end', async (_c, reason) => {
        await this._disableComponents(message, [row]);
        if (reason !== 'answered') resolve(null);
      });
    });
  }

  async askWithSelect(textOrEmbed, optionsArray, timeout = 60000) {
    const customId = `ctxsel_${this.utils.GenerateId(10)}`;
    const row = Component.Row(
      Component.Select({
        id: customId,
        options: optionsArray,
      })
    );

    const sent = await this.reply({ ...this._normalizeMessagePayload(textOrEmbed), components: [row] });
    const message = await this._getReplyMessage(sent);

    return new Promise((resolve) => {
      const collector = message.createMessageComponentCollector({
        componentType: ComponentType.StringSelect,
        time: timeout,
        filter: (i) => i.user.id === this.user.id && i.customId === customId,
      });

      collector.on('collect', async (sel) => {
        try { await sel.deferUpdate(); } catch { /* ignore */ }
        const values = [...sel.values];
        collector.stop('answered');
        resolve(values.length === 1 ? values[0] : values);
      });

      collector.on('end', async (_c, reason) => {
        await this._disableComponents(message, [row]);
        if (reason !== 'answered') resolve(null);
      });
    });
  }

  async openModal(title, fieldsArray, timeout = 60000) {
    const modalId = `ctxmodal_${this.utils.GenerateId(12)}`;
    const modal = Component.Modal({
      id: modalId,
      title,
      fields: fieldsArray,
    });

    await this.#interaction.showModal(modal);

    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.client._modalWaiters.delete(modalId);
        resolve(null);
      }, timeout);

      this.client._modalWaiters.set(modalId, {
        userId: this.user.id,
        callback: async (modalInteraction) => {
          clearTimeout(timer);
          this.client._modalWaiters.delete(modalId);
          try {
            if (!modalInteraction.replied && !modalInteraction.deferred) {
              await modalInteraction.deferReply({ ephemeral: true });
            }
          } catch { /* ignore */ }

          const values = {};
          for (const field of fieldsArray) {
            values[field.id] = modalInteraction.fields.getTextInputValue(field.id);
          }
          resolve(values);
        },
      });
    });
  }
}

module.exports = FrameworkContext;
