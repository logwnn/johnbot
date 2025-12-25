export default {
  name: "interactionCreate",
  async execute(client, interaction) {
    const { logEvent } = await import("../utils/logger.js");
    try {
      // Slash commands
      if (interaction.isChatInputCommand && interaction.isChatInputCommand()) {
        const name = interaction.commandName;
        logEvent("SLASH-CMD", `User ${interaction.user.id} | Command="/${name}"`);
        const { slashCommands } = await import("../handlers/commandHandler.js");
        const cmd = slashCommands.get(name);
        if (!cmd) {
          logEvent("SLASH-UNKNOWN", `User ${interaction.user.id} attempted /${name} but command module not found`);
          try {
            await interaction.reply({ content: "Command not found.", ephemeral: true });
          } catch {}
          return;
        }

        // permission check
        const fs = await import("fs");
        const path = await import("path");
        const configPath = path.join(process.cwd(), "config.json");
        const config = fs.existsSync(configPath) ? JSON.parse(fs.readFileSync(configPath, "utf8")) : {};
        const ownerId = process.env.BOT_OWNER_ID || config.ownerId;
        const { check } = await import("../utils/permissions.js");
        const memberObj = interaction.member ?? { user: interaction.user, id: interaction.user.id };
        if (!check(cmd.permissions || [], memberObj, ownerId)) {
          logEvent("PERMISSION-DENIED", `Slash /${name} denied for ${interaction.user.id}`);
          try {
            await interaction.reply({ content: "You don't have permission", ephemeral: true });
          } catch {}
          return;
        }

        try {
          if (cmd.executeSlash) await cmd.executeSlash(client, interaction);
          else if (cmd.execute) await cmd.execute(client, interaction, []);
          logEvent("SLASH-CMD", `Executed /${name} by ${interaction.user.id}`);
        } catch (e) {
          logEvent("ERROR", `Slash command ${name} failed | ${e.message}`);
          try {
            if (!interaction.replied) await interaction.reply({ content: "Command failed to execute.", ephemeral: true });
          } catch {}
        }
        return;
      }

      // Buttons
      if (interaction.isButton && interaction.isButton()) {
        logEvent("COMPONENT", `Button ${interaction.customId} pressed by ${interaction.user.id}`);
        const { handleButton } = await import("../handlers/componentHandler.js");
        await handleButton(interaction);
        return;
      }

      // Modals
      if (interaction.isModalSubmit && interaction.isModalSubmit()) {
        logEvent("COMPONENT", `Modal ${interaction.customId} submitted by ${interaction.user.id}`);
        const { handleModal } = await import("../handlers/componentHandler.js");
        await handleModal(interaction);
        return;
      }
    } catch (e) {
      logEvent("ERROR", `Interaction handler failed | ${e.message}`);
      try {
        if (!interaction.replied) await interaction.reply({ content: "Error handling input.", ephemeral: true });
      } catch {}
    }
  },
};
