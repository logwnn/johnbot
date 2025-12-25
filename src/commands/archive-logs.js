import { SlashCommandBuilder } from "discord.js";
import { archiveOldLogs } from "../utils/logArchive.js";
import { logEvent } from "../utils/logger.js";

export default {
  name: "archive-logs",
  description: "Archive old log files (owner only)",
  permissions: ["OWNER"],
  data: new SlashCommandBuilder()
    .setName("archive-logs")
    .setDescription("Archive old log files")
    .addIntegerOption((o) => o.setName("days").setDescription("Archive files older than N days").setRequired(false)),
  async executeSlash(client, interaction) {
    const days = interaction.options.getInteger("days") || 7;
    await interaction.reply({ content: `Archiving logs older than ${days} days...`, ephemeral: true });
    try {
      const count = await archiveOldLogs(days);
      await interaction.editReply({ content: `Archived ${count} files.` });
      logEvent("ADMIN", `Archived ${count} logs (requested by ${interaction.user.id})`);
    } catch (e) {
      logEvent("ERROR", `Archive logs failed | ${e.message}`);
      try {
        await interaction.editReply({ content: `Failed to archive logs: ${e.message}` });
      } catch {}
    }
  },
};
