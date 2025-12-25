import { SlashCommandBuilder } from "discord.js";
import os from "os";
import { logEvent } from "../utils/logger.js";

export default {
  name: "ping",
  description: "Returns pong, latency and system info.",
  permissions: [],
  data: new SlashCommandBuilder().setName("ping").setDescription("Returns pong, latency and system info."),
  async execute(client, message, args) {
    const sent = await message.reply("Pinging...");
    try {
      logEvent("CMD", `ping executed by ${message.author.id}`);
    } catch {}
    const latency = Date.now() - sent.createdTimestamp;
    const ws = client.ws?.ping ?? "unknown";
    const mem = process.memoryUsage();
    const text = `Pong! Round-trip: ${latency}ms | WS: ${ws}ms\nGuilds: ${client.guilds?.cache?.size ?? 0} | Users cached: ${client.users?.cache?.size ?? 0}\nNode: ${process.version} | Platform: ${os.platform()} ${os.arch()} | CPUs: ${os.cpus().length}\nMemory RSS: ${Math.round(mem.rss / 1024 / 1024)} MB`;
    await sent.edit(text);
  },
  async executeSlash(client, interaction) {
    try {
      logEvent("SLASH-CMD", `ping used by ${interaction.user.id}`);
    } catch {}
    await interaction.reply({ content: "Pinging...", ephemeral: true });
    const start = Date.now();
    const ws = client.ws?.ping ?? "unknown";
    const mem = process.memoryUsage();
    const latency = Date.now() - start;
    const text = `Pong! Latency: ${latency}ms | WS: ${ws}ms\nGuilds: ${client.guilds?.cache?.size ?? 0} | Users cached: ${client.users?.cache?.size ?? 0}\nNode: ${process.version} | Platform: ${os.platform()} ${os.arch()} | CPUs: ${os.cpus().length}\nMemory RSS: ${Math.round(mem.rss / 1024 / 1024)} MB`;
    try {
      await interaction.editReply({ content: text });
    } catch (e) {
      try {
        await interaction.followUp({ content: text, ephemeral: true });
      } catch {}
    }
  },
};
