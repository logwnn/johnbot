import { askModel } from "../utils/llm.js";
import config from "../utils/config.js";
import { SlashCommandBuilder } from "discord.js";
import { logEvent } from "../utils/logger.js";

export default {
  name: "askmodel",
  description: "Ask model questions",
  permissions: ["OWNER"],
  data: new SlashCommandBuilder()
    .setName("askmodel")
    .setDescription("Ask model questions")
    .addStringOption((opt) =>
      opt.setName("prompt").setDescription("Prompt to ask the model").setRequired(true)
    ),
  async executeSlash(client, interaction) {
    try {
      const replyMessage = await interaction.reply({
        content: "Thinking...",
        ephemeral: false,
        fetchReply: true,
      });
      const userText = interaction.options.getString("prompt");
      const full = await askModel(userText);
      if (full) {
        const truncated =
          full.length > (config.MAX_RESPONSE_LENGTH || 1900)
            ? full.slice(0, (config.MAX_RESPONSE_LENGTH || 1900) - 3) + "..."
            : full;
        if (replyMessage && replyMessage.editable) await replyMessage.edit(truncated);
      }
    } catch (err) {
      logEvent("ERROR", `askmodel command failed | ${err?.stack || err}`);
      try {
        if (!interaction.replied)
          await interaction.reply({ content: "Failed to run askmodel.", ephemeral: true });
      } catch {}
    }
    logEvent("SLASH-CMD", `User ${interaction.user.id} | /askmodel`);
  },
};
