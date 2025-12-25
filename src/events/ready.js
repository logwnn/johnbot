export default {
  name: "ready",
  once: true,
  async execute(client) {
    const { logEvent } = await import("../utils/logger.js");
    logEvent("INIT", `Bot has logged in as ${client.user.tag}`);

    // Fun rotating statuses
    const statuses = [{ name: "Merry Christmas ya filthy animals..." }, { name: "Only 3 Christmases left till shower! ⏳🎄" }, { name: "Im on the NAUGHTY LIST >:(" }, { name: "Im on the NICE LIST :)" }, { name: "Unwrapping gifts like a feral raccoon" }, { name: "Untangling the Christmas lights... again" }, { name: "Listening to Michael Bublé 🎵" }, { name: "Waiting for a white christmas" }, { name: "He knows when you've been bad or good" }, { name: "Rockin' around the Christmas tree" }];
    const setRandomStatus = () => {
      const random = statuses[Math.floor(Math.random() * statuses.length)];
      try {
        client.user.setPresence({ activities: [random], status: "online" });
      } catch {}
    };
    setRandomStatus();
    setInterval(setRandomStatus, 60000);

    // Ensure guilds are fetched so registration works without restart
    try {
      if (!client.guilds.cache || client.guilds.cache.size === 0) {
        await client.guilds.fetch();
        logEvent("INIT", "Fetched guilds on ready");
      }
    } catch (e) {
      logEvent("WARN", `Failed to fetch guilds on ready | ${e.message}`);
    }

    // Register per-guild slash commands on ready (register server-by-server)
    const { registerSlashCommands } = await import("../handlers/slashHandler.js");
    try {
      await registerSlashCommands(client, { scope: "guild" });
    } catch (e) {
      logEvent("ERROR", `Slash registration failed in ready handler | ${e.message}`);
    }

    // Start health server and log archiver
    try {
      const { startHealthServer } = await import("../utils/healthServer.js");
      const { startArchiveScheduler } = await import("../utils/logArchive.js");
      startHealthServer(client, process.env.HEALTH_PORT ? Number(process.env.HEALTH_PORT) : undefined);
      startArchiveScheduler(Number(process.env.ARCHIVE_DAYS) || 7, Number(process.env.ARCHIVE_INTERVAL_MS) || 24 * 60 * 60 * 1000);
    } catch (e) {
      logEvent("WARN", `Failed to start health/archiver | ${e.message}`);
    }
  },
};
