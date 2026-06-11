const fs = require('fs');
const path = require('path');
const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  MessageFlags,
} = require('discord.js');

const BUTTON_STYLES = {
  primary: ButtonStyle.Primary,
  secondary: ButtonStyle.Secondary,
  success: ButtonStyle.Success,
  danger: ButtonStyle.Danger,
  link: ButtonStyle.Link,
};

const COMPONENTS_JSON = 'components.json';

class ComponentLoader {
  constructor(projectRoot, config) {
    this.projectRoot = projectRoot;
    this.config = config;
    this.registry = {};
    this._loaded = false;
    this._filePath = path.join(projectRoot, 'src', 'data', COMPONENTS_JSON);
  }

  load() {
    this.registry = {};

    if (!fs.existsSync(this._filePath)) {
      console.warn(`[components] ${COMPONENTS_JSON} nicht gefunden – leere Registry.`);
      this._loaded = true;
      return this.registry;
    }

    try {
      const parsed = JSON.parse(fs.readFileSync(this._filePath, 'utf8'));
      this.registry = parsed.components || parsed;
    } catch (error) {
      console.error(`[components] ${COMPONENTS_JSON} konnte nicht gelesen werden:`, error.message);
      this.registry = {};
    }

    this._loaded = true;
    console.log(`[components] ${Object.keys(this.registry).length} Eintrag/Einträge aus ${COMPONENTS_JSON} geladen.`);
    return this.registry;
  }

  reload() {
    this._loaded = false;
    return this.load();
  }

  _replacePlaceholders(value, placeholders = {}) {
    if (typeof value === 'string') {
      return value.replace(/\{(\w+)\}/g, (_, key) => {
        if (placeholders[key] !== undefined) return String(placeholders[key]);
        return `{${key}}`;
      });
    }

    if (Array.isArray(value)) {
      return value.map((item) => this._replacePlaceholders(item, placeholders));
    }

    if (value !== null && typeof value === 'object') {
      const result = {};
      for (const [key, val] of Object.entries(value)) {
        result[key] = this._replacePlaceholders(val, placeholders);
      }
      return result;
    }

    return value;
  }

  _isComponentsV2(definition) {
    if (Array.isArray(definition)) return true;
    if (definition?.v2) return true;
    if (definition?.componentsV2) return true;

    const components = definition?.components;
    if (!Array.isArray(components) || components.length === 0) return false;

    const first = components[0];
    return typeof first?.type === 'number' && first.type >= 1;
  }

  _extractV2Components(definition) {
    if (Array.isArray(definition)) return definition;
    if (Array.isArray(definition.v2)) return definition.v2;
    if (Array.isArray(definition.componentsV2)) return definition.componentsV2;
    if (Array.isArray(definition.components)) return definition.components;
    return [];
  }

  _buildEmbed(definition) {
    const embed = new EmbedBuilder()
      .setColor(definition.color || this.config?.embed?.color || '#5865F2');

    if (definition.title) embed.setTitle(definition.title);
    if (definition.description) embed.setDescription(definition.description);
    if (definition.url) embed.setURL(definition.url);
    if (definition.thumbnail) embed.setThumbnail(definition.thumbnail);
    if (definition.image) embed.setImage(definition.image);
    if (definition.timestamp !== false) embed.setTimestamp(new Date());
    if (definition.footer) {
      embed.setFooter({
        text: definition.footer,
        iconURL: definition.footerIcon || undefined,
      });
    } else if (this.config?.embed?.footer) {
      embed.setFooter({ text: this.config.embed.footer });
    }

    if (Array.isArray(definition.fields)) {
      for (const field of definition.fields) {
        embed.addFields({
          name: field.name,
          value: field.value,
          inline: field.inline ?? false,
        });
      }
    }

    return embed;
  }

  _buildButtons(rowDefinition) {
    const row = new ActionRowBuilder();

    for (const btn of rowDefinition.buttons || []) {
      const button = new ButtonBuilder()
        .setLabel(btn.label)
        .setStyle(BUTTON_STYLES[btn.style] || ButtonStyle.Secondary)
        .setDisabled(Boolean(btn.disabled));

      if (btn.style === 'link') {
        button.setURL(btn.url);
      } else {
        button.setCustomId(btn.id || btn.customId);
      }

      if (btn.emoji) button.setEmoji(btn.emoji);
      row.addComponents(button);
    }

    return row;
  }

  _buildSelectMenu(definition) {
    const menu = new StringSelectMenuBuilder()
      .setCustomId(definition.id || definition.customId)
      .setPlaceholder(definition.placeholder || 'Auswählen…')
      .setMinValues(definition.minValues ?? 1)
      .setMaxValues(definition.maxValues ?? 1)
      .addOptions(
        (definition.options || []).map((option) => ({
          label: option.label,
          value: option.value,
          description: option.description,
          emoji: option.emoji,
          default: option.default ?? false,
        }))
      );

    if (definition.disabled) menu.setDisabled(true);
    return new ActionRowBuilder().addComponents(menu);
  }

  _buildLegacy(definition) {
    const payload = {};

    if (definition.content) payload.content = definition.content;

    if (Array.isArray(definition.embeds)) {
      payload.embeds = definition.embeds.map((embedDef) => this._buildEmbed(embedDef));
    } else if (definition.embed) {
      payload.embeds = [this._buildEmbed(definition.embed)];
    }

    const rows = [];

    if (Array.isArray(definition.components)) {
      for (const componentDef of definition.components) {
        if (componentDef.type === 'buttons' || componentDef.buttons) {
          rows.push(this._buildButtons(componentDef));
        } else if (componentDef.type === 'select' || componentDef.options) {
          rows.push(this._buildSelectMenu(componentDef));
        }
      }
    }

    if (Array.isArray(definition.buttonRows)) {
      for (const rowDef of definition.buttonRows) {
        rows.push(this._buildButtons(rowDef));
      }
    }

    if (definition.selectMenu) {
      rows.push(this._buildSelectMenu(definition.selectMenu));
    }

    if (rows.length > 0) payload.components = rows;

    return payload;
  }

  build(key, placeholders = {}) {
    if (!this._loaded) this.load();

    const definition = this.registry[key];
    if (!definition) {
      throw new Error(`[components] Schlüssel "${key}" nicht in components.json gefunden.`);
    }

    const resolved = this._replacePlaceholders(structuredClone(definition), placeholders);

    if (this._isComponentsV2(resolved)) {
      const components = this._extractV2Components(resolved);
      return {
        components,
        flags: MessageFlags.IsComponentsV2,
      };
    }

    return this._buildLegacy(resolved);
  }

  buildV2(key, placeholders = {}) {
    const payload = this.build(key, placeholders);
    if (!payload.flags) {
      payload.flags = MessageFlags.IsComponentsV2;
    }
    return payload;
  }
}

module.exports = ComponentLoader;
