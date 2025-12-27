import { SlashCommandBuilder } from "discord.js";
import { logEvent } from "../utils/logger.js";

export default {
  name: "touch",
  description: "Touch someone",
  permissions: [],
  data: new SlashCommandBuilder()
    .setName("touch")
    .setDescription("touch someone...")
    .addUserOption((o) =>
      o.setName("target").setDescription("The user to touch").setRequired(true)
    ),

  async executeSlash(client, interaction) {
    /*
    const interactionReplies = [
        "Yo dawg thats sus",
        "ur FUCKED up",
        "John disapproves",
        "bro awww hell naw",
        "not the vibes i wanted",
        "why would you do that",
        "smh my head",
    ];
    // randomly choose interactionreply
    interaction.reply({ content: interactionReplies[Math.floor(Math.random() * interactionReplies.length)], ephemeral: true });
    */
    const target = interaction.options.getUser("target");
    const touchingReplies = [
      "is touching you, without your consent",
      "is touching you with consent",
      "is touching you",
      "reaches out to touch you",
      "poked you",
      "just touched you",
    ];
    await interaction.reply({
      content: `<@${interaction.user.id}> ${
        touchingReplies[Math.floor(Math.random() * touchingReplies.length)]
      } <@${target.id}>.`,
      ephemeral: false,
    });
    logEvent("SLASH-CMD", `User ${interaction.user.id} | /touch ${target.id}`);
  },
};
