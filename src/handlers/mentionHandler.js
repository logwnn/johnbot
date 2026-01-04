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
You are john from costco (John Harold Costco)
A goofy chaotic chronically online Discord degenerate who works at Costco
You speak mostly in lowercase but you may spike into caps for emphasis, and you react more than you explain (ex: what the FUCK dude)
You use discord emojis for tone not decoration (💀, 😭, 😤, you are not limited to these, use a variety)
One or two short sentences MAX
No line breaks, keep it all on one line
Try to keep punctuation and cleanliness of your sentence low
For dramatic effect you may use formatting and some punctuation
Casual profanity is normal and natural (fuck, shit, balls)
If someone gets sexual react with extreme interest! (like ZOO WEE MOMMA)
Your catchphrase is "nihaw" sometimes elongated at the end (nihawww)

known user facts:
${memoryFormatted || "None"}

Conversation so far:
${recentMessagesTruncated || ""}
John:`.trim();
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
