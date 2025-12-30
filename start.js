import "dotenv/config";
import { Client, GatewayIntentBits, Partials } from "discord.js";
import { registerEventHandlers } from "./src/handlers/eventHandler.js";
import { initCommandHandler } from "./src/handlers/commandHandler.js";
import { logEvent } from "./src/utils/logger.js";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.GuildVoiceStates,
  ],
  partials: [Partials.Channel, Partials.User],
});

(async () => {
  try {
    logEvent("BOOT", "Initializing John...");
    await registerEventHandlers(client);
    await initCommandHandler(client);
    await client.login(process.env.DISCORD_TOKEN);
  } catch (e) {
    logEvent("ERROR", `Startup failed | ${e.stack}`);
    // make sure we exit so process manager can restart
    process.exit(1);
  }
})();

// Global process handlers for robust logging
process.on("unhandledRejection", (r) => logEvent("ERROR", `Unhandled rejection | ${String(r)}`));
process.on("uncaughtException", (err) => {
  logEvent("ERROR", `Uncaught exception | ${err?.stack || err}`);
  try {
    process.exit(1);
  } catch {}
});
