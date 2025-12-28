import { SlashCommandBuilder } from "discord.js";
import os from "os";
import { logEvent } from "../utils/logger.js";

export default {
  name: "ping",
  description: "Returns pong, latency and system info.",
  permissions: [],
  data: new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Returns pong, latency and system info."),
  async executeSlash(client, interaction) {
    try {
      logEvent("SLASH-CMD", `ping used by ${interaction.user.id}`);
    } catch {}
    await interaction.reply({ content: "Collecting data...", ephemeral: true });
    const start = Date.now();
    const ws = client.ws?.ping ?? "unknown";
    const mem = process.memoryUsage();
    const latency = Date.now() - start;
    const text = `Latency: ${latency}ms - WebSocket: ${ws}ms\nGuilds: ${
      client.guilds.cache.size
    } - Users cached: ${
      client.users.cache.size
    }\nHost: ${os.hostname()}\nOS: ${os.type()} ${os.release()} (${os.platform()} ${os.arch()})\nNode: ${
      process.version
    }\nCPU: ${os.cpus()[0].model} (${os.cpus().length} cores)\nLoad Avg: ${os
      .loadavg()
      .map((n) => n.toFixed(2))
      .join(", ")}\nRAM: ${Math.round(mem.rss / 1024 / 1024)} MB (process) - ${Math.round(
      os.freemem() / 1e9
    )} GB free out of ${Math.round(os.totalmem() / 1e9)} GB total\nUptime: ${Math.floor(
      process.uptime()
    )}s (proc) - ${Math.floor(os.uptime() / 3600)}h (system)
`;
    try {
      await interaction.editReply({ content: text });
    } catch (e) {
      try {
        await interaction.followUp({ content: text, ephemeral: true });
      } catch {}
    }
  },
};
