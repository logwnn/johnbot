import fs from "fs";
import path from "path";

const LOG_DIR = path.join(process.cwd(), "logs");
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

export function logEvent(type, details, extra = {}) {
  const date = new Date();
  const timestamp = date.toISOString();
  const dateKey = timestamp.split("T")[0];
  const logFile = path.join(LOG_DIR, `${dateKey}.jsonl`);

  const entry = {
    timestamp,
    type,
    details,
    ...extra,
  };

  try {
    fs.appendFileSync(logFile, JSON.stringify(entry) + "\n");
  } catch (err) {
    // Fallback to legacy plain-text log if JSON write fails
    const fallbackFile = path.join(LOG_DIR, `${dateKey}.log`);
    const human = `[${timestamp.replace("T", " ").split(".")[0]}] [${type}] ${typeof details === "string" ? details : JSON.stringify(details)}\n`;
    try {
      fs.appendFileSync(fallbackFile, human);
    } catch (e) {
      // last resort: ignore write errors to avoid crashing the bot
    }
  }

  // Keep console output human-readable for debugging
  try {
    console.log(`[${timestamp.replace("T", " ").split(".")[0]}] [${type}] ${typeof details === "string" ? details : JSON.stringify(details)}`);
  } catch (e) {}
}

export default { logEvent };
