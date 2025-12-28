import { SlashCommandBuilder, AttachmentBuilder } from "discord.js";
import { loadMemory } from "../utils/memory.js";
import { logEvent } from "../utils/logger.js";

export default {
  name: "export-memory",
  description: "Export your saved memory as JSON (private)",
  permissions: [],
  data: new SlashCommandBuilder()
    .setName("export-memory")
    .setDescription("Export your saved memory as JSON (private)"),
  async executeSlash(client, interaction) {
    const uid = interaction.user.id;
    const all = loadMemory();
    const mem = all[uid] || {};
    const json = JSON.stringify(mem, null, 2);
    try {
      const buf = Buffer.from(json, "utf8");
      const attachment = new AttachmentBuilder(buf, { name: "memory.json" });
      const inGuild = !!interaction.guild;
      await interaction.reply({
        content: "Your memory export:",
        files: [attachment],
        ephemeral: inGuild,
      });
      logEvent("SLASH-CMD", `User ${uid} | /memory-export`);
    } catch (e) {
      logEvent("ERROR", `Memory export failed | ${e.stack}`);
      if (!interaction.replied)
        await interaction.reply({ content: "Failed to export memory.", ephemeral: true });
    }
  },
};
