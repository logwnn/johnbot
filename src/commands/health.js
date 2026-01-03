import { SlashCommandBuilder } from "discord.js";
import os from "os";
import { logEvent } from "../utils/logger.js";

export default {
  name: "health",
  description: "Return bot health and uptime info",
  permissions: [],
  data: new SlashCommandBuilder()
    .setName("health")
    .setDescription("Return bot health and uptime info"),
  async executeSlash(client, interaction) {
    try {
      const body = {
        status: "ok",
        uptime: process.uptime(),
        node: process.version,
        platform: os.platform(),
        arch: os.arch(),
        memory: process.memoryUsage(),
        guildCount: client.guilds?.cache?.size ?? 0,
        timestamp: new Date().toISOString(),
      };
      await interaction.reply({
        content: `
Status: ${body.status}
Uptime (s): ${Math.floor(body.uptime)}
Guilds: ${body.guildCount}
Node: ${body.node}
Platform: ${body.platform} ${body.arch}
Memory RSS: ${Math.round(body.memory.rss / 1024 / 1024)} MB
`,
        ephemeral: true,
      });
      logEvent("ADMIN", `Health checked by ${interaction.user.id}`);
    } catch (e) {
      logEvent("ERROR", `Health command failed | ${e.stack}`);
      try {
        await interaction.reply({ content: `Health check failed: ${e.stack}`, ephemeral: true });
      } catch {}
    }
  },
};
