import fs from "fs";
import path from "path";
import { logEvent } from "../utils/logger.js";

export async function registerEventHandlers(client) {
  const eventsPath = path.join(process.cwd(), "src", "events");
  if (!fs.existsSync(eventsPath)) return;
  const files = fs.readdirSync(eventsPath).filter((f) => f.endsWith(".js"));
  let events = [];
  for (const file of files) {
    try {
      const { default: event } = await import(`../events/${file}`);
      if (!event || !event.name) continue;
      if (event.once) client.once(event.name, (...args) => event.execute(client, ...args));
      else client.on(event.name, (...args) => event.execute(client, ...args));
      events.push(event.name);
    } catch (e) {
      logEvent("error", `Failed to register event ${file}: ${e.message}`);
    }
  }
  logEvent("info", `Registered events: ${events.join(", ")}`);
}
