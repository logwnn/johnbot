import { logEvent } from "../utils/logger.js";
import { getSlashCommandData } from "./commandHandler.js";

/**
 * registerSlashCommands(client, { scope = 'both', guildId = null })
 * scope: 'global' | 'guild' | 'both'
 * guildId (optional): if provided, register only for that guild
 */
export async function registerSlashCommands(
  client,
  { scope = "both", guildId = null, reset = false, timeoutMs = 15000 } = {}
) {
  const data = getSlashCommandData();
  if (!data || data.length === 0) {
    logEvent("INIT", "No slash commands to register");
    return { registered: 0 };
  }

  // helper to run a promise with timeout
  const withTimeout = (p, ms) =>
    Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms))]);

  try {
    let registered = 0;

    // Log names of commands we're about to register
    try {
      const names = data.map((d) => d?.name ?? "(unknown)").join(", ");
    } catch {}

    // Only clear scopes requested by the caller when reset=true
    if (reset) {
      try {
        if (scope === "guild" || scope === "both") {
          // Clear targeted guilds (or all cached guilds)
          const targets = guildId
            ? [client.guilds.cache.get(guildId)].filter(Boolean)
            : Array.from(client.guilds.cache.values());
          await Promise.allSettled(
            targets.map((g) =>
              withTimeout(
                (async () => {
                  try {
                    await g.commands.set([]);
                    logEvent("INIT", `Cleared guild commands for ${g.id}`);
                    // fetch current to log
                    try {
                      const list = await g.commands.fetch();
                      logEvent("INIT", `Guild ${g.id} now has ${list.size} commands after clear`);
                    } catch {}
                  } catch (e) {
                    logEvent("WARN", `Failed to clear guild commands for ${g.id} | ${e.stack}`);
                  }
                })(),
                timeoutMs
              )
            )
          );
        }

        if (scope === "global" || scope === "both") {
          try {
            await withTimeout(client.application.commands.set([]), timeoutMs);
            logEvent("INIT", `Cleared global application commands`);
            try {
              const list = await client.application.commands.fetch();
              logEvent("INIT", `Global application commands after clear: ${list.size}`);
            } catch {}
          } catch (e) {
            logEvent("WARN", `Failed to clear global commands | ${e.stack}`);
          }
        }
      } catch (e) {
        logEvent("WARN", `Reset step failed | ${e.stack}`);
      }
    }

    // Register guild commands (in parallel)
    if (scope === "guild" || scope === "both") {
      // If cache is empty, try to fetch guilds so registration doesn't require a restart
      if (!client.guilds.cache || client.guilds.cache.size === 0) {
        try {
          await client.guilds.fetch();
          logEvent("INIT", "Fetched guilds for registration");
        } catch (e) {
          logEvent("WARN", `Failed to fetch guilds for registration | ${e.stack}`);
        }
      }

      if (!client.guilds.cache || client.guilds.cache.size === 0) {
        logEvent("INFO", "No guilds in cache even after fetch; skipping guild registration");
      } else {
        const targets = guildId
          ? [client.guilds.cache.get(guildId)].filter(Boolean)
          : Array.from(client.guilds.cache.values());
        const results = await Promise.allSettled(
          targets.map((g) =>
            withTimeout(
              (async () => {
                try {
                  await g.commands.set(data);
                  // fetch and log names that actually landed
                  try {
                    const list = await g.commands.fetch();
                    const names = list.map((c) => c.name).join(", ");
                    logEvent("INIT", `Guild ${g.id} registered commands: ${names}`);
                  } catch {}
                  return data.length;
                } catch (e) {
                  logEvent("WARN", `Failed to register guild commands for ${g.id} | ${e.stack}`);
                  return 0;
                }
              })(),
              timeoutMs
            )
          )
        );
        for (const r of results) {
          if (r.status === "fulfilled") registered += Number(r.value || 0);
        }
      }
    }

    // Register global commands
    if (scope === "global" || scope === "both") {
      try {
        await withTimeout(client.application.commands.set(data), timeoutMs);
        try {
          const list = await client.application.commands.fetch();
          const names = list.map((c) => c.name).join(", ");
          logEvent("INIT", `Global registered commands: ${names}`);
        } catch {}
        registered += data.length;
      } catch (e) {
        logEvent("WARN", `Failed to register global commands | ${e.stack}`);
      }
    }

    return { registered };
  } catch (e) {
    logEvent("ERROR", `Slash registration failed | ${e.stack}`);
    return { registered: 0, error: e.stack };
  }
}
