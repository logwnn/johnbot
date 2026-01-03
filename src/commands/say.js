import { SlashCommandBuilder } from "discord.js";
import { logEvent } from "../utils/logger.js";

export default {
  name: "say",
  description: "Make John say something.",
  permissions: [],
  data: new SlashCommandBuilder()
    .setName("say")
    .setDescription("Make John say something")
    .addStringOption((opt) =>
      opt.setName("instruction").setDescription("Text to send").setRequired(true)
    ),
  async executeSlash(client, interaction) {
    const instruction = interaction.options.getString("instruction");
    if (!instruction)
      return interaction.reply({ content: "Please provide some text.", ephemeral: true });
    await interaction.reply({ content: instruction });
  },
};
