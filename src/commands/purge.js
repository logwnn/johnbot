import { SlashCommandBuilder } from "discord.js";
import { logEvent } from "../utils/logger.js";

export default {
  name: "purge",
  description: "Delete X amount of messages",
  permissions: ["ADMIN"],
  data: new SlashCommandBuilder()
    .setName("purge")
    .setDescription("Delete X amount of messages")
    .addIntegerOption((opt) =>
      opt.setName("amount").setDescription("X amount of messages").setRequired(true)
    ),
  async executeSlash(client, interaction) {
    const amountToDelete = await interaction.options.getInteger("amount");
    const givenChannel = await client.channels.fetch(interaction.channelId);
    if (!givenChannel) return interaction.reply("No Valid Channel Found");
    if (!amountToDelete) return interaction.reply("Please Provide an Amount");
    try {
      givenChannel.messages.fetch({ limit: amountToDelete }).then(async (messages) => {
        await givenChannel.bulkDelete(messages, true);
        interaction.reply({
          content: `Found ${messages.size} messages in ${givenChannel.name}. Attempting bulk delete.`,
          ephemeral: true,
        });
      });
    } catch (e) {
      logEvent("ERROR", e.stack);
    }
  },
};
