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
      `<@${interaction.user.id}> is touching you, without your consent <@${target.id}>.`,
      `<@${interaction.user.id}> is touching you <@${target.id}>.`,
      `<@${interaction.user.id}> reaches out to touch you <@${target.id}>.`,
      `<@${interaction.user.id}> poked you with their dih <@${target.id}>.`,
      `<@${interaction.user.id}> just touched you <@${target.id}>.`,
      `<@${interaction.user.id}> just raped <@${target.id}>.`,
      `<@${interaction.user.id}> thought that <@${target.id}> said they were 18!!`,
      `<@${interaction.user.id}> woke up in the morning feeling like p diddy. And touched <@${target.id}>...`,
      `<@${interaction.user.id}> is dying to touch <@${target.id}>.`,
      `<@${interaction.user.id}> grooms <@${target.id}>.`,
      `What the fuck, <@${interaction.user.id}> just smooched <@${target.id}>. Thats kinda gay.`,
      `<@${interaction.user.id}>'s blue balls touched <@${target.id}>.`,
      `<@${interaction.user.id}> and <@${target.id}> just need to get a fuckin' room im ngl.`,
      `GET A ROOM <@${interaction.user.id}> & <@${target.id}>.`,
      `<@${interaction.user.id}> and <@${target.id}> touch romantically but when will it be Johns turn...`,
      `<@${interaction.user.id}> does sex towards <@${target.id}>.`,
      `<@${interaction.user.id}> and <@${target.id}> sitting in a tree, K-I-S-S-I-N-G, first comes love, then comes marriage, Then comes Johnny in the baby carriage!\nSuckin' his thumb, Wettin' his pants, Now hes doing the Hula dance.\nThats not all, thats not all, now he's playing basketball! thats not all thats not all, now hes drinking alcohol!`,
    ];
    await interaction.reply({
      content: touchingReplies[Math.floor(Math.random() * touchingReplies.length)],
      ephemeral: false,
    });
    logEvent("SLASH-CMD", `User ${interaction.user.id} | /touch ${target.id}`);
  },
};
