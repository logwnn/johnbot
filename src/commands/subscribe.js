import { SlashCommandBuilder, ChannelType } from "discord.js";
import { logEvent } from "../utils/logger.js";
import { loadVoiceStateSubscribers, saveVoiceStateSubscribers } from "../utils/memory.js";

export default {
  name: "subscribe",
  description: "Get pinged when someone joins specific voice channels",
  permissions: [],
  data: new SlashCommandBuilder()
    .setName("subscribe")
    .setDescription("Get pinged when someone joins specific voice channels")
    .addChannelOption((o) =>
      o
        .setName("vc")
        .setDescription("The voice channel to subscribe to")
        .addChannelTypes(ChannelType.GuildVoice)
        .setRequired(true)
    ),
  async executeSlash(client, interaction) {
    const userId = interaction.user.id;
    const channel = interaction.options.getChannel("vc");
    if (!channel || channel.type !== ChannelType.GuildVoice) {
      return interaction.reply({
        content: "That is not a valid voice channel.",
        ephemeral: true,
      });
    }
    const subs = loadVoiceStateSubscribers();
    if (!subs[userId]) {
      subs[userId] = [];
    }
    const index = subs[userId].indexOf(channel.id);
    if (index !== -1) {
      subs[userId].splice(index, 1);
      saveVoiceStateSubscribers(subs);
      return interaction.reply({
        content: `You have been unsubscribed from **${channel.name}**.`,
        ephemeral: true,
      });
    }
    subs[userId].push(channel.id);
    saveVoiceStateSubscribers(subs);
    logEvent("VC-SUBSCRIBE", `user=${userId} channel=${channel.id}`);
    return interaction.reply({
      content: `Subscribed to **${channel.name}**.`,
      ephemeral: true,
    });
  },
};
