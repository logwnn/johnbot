import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { loadBlacklist } from "../utils/memory.js";
import { logEvent } from "../utils/logger.js";

export default {
  name: "blacklist",
  description: "Blacklist admin menu (owner only)",
  permissions: ["OWNER"],
  data: new SlashCommandBuilder().setName("blacklist").setDescription("Manage bot blacklist"),

  async executeSlash(client, interaction) {
    const list = loadBlacklist();
    const listCount = list.length;
    const embed = new EmbedBuilder().setTitle("Blacklist Admin Menu").setDescription(`Manage the bot blacklist. Current count: ${listCount}`).setColor(0xaa0000);
    const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId("blacklist_list_btn").setLabel("List").setStyle(ButtonStyle.Primary), new ButtonBuilder().setCustomId("blacklist_add_btn").setLabel("Add").setStyle(ButtonStyle.Success), new ButtonBuilder().setCustomId("blacklist_remove_btn").setLabel("Remove").setStyle(ButtonStyle.Danger));
    await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
    logEvent("SLASH-CMD", `User ${interaction.user.id} | /blacklist menu`);
  },
};
