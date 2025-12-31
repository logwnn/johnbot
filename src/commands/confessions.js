import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { loadConfessions, saveConfessions } from "../utils/memory.js";
import { logEvent } from "../utils/logger.js";

export default {
  name: "confessions",
  description: "Confess things anonymously",
  permissions: [],
  data: new SlashCommandBuilder()
    .setName("confessions")
    .setDescription("Confess things anonymously")
    .addStringOption((o) =>
      o.setName("message").setDescription("Your confession").setRequired(false)
    )
    .addAttachmentOption((o) =>
      o.setName("attachment").setDescription("Image to attach").setRequired(false)
    ),

  async executeSlash(client, interaction) {
    const message = interaction.options.getString("message");
    const attachment = interaction.options.getAttachment("attachment");
    if (!message && !attachment) {
      return interaction.reply({
        content: "You cant submit a blank confession nihaww",
        ephemeral: true,
      });
    }
    const list = loadConfessions();
    const newConfession = {
      index: list.length + 1,
      message: message ?? null,
      attachment: attachment?.url ?? null,
      attachmentName: attachment?.name ?? null,
      // userId: interaction.user.id,
      timestamp: Date.now(),
    };
    list.push(newConfession);
    saveConfessions(list);
    logEvent("SLASH-CMD", `User ${interaction.user.id} | /confessions`);
    const confessionChannelId = process.env.CONFESSION_CHANNEL_ID;
    const confessionChannel = await client.channels.fetch(confessionChannelId);
    if (confessionChannel) {
      const embed = new EmbedBuilder()
        .setTitle(`Anonymous Confession #${newConfession.index}`)
        .setColor(0x2f3136) // dark themed
        .setTimestamp(new Date(newConfession.timestamp))
        .setFooter({ text: "Type /confessions to send a confession" });
      if (newConfession.message) {
        embed.setDescription(newConfession.message);
      } else {
        embed.setDescription("*No message provided*");
      }
      const payload = {
        embeds: [embed],
      };
      const isVideo = (filename) => /\.(mp4|mov|webm|avi|mkv)$/i.test(filename);
      const isImage = (filename) => /\.(png|jpe?g|gif|webp)$/i.test(filename);
      if (newConfession.attachmentName) {
        payload.files = [
          {
            attachment: newConfession.attachment,
            name: newConfession.attachmentName ?? "attachment",
          },
        ];
        if (isImage(payload.files[0].name)) {
          embed.setImage(`attachment://${payload.files[0].name}`);
        }
      }
      await confessionChannel.send(payload);
    }
    const randomConfessionReplies = [
      "Your confession has been sent anonymously.",
      "Confession received! Thanks for sharing.",
      "Your secret is safe with Johnny boy...",
      "Anonymous confession submitted successfully.",
      "Thank u for submitting ur deepest darkest secrets!",
      "John will keep your confessions safe.",
      "Sent, nihaw!",
    ];
    return interaction.reply({
      content: randomConfessionReplies[Math.floor(Math.random() * randomConfessionReplies.length)],
      ephemeral: true,
    });
  },
};
