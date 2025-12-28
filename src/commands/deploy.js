import { SlashCommandBuilder } from "discord.js";
import { logEvent } from "../utils/logger.js";

export default {
  name: "deploy",
  description: "Deploy slash commands.",
  permissions: ["OWNER"],
  data: new SlashCommandBuilder()
    .setName("deploy")
    .setDescription("Deploy slash commands")
    .addStringOption((o) =>
      o
        .setName("scope")
        .setDescription("Scope to deploy")
        .setRequired(true)
        .addChoices(
          { name: "global", value: "global" },
          { name: "guild", value: "guild" },
          { name: "both", value: "both" }
        )
    )
    .addStringOption((o) =>
      o.setName("guild_id").setDescription("Optional guild id to deploy only to that guild")
    ),

  async executeSlash(client, interaction) {
    // default to guild-only and perform a reset so we start clean
    const scope = interaction.options.getString("scope") || "guild";
    const guildId = interaction.options.getString("guild_id") || null;
    const { registerSlashCommands } = await import("../handlers/slashHandler.js");
    try {
      logEvent(
        "ADMIN",
        `Deploy requested by ${interaction.user.id} (scope=${scope} guild=${guildId || "none"})`
      );
      await interaction.reply({
        content: `Deploying commands (${scope}) with full reset...`,
        ephemeral: true,
      });
      const result = await registerSlashCommands(client, { scope, guildId, reset: true });
      logEvent(
        "ADMIN",
        `Deploy completed by ${interaction.user.id} | registered=${result.registered || 0}`
      );
      await interaction.editReply({
        content: `Done. Registered ${result.registered || 0} command entries.`,
      });
    } catch (e) {
      logEvent("ERROR", `Deploy failed | ${e.stack}`);
      try {
        if (!interaction.replied)
          await interaction.reply({ content: "Failed to deploy commands.", ephemeral: true });
        else await interaction.editReply({ content: `Failed to deploy: ${e.stack}` });
      } catch {}
    }
  },
};
