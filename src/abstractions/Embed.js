const { EmbedBuilder } = require('discord.js');

const PRESETS = {
  success: { color: '#57F287', emoji: '✅', title: 'Erfolg' },
  error: { color: '#ED4245', emoji: '❌', title: 'Fehler' },
  warn: { color: '#FEE75C', emoji: '⚠️', title: 'Warnung' },
  info: { color: '#5865F2', emoji: 'ℹ️', title: 'Info' },
};

class EmbedFactory {
  constructor(defaultFooter = null) {
    this._defaultFooter = defaultFooter;
  }

  _base(type, description, extra = {}) {
    const preset = PRESETS[type];
    const embed = new EmbedBuilder()
      .setColor(extra.color || preset.color)
      .setTitle(extra.title || `${preset.emoji} ${preset.title}`)
      .setDescription(description)
      .setTimestamp(extra.timestamp !== false ? new Date() : null);

    const footer = extra.footer ?? this._defaultFooter;
    if (footer) embed.setFooter({ text: footer });

    if (extra.thumbnail) embed.setThumbnail(extra.thumbnail);
    if (extra.image) embed.setImage(extra.image);
    if (Array.isArray(extra.fields)) {
      for (const field of extra.fields) {
        embed.addFields(field);
      }
    }

    return embed;
  }

  Success(description, options = {}) {
    return this._base('success', description, options);
  }

  Error(description, options = {}) {
    return this._base('error', description, options);
  }

  Warn(description, options = {}) {
    return this._base('warn', description, options);
  }

  Info(description, options = {}) {
    return this._base('info', description, options);
  }

  User(user, options = {}) {
    const description = options.description || `**${user.tag || user.username}** (\`${user.id}\`)`;
    return this._base('info', description, {
      title: options.title || '👤 Benutzer',
      thumbnail: user.displayAvatarURL?.({ size: 128 }) || options.thumbnail,
      ...options,
    });
  }

  Custom(options = {}) {
    const embed = new EmbedBuilder();
    if (options.color) embed.setColor(options.color);
    if (options.title) embed.setTitle(options.title);
    if (options.description) embed.setDescription(options.description);
    if (options.footer) embed.setFooter({ text: options.footer });
    if (options.timestamp !== false) embed.setTimestamp(new Date());
    return embed;
  }
}

module.exports = EmbedFactory;
