const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require('discord.js');

const BUTTON_STYLES = {
  primary: ButtonStyle.Primary,
  secondary: ButtonStyle.Secondary,
  success: ButtonStyle.Success,
  danger: ButtonStyle.Danger,
  link: ButtonStyle.Link,
};

class ComponentFactory {
  Button(options = {}) {
    const button = new ButtonBuilder()
      .setLabel(options.label)
      .setStyle(BUTTON_STYLES[options.style] || ButtonStyle.Secondary)
      .setDisabled(Boolean(options.disabled));

    if (options.style === 'link') {
      button.setURL(options.url);
    } else {
      button.setCustomId(options.id || options.customId);
    }

    if (options.emoji) button.setEmoji(options.emoji);
    return button;
  }

  Select(options = {}) {
    return new StringSelectMenuBuilder()
      .setCustomId(options.id || options.customId)
      .setPlaceholder(options.placeholder || 'Auswählen…')
      .setMinValues(options.minValues ?? 1)
      .setMaxValues(options.maxValues ?? 1)
      .addOptions(
        (options.options || []).map((opt) => ({
          label: opt.label,
          value: opt.value,
          description: opt.description,
          emoji: opt.emoji,
          default: opt.default ?? false,
        }))
      );
  }

  Input(options = {}) {
    const input = new TextInputBuilder()
      .setCustomId(options.id || options.customId)
      .setLabel(options.label)
      .setStyle(options.style === 'Paragraph' ? TextInputStyle.Paragraph : TextInputStyle.Short)
      .setRequired(options.required !== false);

    if (options.placeholder) input.setPlaceholder(options.placeholder);
    if (options.value) input.setValue(options.value);
    if (options.minLength !== undefined) input.setMinLength(options.minLength);
    if (options.maxLength !== undefined) input.setMaxLength(options.maxLength);

    return input;
  }

  Row(...components) {
    const row = new ActionRowBuilder();
    for (const component of components) {
      row.addComponents(component);
    }
    return row;
  }

  Modal(options = {}) {
    const modal = new ModalBuilder()
      .setCustomId(options.id || options.customId)
      .setTitle(options.title || 'Eingabe');

    for (const field of options.fields || []) {
      modal.addComponents(this.Row(this.Input(field)));
    }

    return modal;
  }
}

module.exports = new ComponentFactory();
module.exports.ComponentFactory = ComponentFactory;
