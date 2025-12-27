import fs from "fs";
import path from "path";

const CONFIG_FILE = path.join(process.cwd(), "src", "config.json");
let raw = {};
if (fs.existsSync(CONFIG_FILE)) {
  try {
    raw = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
  } catch {}
}

// Expose merged config with environment variable overrides
export const config = {
  ...raw,
  LLM_ENDPOINT: process.env.LLM_ENDPOINT || raw.LLM_ENDPOINT,
  LLM_MODEL: process.env.LLM_MODEL || raw.LLM_MODEL,
  errorReply: process.env.ERROR_REPLY || raw.errorReply,
  MEMORY_CONFIDENCE_THRESHOLD: Number(
    process.env.MEMORY_CONFIDENCE_THRESHOLD ?? raw.MEMORY_CONFIDENCE_THRESHOLD
  ),
  MAX_MESSAGE_HISTORY: Number(process.env.MAX_MESSAGE_HISTORY ?? raw.MAX_MESSAGE_HISTORY),
  MAX_RESPONSE_LENGTH: Number(process.env.MAX_RESPONSE_LENGTH ?? raw.MAX_RESPONSE_LENGTH),
  EDIT_THROTTLE_MS: Number(process.env.EDIT_THROTTLE_MS ?? raw.EDIT_THROTTLE_MS),
};

export default config;
