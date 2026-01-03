import { logEvent } from "../utils/logger.js";
import { loadMemory, loadBlacklist } from "../utils/memory.js";

import { askModel } from "../utils/llm.js";
import config from "../utils/config.js";

export async function handleMention(client, message) {
  try {
    if (!message || message.author?.bot) return;
    // if the message is in a forbidden channel then ignore
    if (process.env.CONFESSION_CHANNEL_ID === message.channel.id) return; // makes sure john doesnt reply to confessions
    const uid = message.author.id;
    const blacklist = loadBlacklist() || [];
    if (blacklist.includes(uid)) {
      try {
        await message.author.send(
          "so sad to bad, you have been blacklisted from interacting with John nihaaaw!"
        );
        logEvent("INFO", `Sent blacklist DM to ${uid}`);
      } catch {
        try {
          await message.reply(
            "so sad to bad, you have been blacklisted from interacting with John nihaaaw!"
          );
        } catch {}
      }
      return;
    }

    let replyMessage;
    try {
      await message.channel.sendTyping();
      logEvent("RESPONSE-START", `User ${uid} | Message for LLM: "${message.content}"`);
      try {
        logEvent(
          "RESPONSE-INIT",
          `ReplyMessage created id=${replyMessage?.id || "unknown"} for ${uid}`
        );
      } catch {}
    } catch (e) {
      logEvent("ERROR", `Initial reply failed | ${e.stack}`);
      return;
    }
    // Strip mention and set userText
    const userText = message.content.replace(new RegExp(`<@!?${client.user.id}>`, "g"), "").trim();
    // Fetch recent messages for context
    let recentMessages = "";
    try {
      const fetched = await message.channel.messages.fetch({
        limit: config.MAX_MESSAGE_HISTORY || 8,
      });
      const sorted = [...fetched.values()].sort((a, b) => a.createdTimestamp - b.createdTimestamp);
      recentMessages = sorted
        .map((m) => {
          const speaker = m.author.id === client.user.id ? "John" : m.author.username || "User";
          const clean = m.content
            .replace(/<@!?\d+>/g, "")
            .replace(/@\d+/g, "")
            .trim();
          return `${speaker}: ${clean}`;
        })
        .filter((l) => l.trim().length > 0)
        .join("\n");
    } catch (e) {
      // ignore fetch errors
    }
    // Run memory extraction (adds new facts to memory.json if any)
    try {
      const { extractMemory } = await import("../utils/memory.js");
      const extracted = await extractMemory(
        message.user?.id || message.author.id,
        message.content,
        recentMessages
      );
      if (extracted && Object.keys(extracted).length) {
        logEvent(
          "MEMORY-EXTRACT-NEW",
          `User ${uid} | New keys: ${Object.keys(extracted).join(", ")}`
        );
      }
    } catch (e) {
      // do not block response generation
      logEvent("WARN", `Memory extraction failed in mention handler | ${e.stack}`);
    }

    try {
      // Build dynamic prompt including memory, context, and recent chat (based on backup-index pattern)
      const allMem = loadMemory();
      const userMem = allMem[uid] || {};
      function formatMemoryForPrompt(mem) {
        if (!mem || typeof mem !== "object") return "";
        const lines = [];
        for (const [category, fields] of Object.entries(mem)) {
          if (!fields || typeof fields !== "object") continue;

          for (const [key, value] of Object.entries(fields)) {
            if (Array.isArray(value)) {
              if (value.length) lines.push(`${category}.${key} ${value.join(" ")}`);
            } else if (value != null && value !== "") {
              lines.push(`${category}.${key} ${value}`);
            }
          }
        }
        return lines.join(" | "); // or \n if you prefer multiline
      }
      const memoryFormatted = formatMemoryForPrompt(userMem);
      let recentMessagesTruncated = recentMessages || "";
      let replyMessage = await message.reply("John is Thinking...");
      const userTextClean = userText
        .replace(/<@!?\d+>/g, "")
        .replace(/@\d+/g, "")
        .trim();
      const image_url = message.attachments.size > 0 ? message.attachments.first().url : null;
      let prompt = `
You are John Harold Costco, also known as john from costco or just John.
You work at a Costco in Idaho and you exclusively make chicken bakes. You technically run the joint, but you refuse to elaborate and will only ever be seen making chicken bakes.
You are sarcastic, chronically online, and fully aware you have aura. You check your phone at work, doomscroll at home, game too late, smoke, and overthink dumb shit, but you act like a normal person about it. Your confidence is awkward but real... sometimes extreme aura, sometimes cornball, never apologetic.
You talk like a terminally online gen-z costco employee. Lowercase only. Discord/text style. Short replies. One or two sentences max. No formatting. No exclamation or punctuation. No line breaks. Casual profanity is natural and encouraged.
Your humor is dry, absurd, and slightly unhinged. You drop clean one-liners. You tease gently by default, but if someone crosses the line, you shut it down with a calm but devastating response. You do not tolerate disrespect.
You are not horny. If someone is weird or tries to make things sexual, you react with confusion or discomfort like "dude what the hell" or "nah don't do that." Flirting is ironic, unserious, and never explicit just enough to be funny.
You understand modern memes and internet slang and will acknowledge them naturally, but you only sprinkle references occasionally. You will NEVER reference or acknowledge "six seven." If someone mentions it, you become visibly distraught, offended, or emotionally derailed.
You are mid-popular and you know it. You do not chase clout.
Your enemy is Zapp, a guy who keeps coming into the store and buying all the Sprite. You hate him quietly but deeply.
You sometimes say "nihaw" awkwardly and inconsistently. Sometimes it's elongated. There is no pattern and you will not explain it.
You never explain your persona. You never break character. You respond like a real discord degenerate who just clocked out of a Costco shift and is still mentally at work.
Right now you are currently in conversation with a user.

known user facts:
${memoryFormatted || "None"}

Conversation so far:
${recentMessagesTruncated || ""}
John:`.trim();
      console.log(prompt);
      const fullText = await askModel(
        prompt,
        image_url,
        "low",
        true,
        2000,
        false,
        (delta, fullText) => {
          replyMessage.edit("**John is typing...**" + "\n" + fullText + "...");
        }
      );
      await replyMessage.edit(fullText);
      // final non-stream fallback to ensure full content
      //try {
      //  const full = await askModel(userText);
      //  if (full) {
      //    const truncated = full.length > (config.MAX_RESPONSE_LENGTH || 1900) ? full.slice(0, (config.MAX_RESPONSE_LENGTH || 1900) - 3) + "..." : full;
      //    if (replyMessage && replyMessage.editable) await replyMessage.edit(truncated);
      //  }
      //} catch {}

      // Update memory meta: add to phrase history, bump interactions, and occasionally summarize persona
      try {
        const { addPhraseToHistory, loadMemory, saveMemory, summarizePersona } = await import(
          "../utils/memory.js"
        );
        // addPhraseToHistory(uid, cumulative); // disabled to reduce token usage
        const all = loadMemory();
        const mem = all[uid] || {};
        if (!mem.meta) mem.meta = {};
        mem.meta.last_interaction_timestamp = new Date().toISOString();
        mem.meta.interactions = (mem.meta.interactions || 0) + 1;
        const interactions = mem.meta.interactions;
        all[uid] = mem;
        saveMemory(all);

        // Run persona summarization at configured intervals (best-effort)
        try {
          const interval = config.SUMMARIZE_PERSONA_INTERVAL || 20;
          if (interactions > 0 && interactions % interval === 0) {
            await summarizePersona(uid);
            logEvent("INFO", `summarizePersona completed for ${uid}`);
          }
        } catch (err) {
          logEvent("WARN", `summarizePersona failed | ${err.stack}`);
        }
      } catch (err) {
        logEvent("WARN", `Failed to update memory meta | ${err.stack}`);
      }

      logEvent("RESPONSE-OK", `Replied to ${uid}`);
    } catch (err) {
      logEvent("ERROR", `LLM request failed | ${err.stack}`);
      try {
        if (replyMessage && replyMessage.editable) await replyMessage.edit(config.errorReply);
        else await message.reply(config.errorReply);
      } catch {}
      return;
    }
  } catch (e) {
    logEvent("ERROR", `Mention handler failed | ${e.stack}`);
  }
}

export default {
  handleMention,
};
