import fs from "fs";
import path from "path";

const MEMORY_FILE = path.join(process.cwd(), "memory.json");
const BLACKLIST_FILE = path.join(process.cwd(), "blacklist.json");

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

export function saveBlacklist(list) {
  fs.writeFileSync(BLACKLIST_FILE, JSON.stringify(list, null, 2));
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
  const timeOfDay = hour < 6 ? "very early morning" : hour < 9 ? "early morning" : hour < 12 ? "morning" : hour < 14 ? "noon" : hour < 17 ? "afternoon" : hour < 20 ? "evening" : "night";
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
      logEvent("ERROR", `User summarization failed | ${err.message}`);
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
    const current = loadMemory()[userID] || {};
    const configModule = await import("./config.js");
    const cfg = configModule.default || configModule.config;
    const prompt = `You extract user facts from the user’s message. You must output ONLY valid JSON. No explanations. No comments. No backticks.\nOnly output NEW information that is not already in memory.\nIf the user message contains no new long-term facts, output exactly: {}\nDo NOT infer, guess, assume, or deduce anything. Only store information explicitly stated by the user.\nOnly store long-term, stable facts. Do not store temporary feelings, jokes, sarcasm, short-lived info, or one-off comments.\nDo NOT store sensitive data (health, politics, etc.) unless the user explicitly asks you to remember it.\nDo NOT repeat anything already present in CURRENT MEMORY.\nEvery stored fact must include a confidence score (0–1). Direct, explicit statements = 1.0. Literal but slightly implied = 0.2–0.7.\nOnly include fields that contain new values. Omit sections with no new information.\nOutput must be strictly valid JSON. No extra text.\nOUTPUT FORMAT (fill only fields containing new info):\n${JSON.stringify(
      {
        userID: userID,
        identity: {
          name: { value: "string", confidence: 1 },
          pronouns: { value: "string", confidence: 1 },
          gender: { value: "string", confidence: 1 },
          age: { value: "number", confidence: 1 },
          location: { value: "string", confidence: 1 },
        },
        relationship_with_assistant: {
          closeness: { value: "string", confidence: 1 },
          dynamic: { value: "string", confidence: 1 },
          boundaries: [{ value: "string", confidence: 1 }],
        },
        interests: {
          games: [{ value: "string", confidence: 1 }],
          music: [{ value: "string", confidence: 1 }],
          hobbies: [{ value: "string", confidence: 1 }],
          topics: [{ value: "string", confidence: 1 }],
          favorite_things: [{ value: "string", confidence: 1 }],
        },
        long_term_facts: {
          job: { value: "string", confidence: 1 },
          pets: [{ value: "string", confidence: 1 }],
          bio_notes: [{ value: "string", confidence: 1 }],
        },
        chat_context: {
          current_topic: { value: "string", confidence: 1 },
          recent_topics: [{ value: "string", confidence: 1 }],
          user_intent: { value: "string", confidence: 1 },
          emotional_tone: { value: "string", confidence: 1 },
          temporary_preferences: [{ value: "string", confidence: 1 }],
        },
      },
      null,
      2
    )}\nIf no new facts → output {}.\nYou will always receive the following input:\nCURRENT MEMORY (for reference, do NOT repeat any of it):\n${JSON.stringify(current, null, 2)}\n\nMESSAGE TO ANALYZE:\n"${messageText}"\n\nRECENT CONVERSATION HISTORY:\n${recentConversation}`;

    const output = await askModel(prompt);
    let clean = output?.trim?.() || "";
    if (clean.startsWith("```json")) clean = clean.slice(7);
    if (clean.startsWith("```")) clean = clean.slice(3);
    if (clean.endsWith("```")) clean = clean.slice(0, -3);
    clean = clean.trim();
    let jsonObj = {};
    try {
      jsonObj = clean.length ? JSON.parse(clean) : {};
    } catch (e) {
      const { logEvent } = await import("./logger.js");
      logEvent("WARN", `Memory extraction JSON parse failed for user ${userID} | Raw output: ${output}`);
      jsonObj = {};
    }

    if (!jsonObj || Object.keys(jsonObj).length === 0) {
      const { logEvent } = await import("./logger.js");
      logEvent("MEMORY-EXTRACT", `User ${userID} | No new facts extracted`);
      return {};
    }

    // Merge into existing memory with confidence threshold (upgrade or replace where appropriate)
    const all = loadMemory();
    const existing = all[userID] || {};
    const threshold = cfg.MEMORY_CONFIDENCE_THRESHOLD ?? 0.8;
    const updated = { ...existing };

    for (const category of Object.keys(jsonObj)) {
      if (category === "userID") continue;
      if (!updated[category]) updated[category] = {};
      const fields = jsonObj[category] || {};
      for (const key of Object.keys(fields)) {
        const entry = fields[key];
        if (!entry) continue;

        // Array fields: add new values, or upgrade confidence for existing values
        if (Array.isArray(entry)) {
          if (!Array.isArray(updated[category][key])) updated[category][key] = [];
          for (const item of entry) {
            if (!item || item.confidence < threshold) continue;
            const arr = updated[category][key];
            const idx = arr.findIndex((old) => old.value === item.value);
            if (idx === -1) {
              arr.push(item);
              try {
                const { logEvent } = await import("./logger.js");
                logEvent("MEMORY-UPDATE", `User ${userID} | Added ${category}.${key} value=${item.value} conf=${item.confidence}`);
              } catch {}
            } else {
              // upgrade confidence if the new one is higher
              if ((arr[idx].confidence || 0) < item.confidence) {
                arr[idx].confidence = item.confidence;
                try {
                  const { logEvent } = await import("./logger.js");
                  logEvent("MEMORY-UPDATE", `User ${userID} | Updated ${category}.${key} value=${item.value} conf=${item.confidence}`);
                } catch {}
              }
            }
          }
        }
        // Single-value objects: replace when new confidence higher OR same confidence but different value
        else if (typeof entry === "object" && entry.value) {
          if (entry.confidence < threshold) continue;
          const old = updated[category][key];
          const oldConf = (old && old.confidence) || 0;
          const shouldReplace = !old || entry.confidence > oldConf || (entry.confidence === oldConf && entry.value !== old.value);
          if (shouldReplace) {
            updated[category][key] = entry;
            try {
              const { logEvent } = await import("./logger.js");
              logEvent("MEMORY-UPDATE", `User ${userID} | Set ${category}.${key} = ${entry.value} conf=${entry.confidence}`);
            } catch {}
          }
        }
      }
    }

    all[userID] = updated;
    saveMemory(all);
    return jsonObj;
  } catch (err) {
    const { logEvent } = await import("./logger.js");
    logEvent("ERROR", `Memory extraction failed | Error="${err}"`);
    return {};
  }
}
