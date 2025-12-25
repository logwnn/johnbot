import { SlashCommandBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder } from "discord.js";
import { loadMemory, saveMemory } from "../utils/memory.js";
import { logEvent } from "../utils/logger.js";

export default {
  name: "memory",
  description: "Memory menu (view/edit/reset)",
  permissions: [],
  data: new SlashCommandBuilder()
    .setName("memory")
    .setDescription("Memory menu (view/edit/reset)")
    .addSubcommand((s) => s.setName("view").setDescription("View your memory"))
    .addSubcommand((s) => s.setName("edit").setDescription("Edit your memory"))
    .addSubcommand((s) => s.setName("reset").setDescription("Reset your memory"))
    .addSubcommand((s) =>
      s
        .setName("set")
        .setDescription("Set a specific memory field (dot path)")
        .addStringOption((o) => o.setName("path").setDescription("Dot path e.g. identity.pronouns or long_term_facts.bio").setRequired(true))
        .addStringOption((o) => o.setName("value").setDescription("Value or JSON array/object").setRequired(true))
    )
    .addSubcommand((s) =>
      s
        .setName("unset")
        .setDescription("Remove a memory field")
        .addStringOption((o) => o.setName("path").setDescription("Dot path to remove").setRequired(true))
    )
    .addSubcommand((s) => s.setName("edit-json").setDescription("Edit your memory as JSON (advanced)")),

  async executeSlash(client, interaction) {
    const sub = interaction.options.getSubcommand();
    const uid = interaction.user.id;
    const allMemory = loadMemory();
    const mem = allMemory[uid] || {};

    if (sub === "view") {
      const persona = mem?.meta?.persona || "No persona yet.";
      const short = persona.length > 200 ? persona.slice(0, 197) + "..." : persona;
      const interactions = mem?.meta?.interactions || 0;
      const embed = new EmbedBuilder()
        .setTitle(`${interaction.user.username}'s John Persona`)
        .setDescription(short)
        .addFields({ name: "Interactions", value: `${interactions}`, inline: true }, { name: "Bio", value: mem?.long_term_facts?.bio || "(not set)", inline: true })
        .setColor(0x8b0000);
      const row = new ActionRowBuilder()
        .addComponents
        // reuse the same customId as original so component handler will pick it up
        // profile_edit_btn and profile_reset_btn
        ();
      await interaction.reply({ embeds: [embed], ephemeral: true });
      logEvent("SLASH-CMD", `User ${uid} | /memory view`);
      return;
    }

    if (sub === "edit") {
      const modal = new ModalBuilder().setCustomId("edit_profile_modal").setTitle("Edit Your John Memory Profile");
      const bioInput = new TextInputBuilder().setCustomId("bio_input").setLabel("Short bio (why John should remember you)").setStyle(TextInputStyle.Paragraph).setRequired(false).setPlaceholder("likes ramen, hates scanners");
      const pronounsInput = new TextInputBuilder().setCustomId("pronouns_input").setLabel("Pronouns").setStyle(TextInputStyle.Short).setRequired(false).setPlaceholder("they/them");
      const musicInput = new TextInputBuilder().setCustomId("music_input").setLabel("Favorite music / artists").setStyle(TextInputStyle.Short).setRequired(false).setPlaceholder("lofi, indie, whatever");
      modal.addComponents(new ActionRowBuilder().addComponents(bioInput), new ActionRowBuilder().addComponents(pronounsInput), new ActionRowBuilder().addComponents(musicInput));
      await interaction.showModal(modal);
      logEvent("SLASH-CMD", `User ${uid} | /memory edit`);
      return;
    }

    if (sub === "reset") {
      const memStore = loadMemory();
      delete memStore[uid];
      saveMemory(memStore);
      await interaction.reply({ content: "Memory reset.", ephemeral: true });
      logEvent("SLASH-CMD", `User ${uid} | /memory reset`);
      return;
    }

    if (sub === "set") {
      const path = interaction.options.getString("path", true).trim();
      const valueRaw = interaction.options.getString("value", true).trim();
      const allowed = ["identity", "interests", "long_term_facts", "relationship_with_assistant", "chat_context"];
      const parts = path.split(".");
      if (parts.length < 2 || !allowed.includes(parts[0])) {
        await interaction.reply({ content: `Invalid path. Allowed top-level paths: ${allowed.join(", ")}. Use dot notation, e.g. identity.pronouns`, ephemeral: true });
        return;
      }
      const all = loadMemory();
      const mem = all[uid] || {};
      // ensure container exists
      if (!mem[parts[0]]) mem[parts[0]] = {};
      // parse value as JSON if possible
      let parsedValue = valueRaw;
      try {
        parsedValue = JSON.parse(valueRaw);
      } catch {}
      // apply change
      let target = mem[parts[0]];
      for (let i = 1; i < parts.length - 1; i++) {
        const k = parts[i];
        if (!target[k] || typeof target[k] !== "object") target[k] = {};
        target = target[k];
      }
      const finalKey = parts[parts.length - 1];
      target[finalKey] = parsedValue;
      all[uid] = mem;
      saveMemory(all);
      logEvent("SLASH-CMD", `User ${uid} | /memory set ${path} = ${typeof parsedValue === "string" ? parsedValue.slice(0, 120) : JSON.stringify(parsedValue).slice(0, 120)}`);
      await interaction.reply({ content: `Set ${path}.`, ephemeral: true });
      return;
    }

    if (sub === "unset") {
      const path = interaction.options.getString("path", true).trim();
      const allowed = ["identity", "interests", "long_term_facts", "relationship_with_assistant", "chat_context"];
      const parts = path.split(".");
      if (parts.length < 2 || !allowed.includes(parts[0])) {
        await interaction.reply({ content: `Invalid path. Allowed top-level paths: ${allowed.join(", ")}. Use dot notation, e.g. long_term_facts.bio`, ephemeral: true });
        return;
      }
      const all = loadMemory();
      const mem = all[uid] || {};
      let target = mem[parts[0]];
      if (!target) {
        await interaction.reply({ content: `No value present at ${path}.`, ephemeral: true });
        return;
      }
      for (let i = 1; i < parts.length - 1; i++) {
        const k = parts[i];
        if (!target[k]) {
          target = null;
          break;
        }
        target = target[k];
      }
      if (!target) {
        await interaction.reply({ content: `No value present at ${path}.`, ephemeral: true });
        return;
      }
      const finalKey = parts[parts.length - 1];
      if (finalKey in target) {
        delete target[finalKey];
        all[uid] = mem;
        saveMemory(all);
        logEvent("SLASH-CMD", `User ${uid} | /memory unset ${path}`);
        await interaction.reply({ content: `Removed ${path}.`, ephemeral: true });
      } else {
        await interaction.reply({ content: `No value present at ${path}.`, ephemeral: true });
      }
      return;
    }
  },

  // Keep a prefix-based fallback
  async execute(client, message, args) {
    const uid = message.author.id;
    const allMemory = loadMemory();
    const mem = allMemory[uid] || {};
    const persona = mem?.meta?.persona || "No persona yet.";
    await message.reply({ content: `Your persona: ${persona}` });
  },
};
