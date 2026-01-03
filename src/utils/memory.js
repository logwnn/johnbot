import fs from "fs";
import path from "path";
import { logEvent } from "./logger.js";
import { askModel } from "./llm.js";

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
  return "";
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

export async function extractMemory(userID, messageText, recentMessages) {
  const all = loadMemory();
  const existing = all[userID] ?? {};

  const prompt = `
You are extracting long-term memory from a user message
OUTPUT RULES
- Only use the categories: identity, relationship_with_assistant, interests, long_term_facts, chat_context
- Your job is to populate sub categories such as identity.name, interests.hobbies, etc.
- Always use named keys (no numbers)
- Arrays only for interests
- Output JSON only
- If no memory found, output {}
CURRENT MEMORY KEYS: ${JSON.stringify(Object.keys(existing))}
USER MESSAGE: "${messageText}"
`;
  const raw = await askModel(prompt, null, "minimal", false, 500, false);
  // ---------- SAFE JSON PARSE ----------
  console.log(raw);
  let parsed = null;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = null;
  }
  if (!parsed || typeof parsed !== "object" || Object.keys(parsed).length === 0) {
    return {};
  }
  // ---------- MERGE / NORMALIZE ----------
  const updated = structuredClone(existing);
  for (const [category, fields] of Object.entries(parsed)) {
    if (!fields || typeof fields !== "object") continue;
    if (!updated[category]) updated[category] = {};
    for (const [key, value] of Object.entries(fields)) {
      if (value == null || value === "") continue;
      // enforce single vs array
      const isArray = Array.isArray(updated[category][key]) || Array.isArray(value);
      if (isArray) {
        updated[category][key] ??= [];
        for (const v of Array.isArray(value) ? value : [value]) {
          if (!updated[category][key].includes(v)) updated[category][key].push(v);
        }
      } else {
        updated[category][key] = value;
      }
    }
  }
  all[userID] = updated;
  saveMemory(all);
  return parsed;
}
