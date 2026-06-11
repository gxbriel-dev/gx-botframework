const crypto = require('crypto');
const { PermissionFlagsBits, EmbedBuilder } = require('discord.js');

const EMBED_TYPES = {
  success: { color: '#57F287', emoji: '✅', title: 'Erfolg' },
  error: { color: '#ED4245', emoji: '❌', title: 'Fehler' },
  warn: { color: '#FEE75C', emoji: '⚠️', title: 'Warnung' },
  info: { color: '#5865F2', emoji: 'ℹ️', title: 'Info' },
};

const TIME_UNITS = {
  ms: 1,
  s: 1000,
  sec: 1000,
  sek: 1000,
  sekunde: 1000,
  sekunden: 1000,
  m: 60 * 1000,
  min: 60 * 1000,
  minute: 60 * 1000,
  minuten: 60 * 1000,
  h: 60 * 60 * 1000,
  std: 60 * 60 * 1000,
  stunde: 60 * 60 * 1000,
  stunden: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
  tag: 24 * 60 * 60 * 1000,
  tage: 24 * 60 * 60 * 1000,
  w: 7 * 24 * 60 * 60 * 1000,
  woche: 7 * 24 * 60 * 60 * 1000,
  wochen: 7 * 24 * 60 * 60 * 1000,
};

class UtilsManager {
  constructor(client) {
    this.client = client;
  }

  /**
   * Wandelt User, Member, Role, Channel, Snowflake oder Mention in eine ID um.
   */
  ExtractId(input) {
    if (!input) return null;

    if (typeof input === 'string') {
      const mentionMatch = input.match(/^<@!?(\d+)>$/) || input.match(/^<#(\d+)>$/) || input.match(/^<@&(\d+)>$/);
      if (mentionMatch) return mentionMatch[1];
      if (/^\d{17,20}$/.test(input)) return input;
      return null;
    }

    if (typeof input === 'object' && input.id) {
      return String(input.id);
    }

    return null;
  }

  async GetGuild(guildId) {
    const id = this.ExtractId(guildId) || guildId;
    const cached = this.client.guilds.cache.get(id);
    if (cached) return cached;
    return this.client.guilds.fetch(id);
  }

  async GetUser(userInput) {
    const resolved = await this.ResolveUser(userInput);
    if (!resolved) {
      throw new Error(`[utils] User konnte nicht aufgelöst werden: ${userInput}`);
    }
    return resolved;
  }

  async ResolveUser(userInput) {
    if (!userInput) return null;

    if (userInput.user && userInput.guild) {
      return userInput.user;
    }

    if (userInput.username && userInput.id && !userInput.guild) {
      return userInput;
    }

    const id = this.ExtractId(userInput);
    if (!id) return null;

    try {
      const cached = this.client.users.cache.get(id);
      if (cached) return cached;
      return await this.client.users.fetch(id);
    } catch {
      return null;
    }
  }

  async GetMember(guildId, memberInput) {
    const resolved = await this.ResolveMember(guildId, memberInput);
    if (!resolved) {
      throw new Error(`[utils] Mitglied konnte nicht aufgelöst werden: ${memberInput}`);
    }
    return resolved;
  }

  async ResolveMember(guildId, memberInput) {
    if (!guildId || !memberInput) return null;

    if (memberInput.guild && memberInput.user && memberInput.id) {
      return memberInput;
    }

    const userId = this.ExtractId(memberInput);
    if (!userId) return null;

    try {
      const guild = await this.GetGuild(guildId);
      const cached = guild.members.cache.get(userId);
      if (cached) return cached;
      return await guild.members.fetch(userId);
    } catch {
      return null;
    }
  }

  async GetChannel(guildId, channelInput) {
    const resolved = await this.ResolveChannel(guildId, channelInput);
    if (!resolved) {
      throw new Error(`[utils] Kanal konnte nicht aufgelöst werden: ${channelInput}`);
    }
    return resolved;
  }

  async ResolveChannel(guildId, channelInput) {
    if (!channelInput) return null;

    if (typeof channelInput.isTextBased === 'function') {
      return channelInput;
    }

    const channelId = this.ExtractId(channelInput);
    if (!channelId) return null;

    try {
      if (guildId) {
        const guild = await this.GetGuild(guildId);
        const cached = guild.channels.cache.get(channelId);
        if (cached) return cached;
        return await guild.channels.fetch(channelId);
      }

      const cached = this.client.channels.cache.get(channelId);
      if (cached) return cached;
      return await this.client.channels.fetch(channelId);
    } catch {
      return null;
    }
  }

  async GetRole(guildId, roleInput) {
    const resolved = await this.ResolveRole(guildId, roleInput);
    if (!resolved) {
      throw new Error(`[utils] Rolle konnte nicht aufgelöst werden: ${roleInput}`);
    }
    return resolved;
  }

  async ResolveRole(guildId, roleInput) {
    if (!guildId || !roleInput) return null;

    if (roleInput.guild && roleInput.hexColor !== undefined) {
      return roleInput;
    }

    const roleId = this.ExtractId(roleInput);
    if (!roleId) return null;

    try {
      const guild = await this.GetGuild(guildId);
      const cached = guild.roles.cache.get(roleId);
      if (cached) return cached;
      return await guild.roles.fetch(roleId);
    } catch {
      return null;
    }
  }

  CheckRole(member, roleNameOrId) {
    if (!member || !member.roles) return false;

    if (member.roles.cache.has(roleNameOrId)) return true;

    return member.roles.cache.some(
      (role) => role.name.toLowerCase() === String(roleNameOrId).toLowerCase()
    );
  }

  CheckPermission(member, permissionFlag) {
    if (!member || !member.permissions) return false;

    if (typeof permissionFlag === 'string') {
      const flag = PermissionFlagsBits[permissionFlag] || permissionFlag;
      return member.permissions.has(flag);
    }

    return member.permissions.has(permissionFlag);
  }

  IsOwner(guild, userId) {
    if (!guild) return false;

    const config = this.client.config;
    if (Array.isArray(config?.bot?.owners) && config.bot.owners.includes(userId)) {
      return true;
    }

    return guild.ownerId === userId;
  }

  IsAdmin(member) {
    if (!member) return false;
    return (
      this.CheckPermission(member, 'Administrator')
      || this.IsOwner(member.guild, member.id)
    );
  }

  GenerateId(length = 16) {
    const bytes = Math.ceil(length / 2);
    return crypto.randomBytes(bytes).toString('hex').slice(0, length);
  }

  Sleep(ms) {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }

  Random(min, max) {
    const minVal = Math.ceil(min);
    const maxVal = Math.floor(max);
    return Math.floor(Math.random() * (maxVal - minVal + 1)) + minVal;
  }

  RandomElement(array) {
    if (!Array.isArray(array) || array.length === 0) return undefined;
    return array[this.Random(0, array.length - 1)];
  }

  FormatTime(ms) {
    const total = Math.max(0, Math.floor(ms));
    const units = [
      { label: 'w', value: TIME_UNITS.w },
      { label: 'd', value: TIME_UNITS.d },
      { label: 'h', value: TIME_UNITS.h },
      { label: 'm', value: TIME_UNITS.m },
      { label: 's', value: TIME_UNITS.s },
    ];

    let remaining = total;
    const parts = [];

    for (const unit of units) {
      if (remaining >= unit.value) {
        const count = Math.floor(remaining / unit.value);
        remaining %= unit.value;
        parts.push(`${count}${unit.label}`);
      }
    }

    if (parts.length === 0) return '0s';
    return parts.join(' ');
  }

  ParseTime(input) {
    if (typeof input === 'number' && Number.isFinite(input)) return input;
    if (typeof input !== 'string') {
      throw new Error('[utils] ParseTime erwartet einen String oder eine Zahl.');
    }

    const trimmed = input.trim().toLowerCase();
    if (!trimmed) return 0;

    if (/^\d+$/.test(trimmed)) return Number(trimmed);

    const pattern = /(\d+(?:\.\d+)?)\s*([a-zäöü]+)/gi;
    let match;
    let total = 0;
    let matched = false;

    while ((match = pattern.exec(trimmed)) !== null) {
      matched = true;
      const amount = Number(match[1]);
      const unit = match[2];
      const multiplier = TIME_UNITS[unit];

      if (!multiplier) {
        throw new Error(`[utils] Unbekannte Zeiteinheit: "${unit}"`);
      }

      total += amount * multiplier;
    }

    if (!matched) {
      throw new Error(`[utils] Zeit-String konnte nicht geparst werden: "${input}"`);
    }

    return Math.floor(total);
  }

  _buildTypeEmbed(type, message) {
    const meta = EMBED_TYPES[type] || EMBED_TYPES.info;
    const footer = this.client.config?.embed?.footer;

    return new EmbedBuilder()
      .setColor(meta.color)
      .setTitle(`${meta.emoji} ${meta.title}`)
      .setDescription(message)
      .setTimestamp()
      .setFooter(footer ? { text: footer } : null);
  }

  async SendMessage(channelId, content, options = {}) {
    const channel = await this.GetChannel(options.guildId, channelId);

    if (!channel || !channel.isTextBased()) {
      throw new Error(`[utils] Kanal ${channelId} ist kein Textkanal.`);
    }

    const payload = {};

    if (options.componentKey) {
      const built = this.client.components.build(options.componentKey, options.placeholders || {});
      Object.assign(payload, built);
      if (typeof content === 'string' && content) payload.content = content;
    } else if (options.type && EMBED_TYPES[options.type]) {
      payload.embeds = [this._buildTypeEmbed(options.type, String(content))];
    } else if (typeof content === 'string') {
      payload.content = content;
    } else if (content && typeof content === 'object') {
      Object.assign(payload, content);
    }

    if (options.embeds) payload.embeds = options.embeds;
    if (options.components) payload.components = options.components;
    if (options.files) payload.files = options.files;
    if (options.flags !== undefined) payload.flags = options.flags;

    return channel.send(payload);
  }

  _getOAuthCredentials() {
    const config = this.client.config || {};
    const clientId = process.env.CLIENT_ID || config.oauth?.clientId;
    const clientSecret = process.env.CLIENT_SECRET || config.oauth?.clientSecret;

    if (!clientId || !clientSecret) {
      throw new Error('[utils] OAuth2: CLIENT_ID und CLIENT_SECRET müssen gesetzt sein.');
    }

    return { clientId, clientSecret };
  }

  async exchangeOAuthCode(code, redirectUri) {
    const { clientId, clientSecret } = this._getOAuthCredentials();

    const body = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    });

    const response = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(`[utils] OAuth2 Token-Austausch fehlgeschlagen: ${data.error || response.statusText}`);
    }

    return data;
  }

  async fetchUserData(accessToken) {
    const response = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(`[utils] OAuth2 User-Daten konnten nicht geladen werden: ${data.message || response.statusText}`);
    }

    const snowflake = BigInt(data.id);
    const createdAt = new Date(Number((snowflake >> 22n) + 1420070400000n));

    return {
      id: data.id,
      username: data.username,
      globalName: data.global_name || data.username,
      discriminator: data.discriminator,
      avatar: data.avatar,
      avatarUrl: data.avatar
        ? `https://cdn.discordapp.com/avatars/${data.id}/${data.avatar}.png`
        : `https://cdn.discordapp.com/embed/avatars/${Number(data.discriminator) % 5}.png`,
      createdAt,
    };
  }

  async fetchUserGuilds(accessToken) {
    const response = await fetch('https://discord.com/api/users/@me/guilds', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(`[utils] OAuth2 Guild-Liste konnte nicht geladen werden: ${data.message || response.statusText}`);
    }

    return data;
  }
}

module.exports = UtilsManager;
