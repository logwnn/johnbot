import fs from "fs";
import path from "path";

const LOG_DIR = path.join(process.cwd(), "logs");
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

export function logEvent(type, details) {
  const date = new Date();
  const timestamp = date.toISOString().replace("T", " ").split(".")[0];
  const logFile = path.join(LOG_DIR, `${date.toISOString().split("T")[0]}.log`);
  const entry = `[${timestamp}] [${type}] ${details}\n`;
  fs.appendFileSync(logFile, entry);
  console.log(entry.trim());
}

export default { logEvent };
