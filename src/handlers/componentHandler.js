import { ModalBuilder, ActionRowBuilder, TextInputBuilder, TextInputStyle } from "discord.js";
import { loadMemory, saveMemory, loadBlacklist, saveBlacklist } from "../utils/memory.js";
import { logEvent } from "../utils/logger.js";

export async function handleButton(interaction) {
  const id = interaction.customId;
  try {
    logEvent("COMPONENT", `handleButton invoked id=${id} by ${interaction.user.id}`);
    // Edit profile button -> show modal
    if (id === "profile_edit_btn") {
      logEvent("COMPONENT", `Showing profile edit modal for ${interaction.user.id}`);
      const modal = new ModalBuilder()
        .setCustomId("edit_profile_modal")
        .setTitle("Edit Your John Memory Profile");
      const bioInput = new TextInputBuilder()
        .setCustomId("bio_input")
        .setLabel("Short bio (why John should remember you)")
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(false)
        .setPlaceholder("likes ramen, hates scanners");
      const pronounsInput = new TextInputBuilder()
        .setCustomId("pronouns_input")
        .setLabel("Pronouns")
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setPlaceholder("they/them");
      const musicInput = new TextInputBuilder()
        .setCustomId("music_input")
        .setLabel("Favorite music / artists")
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setPlaceholder("lofi, indie, whatever");
      modal.addComponents(
        new ActionRowBuilder().addComponents(bioInput),
        new ActionRowBuilder().addComponents(pronounsInput),
        new ActionRowBuilder().addComponents(musicInput)
      );
      await interaction.showModal(modal);
      return;
    }

    // Reset profile button
    if (id === "profile_reset_btn") {
      const uid = interaction.user.id;
      logEvent("PROFILE-RESET", `User ${uid} reset their memory`);
      const mem = loadMemory();
      delete mem[uid];
      saveMemory(mem);
      await interaction.reply({ content: "Your memory has been reset.", ephemeral: true });
      return;
    }

    // Blacklist list
    if (id === "blacklist_list_btn") {
      logEvent("ADMIN", `Blacklist list requested by ${interaction.user.id}`);
      const list = loadBlacklist();
      if (!list || list.length === 0) {
        await interaction.reply({ content: "Blacklist is empty.", ephemeral: true });
        return;
      }
      const mapped = list.map((id) => `<@${id}> (${id})`).join("\n");
      await interaction.reply({ content: `Blacklisted users:\n${mapped}`, ephemeral: true });
      return;
    }

    // Blacklist add -> show modal
    if (id === "blacklist_add_btn") {
      logEvent("ADMIN", `Showing blacklist-add modal to ${interaction.user.id}`);
      const modal = new ModalBuilder()
        .setCustomId("blacklist_add_modal")
        .setTitle("Add user to blacklist");
      const userInput = new TextInputBuilder()
        .setCustomId("blacklist_add_input")
        .setLabel("User ID or mention")
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setPlaceholder("@user or 123456789012345678");
      modal.addComponents(new ActionRowBuilder().addComponents(userInput));
      await interaction.showModal(modal);
      return;
    }

    // Blacklist remove -> show modal
    if (id === "blacklist_remove_btn") {
      logEvent("ADMIN", `Showing blacklist-remove modal to ${interaction.user.id}`);
      const modal = new ModalBuilder()
        .setCustomId("blacklist_remove_modal")
        .setTitle("Remove user from blacklist");
      const userInput = new TextInputBuilder()
        .setCustomId("blacklist_remove_input")
        .setLabel("User ID or mention")
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setPlaceholder("@user or 123456789012345678");
      modal.addComponents(new ActionRowBuilder().addComponents(userInput));
      await interaction.showModal(modal);
      return;
    }
  } catch (e) {
    logEvent("ERROR", `Button handler failed | ${e.stack}`);
    try {
      if (!interaction.replied)
        await interaction.reply({ content: "Error handling button.", ephemeral: true });
    } catch {}
  }
}

export async function handleModal(interaction) {
  try {
    const cid = interaction.customId;
    if (cid === "edit_profile_modal") {
      const uid = interaction.user.id;
      const bio = interaction.fields.getTextInputValue("bio_input") || "";
      const pronouns = interaction.fields.getTextInputValue("pronouns_input") || "";
      const music = interaction.fields.getTextInputValue("music_input") || "";
      const mem = loadMemory();
      const userMem = mem[uid] || {};
      if (!userMem.long_term_facts) userMem.long_term_facts = {};
      if (!userMem.identity) userMem.identity = {};
      if (!userMem.interests) userMem.interests = {};
      const updated = [];
      if (bio) {
        userMem.long_term_facts.bio = bio;
        updated.push("bio");
      }
      if (pronouns) {
        userMem.identity.pronouns = pronouns;
        updated.push("pronouns");
      }
      if (music) {
        userMem.interests.music = (userMem.interests.music || []).concat(music.split(/,\s*/));
        updated.push("music");
      }
      mem[uid] = userMem;
      saveMemory(mem);
      logEvent("PROFILE-UPDATE", `User ${uid} updated fields: ${updated.join(", ") || "none"}`);
      await interaction.reply({ content: "Memory updated.", ephemeral: true });
      return;
    }

    if (cid === "blacklist_add_modal") {
      const input = interaction.fields.getTextInputValue("blacklist_add_input") || "";
      const extracted = input.match(/\d{17,19}/);
      if (!extracted) {
        await interaction.reply({
          content: "Couldn't find a user ID in your input.",
          ephemeral: true,
        });
        return;
      }
      const uid = extracted[0];
      const list = loadBlacklist();
      if (!list.includes(uid)) list.push(uid);
      saveBlacklist(list);
      await interaction.reply({ content: `Added <@${uid}> to blacklist.`, ephemeral: true });
      logEvent("SLASH-CMD", `Blacklist add via modal | ${interaction.user.id} added ${uid}`);
      return;
    }

    // Memory advanced JSON edit
    if (cid === "memory_edit_json_modal") {
      try {
        const jsonText = interaction.fields.getTextInputValue("memory_edit_json_input") || "{}";
        let parsed;
        try {
          parsed = JSON.parse(jsonText);
        } catch (e) {
          await interaction.reply({ content: `Invalid JSON: ${e.stack}`, ephemeral: true });
          return;
        }
        // Only allow top-level updates to a safe whitelist
        const allowed = [
          "identity",
          "interests",
          "long_term_facts",
          "relationship_with_assistant",
          "chat_context",
        ];
        const keys = Object.keys(parsed);
        const invalid = keys.filter((k) => !allowed.includes(k));
        if (invalid.length) {
          await interaction.reply({
            content: `Invalid keys present: ${invalid.join(", ")}. Allowed: ${allowed.join(", ")}`,
            ephemeral: true,
          });
          return;
        }

        const mem = loadMemory();
        const uid = interaction.user.id;
        const userMem = mem[uid] || {};
        for (const k of keys) {
          userMem[k] = parsed[k];
          logEvent("PROFILE-UPDATE", `User ${uid} JSON updated field: ${k}`);
        }
        mem[uid] = userMem;
        saveMemory(mem);
        await interaction.reply({ content: "Memory JSON updated.", ephemeral: true });
      } catch (err) {
        logEvent("ERROR", `Memory JSON modal handling failed | ${err.stack}`);
        try {
          if (!interaction.replied)
            await interaction.reply({ content: "Failed to update memory.", ephemeral: true });
        } catch {}
      }
      return;
    }

    if (cid === "blacklist_remove_modal") {
      const input = interaction.fields.getTextInputValue("blacklist_remove_input") || "";
      const extracted = input.match(/\d{17,19}/);
      if (!extracted) {
        await interaction.reply({
          content: "Couldn't find a user ID in your input.",
          ephemeral: true,
        });
        return;
      }
      const uid = extracted[0];
      let list = loadBlacklist();
      list = list.filter((x) => x !== uid);
      saveBlacklist(list);
      await interaction.reply({ content: `Removed <@${uid}> from blacklist.`, ephemeral: true });
      logEvent("SLASH-CMD", `Blacklist remove via modal | ${interaction.user.id} removed ${uid}`);
      return;
    }
  } catch (e) {
    logEvent("ERROR", `Modal handler failed | ${e.stack}`);
    try {
      if (!interaction.replied)
        await interaction.reply({ content: "Error handling modal.", ephemeral: true });
    } catch {}
  }
}

export default { handleButton, handleModal };
