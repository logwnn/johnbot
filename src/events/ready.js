export default {
  name: "ready",
  once: true,
  async execute(client) {
    const { logEvent } = await import("../utils/logger.js");
    logEvent("INIT", `Bot has logged in as ${client.user.tag}`);

    // Fun rotating statuses
    const randomStatuses = [
      { name: "trying to rizz u up" },
      { name: "john is thinking... this may take a while" },
      { name: "chronically online final boss" },
      { name: "John is thinking..." },
      { name: "with your mom" },
      { name: "the void" },
      { name: "99 Luftballons" },
      { name: "the Ultimate Question of Life, the Universe, and Everything" },
      { name: "So long, and thanks for all the fish." },
      { name: "in a towel rn" },
      { name: "ready for some rizzing" },
      { name: "You're mine." },
      { name: "Six Seven" },
      { name: "WE ARE CHARLIE KIRK" },
      { name: "WE ARE JOLLY GOOD" },
    ];
    const setRandomStatus = () => {
      const random = randomStatuses[Math.floor(Math.random() * randomStatuses.length)];
      try {
        client.user.setPresence({ activities: [random], status: "online" });
      } catch {}
    };
    setRandomStatus();
    setInterval(setRandomStatus, 120000);

    // Ensure guilds are fetched so registration works without restart
    try {
      if (!client.guilds.cache || client.guilds.cache.size === 0) {
        await client.guilds.fetch();
        logEvent("INIT", "Fetched guilds on ready");
      }
    } catch (e) {
      logEvent("WARN", `Failed to fetch guilds on ready | ${e.stack}`);
    }

    // Register per-guild slash commands on ready (register server-by-server)
    const { registerSlashCommands } = await import("../handlers/slashHandler.js");
    try {
      await registerSlashCommands(client, { scope: "guild" });
    } catch (e) {
      logEvent("ERROR", `Slash registration failed in ready handler | ${e.stack}`);
    }

    // Start health server and log archiver
    try {
      const { startHealthServer } = await import("../utils/healthServer.js");
      const { startArchiveScheduler } = await import("../utils/logArchive.js");
      startHealthServer(
        client,
        process.env.HEALTH_PORT ? Number(process.env.HEALTH_PORT) : undefined
      );
      startArchiveScheduler(
        Number(process.env.ARCHIVE_DAYS) || 7,
        Number(process.env.ARCHIVE_INTERVAL_MS) || 24 * 60 * 60 * 1000
      );
    } catch (e) {
      logEvent("WARN", `Failed to start health/archiver | ${e.stack}`);
    }
  },
};
