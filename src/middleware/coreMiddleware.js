function createPermissionMiddleware() {
  return async (ctx, next) => {
    const permissions = ctx.command?.permissions;
    if (!permissions) return next();

    const member = ctx.member;
    if (!member) {
      await ctx.warn('Dieser Befehl kann nur auf einem Server verwendet werden.');
      return;
    }

    if (Array.isArray(permissions.roles) && permissions.roles.length > 0) {
      const hasRole = permissions.roles.some((role) => ctx.utils.CheckRole(member, role));
      if (!hasRole) {
        await ctx.warn('Du hast nicht die erforderliche Rolle für diesen Befehl.');
        return;
      }
    }

    const discordPerms = permissions.discord || permissions.permissions || [];
    if (discordPerms.length > 0) {
      const hasAll = discordPerms.every((perm) => ctx.utils.CheckPermission(member, perm));
      if (!hasAll) {
        await ctx.warn('Dir fehlen die erforderlichen Discord-Berechtigungen.');
        return;
      }
    }

    if (permissions.ownerOnly && !ctx.utils.IsOwner(ctx.guild, ctx.user.id)) {
      await ctx.warn('Nur der Serverbesitzer kann diesen Befehl nutzen.');
      return;
    }

    if (permissions.adminOnly && !ctx.utils.IsAdmin(member)) {
      await ctx.warn('Nur Administratoren können diesen Befehl nutzen.');
      return;
    }

    return next();
  };
}

function createCooldownMiddleware() {
  return async (ctx, next) => {
    const command = ctx.command;
    const cooldownSeconds = command?.cooldown || 0;

    if (cooldownSeconds <= 0) return next();

    const commandName = command.data?.name || command.name;
    const remaining = ctx.client.commands.isOnCooldown(ctx.user.id, commandName, cooldownSeconds);

    if (remaining !== null) {
      await ctx.warn(`Bitte warte noch **${remaining}s**, bevor du diesen Befehl erneut nutzt.`);
      return;
    }

    await next();

    ctx.client.commands.setCooldown(ctx.user.id, commandName, cooldownSeconds);
  };
}

function createErrorMiddleware() {
  return async (ctx, next) => {
    try {
      await next();
    } catch (error) {
      console.error(`[commands] Fehler bei /${ctx.command?.data?.name || ctx.command?.name}:`, error);
      await ctx.error('Ein interner Fehler ist aufgetreten.');
    }
  };
}

module.exports = {
  createPermissionMiddleware,
  createCooldownMiddleware,
  createErrorMiddleware,
};
