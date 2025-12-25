import { SlashCommandBuilder } from "discord.js";
import { logEvent } from "../utils/logger.js";

export default {
  name: "say",
  description: "Make the bot say something (owner only).",
  permissions: ["OWNER"],
  data: new SlashCommandBuilder()
    .setName("say")
    .setDescription("Make the bot say something")
    .addStringOption((opt) => opt.setName("instruction").setDescription("Text to send").setRequired(true)),
  async executeSlash(client, interaction) {
    const instruction = interaction.options.getString("instruction");
    if (!instruction) return interaction.reply({ content: "Please provide some text.", ephemeral: true });
    try {
      logEvent("ADMIN", `say executed by ${interaction.user.id} | text_snip=${instruction.slice(0, 120).replace(/\n/g, " ")}`);
    } catch {}
    await interaction.reply({ content: instruction });
  },
};
