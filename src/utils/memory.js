import fs from "fs";
import path from "path";
import { logEvent } from "./logger.js";

const MEMORY_FILE = path.join(process.cwd(), "memory.json");
const BLACKLIST_FILE = path.join(process.cwd(), "blacklist.json");
const CONFESSIONS_FILE = path.join(process.cwd(), "confessions.json");
const VOICESTATESUBSCRIBERS_FILE = path.join(process.cwd(), "voiceStateSubscribers.json");

function ensureStorage() {
  if (!fs.existsSync(CONFESSIONS_FILE)) {
    fs.writeFileSync(CONFESSIONS_FILE, "[]", "utf8");
  }
}

export function loadMemory() {
  if (!fs.existsSync(MEMORY_FILE)) return {};
  try {
    return JSON.parse(fs.readFileSync(MEMORY_FILE, "utf8"));
  } catch {
    return {};
  }
}

export function saveMemory(obj) {
  fs.writeFileSync(MEMORY_FILE, JSON.stringify(obj, null, 2));
}

export function loadBlacklist() {
  if (!fs.existsSync(BLACKLIST_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(BLACKLIST_FILE, "utf8")) || [];
  } catch {
    return [];
  }
}

export function saveBlacklist(data) {
  fs.writeFileSync(BLACKLIST_FILE, JSON.stringify(data, null, 2));
}

export function loadConfessions() {
  ensureStorage();
  try {
    const raw = fs.readFileSync(CONFESSIONS_FILE, "utf8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      throw new Error("Confessions file is not an array");
    }
    return parsed;
  } catch (err) {
    logEvent("ERROR", `Failed to load confessions: ${err.stack}`);
    return [];
  }
}

export function saveConfessions(confessions) {
  ensureStorage();
  const tmpFile = CONFESSIONS_FILE + ".tmp";
  fs.writeFileSync(tmpFile, JSON.stringify(confessions, null, 2), "utf8");
  fs.renameSync(tmpFile, CONFESSIONS_FILE);
}

export function loadVoiceStateSubscribers() {
  if (!fs.existsSync(VOICESTATESUBSCRIBERS_FILE)) {
    fs.mkdirSync(path.dirname(VOICESTATESUBSCRIBERS_FILE), { recursive: true });
    fs.writeFileSync(VOICESTATESUBSCRIBERS_FILE, JSON.stringify({}, null, 2));
  }
  return JSON.parse(fs.readFileSync(VOICESTATESUBSCRIBERS_FILE, "utf8"));
}

export function saveVoiceStateSubscribers(data) {
  fs.writeFileSync(VOICESTATESUBSCRIBERS_FILE, JSON.stringify(data, null, 2));
}

// Additional helpers
export function addPhraseToHistory(userID, phrase) {
  const mem = loadMemory();
  const user = mem[userID] || {};
  if (!user.meta) user.meta = {};
  if (!user.meta.recent_phrases) user.meta.recent_phrases = [];
  user.meta.recent_phrases.push(phrase);
  while (user.meta.recent_phrases.length > 15) user.meta.recent_phrases.shift();
  mem[userID] = user;
  saveMemory(mem);
}

export function getAmbientContext(userID) {
  const now = new Date();
  const hour = now.getHours();
  const dayOfWeek = now.toLocaleDateString("en-US", { weekday: "long" });
  const timeOfDay =
    hour < 6
      ? "very early morning"
      : hour < 9
      ? "early morning"
      : hour < 12
      ? "morning"
      : hour < 14
      ? "noon"
      : hour < 17
      ? "afternoon"
      : hour < 20
      ? "evening"
      : "night";
  const mem = loadMemory()[userID] || {};
  let daysSinceLastChat = "first time";
  if (mem?.meta?.last_interaction_timestamp) {
    const lastTime = new Date(mem.meta.last_interaction_timestamp);
    const diffMs = now - lastTime;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) daysSinceLastChat = "today";
    else if (diffDays === 1) daysSinceLastChat = "yesterday";
    else daysSinceLastChat = `${diffDays} days ago`;
  }
  return {
    timeOfDay,
    dayOfWeek,
    daysSinceLastChat,
    hour,
    interactions: mem.meta?.interactions || 0,
  };
}

export async function summarizePersona(userID) {
  try {
    const { askModel } = await import("./llm.js");
    const mem = loadMemory()[userID] || {};
    const facts = JSON.stringify(mem, null, 2);
    const prompt = `You are a concise assistant that converts long-term user facts into a 1-2 sentence summary.\nOnly output the sentence (no JSON, no commentary). Keep it under 140 characters.\nUSER FACTS:\n${facts}`;
    const response = (await askModel(prompt)).trim().split("\n").filter(Boolean)[0] || "";
    if (!mem.meta) mem.meta = {};
    mem.meta.usersummary = response;
    const all = loadMemory();
    all[userID] = mem;
    saveMemory(all);
    return response;
  } catch (err) {
    try {
      // best-effort logging
      const { logEvent } = await import("./logger.js");
      logEvent("ERROR", `User summarization failed | ${err.stack}`);
    } catch {}
    return null;
  }
}

export function getEnergyTopics(userID) {
  const mem = loadMemory()[userID] || {};
  const style = mem.chat_context?.conversation_style || {};
  return (style?.topics_energized_about || []).slice(0, 3);
}

export async function extractMemory(userID, messageText, recentConversation = "") {
  try {
    const { askModel } = await import("./llm.js");
    const { logEvent } = await import("./logger.js");
    const configModule = await import("./config.js");
    const cfg = configModule.default || configModule.config;

    const all = loadMemory();
    const existing = all[userID] || {};
    const threshold = cfg.MEMORY_CONFIDENCE_THRESHOLD ?? 0.7;

    const prompt = `
You are extracting long-term user memory.
OUTPUT RULES (STRICT):
- Output MUST be valid JSON only.
- Do NOT include markdown, code fences, comments, or explanations.
- If no memory is found, output {}.
- Do NOT include confidence at category level.
- Do NOT output raw strings, numbers, or booleans as values.
MEMORY RULES:
- Only extract facts the user explicitly stated.
- Do NOT infer, guess, summarize, or restate.
- Do NOT repeat existing memory.
- Do NOT include temporary, situational, or sensitive information.
SCHEMA RULES:
- Every leaf field MUST be one of:
  1) { "value": <primitive or null>, "confidence": <number 0-1> }
  2) [ { "value": <primitive>, "confidence": <number 0-1> } ]
- Confidence applies ONLY to the specific value.
- Confidence MUST be a number between 0 and 1.
ALLOWED CATEGORIES:
identity
relationship_with_assistant
interests
long_term_facts
chat_context
EXAMPLE OUTPUT:
{
  "identity": {
    "name": { "value": "Logan", "confidence": 0.95 }
  }
}
CURRENT MEMORY KEYS:
${JSON.stringify(Object.keys(existing))}
USER MESSAGE:
"${messageText}"
`;

    const output = await askModel(prompt, null, "minimal", false, 500, false);
    console.log(output);

    // ---------- HARDENED JSON EXTRACTION ----------
    function extractFirstValidJSON(input) {
      if (typeof input !== "string") return null;
      const text = input.replace(/```(?:json)?/gi, "");

      let inString = false;
      let escape = false;
      let depth = 0;
      let start = -1;

      for (let i = 0; i < text.length; i++) {
        const ch = text[i];

        if (escape) {
          escape = false;
          continue;
        }

        if (ch === "\\") {
          escape = true;
          continue;
        }

        if (ch === '"') {
          inString = !inString;
          continue;
        }

        if (inString) continue;

        if (ch === "{" || ch === "[") {
          if (depth === 0) start = i;
          depth++;
        } else if (ch === "}" || ch === "]") {
          depth--;
          if (depth === 0 && start !== -1) {
            const slice = text.slice(start, i + 1);
            try {
              return JSON.parse(slice);
            } catch {
              start = -1;
            }
          }
        }
      }
      return null;
    }

    const parsed = extractFirstValidJSON(String(output));

    if (!parsed || typeof parsed !== "object") {
      logEvent("WARN", `Memory extraction failed for user ${userID}`, {
        rawOutput: String(output).slice(0, 2000),
      });
      return {};
    }

    if (Object.keys(parsed).length === 0) {
      logEvent("MEMORY-EXTRACT", `User ${userID} | No new facts extracted`);
      return {};
    }

    // ---------- NORMALIZE + MERGE ----------
    const updated = { ...existing };

    for (const category of Object.keys(parsed)) {
      if (!updated[category]) updated[category] = {};
      const fields = parsed[category] || {};

      for (const key of Object.keys(fields)) {
        let entry = fields[key];
        if (entry == null) continue;

        // Normalize primitive → { value, confidence }
        if (typeof entry !== "object" || Array.isArray(entry)) {
          entry = {
            value: entry,
            confidence: Number(fields.confidence ?? 0.5),
          };
        }

        // Array of entries
        if (Array.isArray(entry)) {
          if (!Array.isArray(updated[category][key])) {
            updated[category][key] = [];
          }

          for (const item of entry) {
            if (!item || typeof item !== "object") continue;
            const confidence = Number(item.confidence);
            if (!Number.isFinite(confidence) || confidence < threshold) continue;

            const arr = updated[category][key];
            const idx = arr.findIndex((old) => old.value === item.value);

            if (idx === -1) {
              arr.push({ value: item.value, confidence });
              logEvent(
                "MEMORY-UPDATE",
                `User ${userID} | Added ${category}.${key} value=${item.value} conf=${confidence}`
              );
            } else if ((arr[idx].confidence || 0) < confidence) {
              arr[idx].confidence = confidence;
              logEvent(
                "MEMORY-UPDATE",
                `User ${userID} | Updated ${category}.${key} value=${item.value} conf=${confidence}`
              );
            }
          }
        }

        // Single value
        else if ("value" in entry) {
          const confidence = Number(entry.confidence);
          if (!Number.isFinite(confidence) || confidence < threshold) continue;

          const old = updated[category][key];
          const oldConf = old?.confidence ?? 0;

          if (
            !old ||
            confidence > oldConf ||
            (confidence === oldConf && entry.value !== old.value)
          ) {
            updated[category][key] = {
              value: entry.value,
              confidence,
            };

            logEvent(
              "MEMORY-UPDATE",
              `User ${userID} | Set ${category}.${key} = ${entry.value} conf=${confidence}`
            );
          }
        }
      }
    }

    all[userID] = updated;
    saveMemory(all);
    return parsed;
  } catch (err) {
    const { logEvent } = await import("./logger.js");
    logEvent("ERROR", `Memory extraction failed | Error="${err}"`);
    return {};
  }
}
