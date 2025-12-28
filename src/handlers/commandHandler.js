import fs from "fs";
import path from "path";
import { logEvent } from "../utils/logger.js";

const commands = new Map();
const slashCommands = new Map();

export async function initCommandHandler(client, opts = {}) {
  const commandsPath = path.join(process.cwd(), "src", "commands");
  if (!fs.existsSync(commandsPath)) return;
  const files = fs.readdirSync(commandsPath).filter((f) => f.endsWith(".js"));
  let loadedCommands = [];
  for (const file of files) {
    try {
      const { default: cmd } = await import(`../commands/${file}`);
      if (!cmd || !cmd.name) continue;
      commands.set(cmd.name, cmd);
      if (cmd.data) {
        const name = cmd.data.name ?? cmd.name;
        slashCommands.set(name, cmd);
      }
      loadedCommands.push(cmd.name);
    } catch (e) {
      logEvent("\nERROR", `Failed to load command ${file} | ${e.stack}\n`);
    }
  }
  logEvent("INIT", `Loaded commands: ${loadedCommands.join(", ")}`);
}

export async function handleMessage(client, message) {
  try {
    if (message.author?.bot) return;
    const configPath = path.join(process.cwd(), "config.json");
    const config = fs.existsSync(configPath) ? JSON.parse(fs.readFileSync(configPath, "utf8")) : {};
    const prefix = process.env.PREFIX || config.prefix || "!";
    if (!message.content.startsWith(prefix)) return;
    const args = message.content.slice(prefix.length).trim().split(/\s+/);
    const cmdName = args.shift().toLowerCase();
    const cmd = commands.get(cmdName);
    if (!cmd) {
      logEvent("CMD-UNKNOWN", `User ${message.author.id} attempted unknown command: ${cmdName}`);
      return;
    }

    // permissions
    const ownerId = process.env.BOT_OWNER_ID || config.ownerId;
    const { check } = await import("../utils/permissions.js");
    if (!check(cmd.permissions || [], message.member, ownerId)) {
      logEvent("PERMISSION-DENIED", `User ${message.author.id} denied for ${cmd.name}`);
      try {
        await message.reply("You don't have permission to use this command.");
      } catch {}
      return;
    }

    try {
      await cmd.execute(client, message, args);
      logEvent("CMD", `Executed ${cmd.name} by ${message.author.id}`);
    } catch (e) {
      logEvent("ERROR", `Command ${cmd.name} failed | ${e.stack}`);
      await message.reply("Command failed to execute.");
    }
  } catch (e) {
    logEvent("ERROR", `Command handler error | ${e.stack}`);
  }
}

export function getSlashCommandData() {
  return [...slashCommands.values()].map((c) => (c.data?.toJSON ? c.data.toJSON() : c.data));
}

export { commands, slashCommands };
