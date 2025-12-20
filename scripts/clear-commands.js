// scripts/clear-commands.js
// Clear or list Discord application commands.
// Usage (PowerShell):
// $env:DISCORD_TOKEN = "TOKEN"; $env:CLIENT_ID = "APPID"; $env:GUILD_ID = "OPTIONAL_GUILD_ID"; node .\scripts\clear-commands.js

import dotenv from "dotenv";
import fs from "fs";
import { REST } from "@discordjs/rest";
import { Routes } from "discord-api-types/v10";

dotenv.config();

const TOKEN = process.env.DISCORD_TOKEN || process.env.BOT_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

if (!TOKEN || !CLIENT_ID) {
  console.error("Please set DISCORD_TOKEN (or BOT_TOKEN) and CLIENT_ID environment variables.");
  process.exit(1);
}

const rest = new REST({ version: "10" }).setToken(TOKEN);

async function listCommands(targetGuildId) {
  if (targetGuildId) {
    return rest.get(Routes.applicationGuildCommands(CLIENT_ID, targetGuildId));
  } else {
    return rest.get(Routes.applicationCommands(CLIENT_ID));
  }
}

async function overwriteCommandsWithEmpty(targetGuildId) {
  if (targetGuildId) {
    return rest.put(Routes.applicationGuildCommands(CLIENT_ID, targetGuildId), {
      body: [],
    });
  } else {
    return rest.put(Routes.applicationCommands(CLIENT_ID), { body: [] });
  }
}

async function deleteCommandById(commandId, targetGuildId) {
  if (targetGuildId) {
    return rest.delete(Routes.applicationGuildCommand(CLIENT_ID, targetGuildId, commandId));
  } else {
    return rest.delete(Routes.applicationCommand(CLIENT_ID, commandId));
  }
}

(async () => {
  try {
    console.log("Listing global commands...");
    const globalCmds = await listCommands();
    console.log(
      "Global commands:",
      globalCmds.map((c) => ({ id: c.id, name: c.name }))
    );

    if (GUILD_ID) {
      console.log(`Listing commands for guild ${GUILD_ID}...`);
      const guildCmds = await listCommands(GUILD_ID);
      console.log(
        "Guild commands:",
        guildCmds.map((c) => ({ id: c.id, name: c.name }))
      );
    }

    console.log("\nNo destructive action has been taken by default.");
    console.log("Options:");
    console.log("  1) Overwrite global commands with an empty list (delete all global commands)");
    console.log("  2) Overwrite guild commands with an empty list (delete all commands in that guild)");
    console.log("  3) Delete one command by name (edit the script to set toDeleteName)");
    console.log("\nTo perform an action, edit this file and uncomment the relevant section near the bottom.");

    // === Example actions (commented) ===

    // 1) Overwrite global commands with empty list (uncomment to run)
    await overwriteCommandsWithEmpty();

    // 2) Overwrite guild commands with empty list (uncomment to run)
    if (GUILD_ID) await overwriteCommandsWithEmpty(GUILD_ID);

    // 3) Delete a single command by name (uncomment and set toDeleteName)
    // const toDeleteName = 'resetmemory';
    // const cmd = globalCmds.find(c => c.name === toDeleteName) || (GUILD_ID && (await listCommands(GUILD_ID)).find(c=>c.name===toDeleteName));
    // if (cmd) {
    //   const isGuild = !!cmd.guild_id;
    //   await deleteCommandById(cmd.id, isGuild ? GUILD_ID : undefined);
    //   console.log('Deleted command', cmd.name, cmd.id);
    // } else {
    //   console.log('No command named', toDeleteName);
    // }
  } catch (err) {
    console.error("Error:", err);
  }
})();
