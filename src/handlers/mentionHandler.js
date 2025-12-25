import { logEvent } from "../utils/logger.js";
import { loadMemory, loadBlacklist } from "../utils/memory.js";

import { askModelStream, askModel } from "../utils/llm.js";
import config from "../utils/config.js";

export async function handleMention(client, message) {
  try {
    if (!message || message.author?.bot) return;
    const uid = message.author.id;
    const blacklist = loadBlacklist() || [];
    if (blacklist.includes(uid)) {
      try {
        await message.author.send(config.blacklistReply);
        logEvent("INFO", `Sent blacklist DM to ${uid}`);
      } catch {
        try {
          await message.reply(config.blacklistReply);
        } catch {}
      }
      return;
    }

    let replyMessage;
    try {
      replyMessage = await message.reply(config.thinkingReply);
      await message.channel.sendTyping();
      logEvent("RESPONSE-START", `User ${uid} | Message for LLM: "${message.content}"`);
      try {
        logEvent("RESPONSE-INIT", `ReplyMessage created id=${replyMessage?.id || "unknown"} for ${uid}`);
      } catch {}
    } catch (e) {
      logEvent("ERROR", `Initial reply failed | ${e.message}`);
      return;
    }

    // Strip mention and set userText
    const userText = message.content.replace(new RegExp(`<@!?${client.user.id}>`, "g"), "").trim();

    // Fetch recent messages for context
    let recentMessages = "";
    try {
      const fetched = await message.channel.messages.fetch({ limit: config.MAX_MESSAGE_HISTORY || 8 });
      const sorted = [...fetched.values()].sort((a, b) => a.createdTimestamp - b.createdTimestamp);
      recentMessages = sorted
        .map((m) => {
          const role = m.author.bot && m.author.id === client.user.id ? "John" : "You";
          const clean = m.content
            .replace(/<@!?\d+>/g, "")
            .replace(/@\d+/g, "")
            .trim();
          return `${role}: ${clean}`;
        })
        .filter((l) => l.trim().length > 0)
        .join("\n");
    } catch (e) {
      // ignore fetch errors
    }

    // Run memory extraction (adds new facts to memory.json if any)
    try {
      const { extractMemory } = await import("../utils/memory.js");
      const extracted = await extractMemory(message.user?.id || message.author.id, message.content, recentMessages);
      if (extracted && Object.keys(extracted).length) {
        logEvent("MEMORY-EXTRACT-NEW", `User ${uid} | New keys: ${Object.keys(extracted).join(", ")}`);
      }
    } catch (e) {
      // do not block response generation
      logEvent("WARN", `Memory extraction failed in mention handler | ${e.message}`);
    }

    // Image analysis
    let imageCaption = null;
    try {
      if (message.attachments && message.attachments.size > 0) {
        const first = message.attachments.first();
        if (first && first.contentType && first.contentType.startsWith("image")) {
          imageCaption = await analyzeImage(first.url, message.author?.id || message.user?.id);
          if (!imageCaption) logEvent("WARN", `User ${message.author.id} | Image analysis returned null | URL=${first.url}`);
          else logEvent("IMAGE-CAPTION", `User ${message.author.id} | Caption: ${imageCaption}`);
        } else if (first && /\.(png|jpe?g|gif|webp)$/i.test(first.url)) {
          imageCaption = await analyzeImage(first.url, message.author?.id || message.user?.id);
        }
      }
    } catch (err) {
      logEvent("ERROR", `Image analyze inner failed | ${err.message}`);
    }

    // Stream the response, editing the initial reply as deltas arrive
    try {
      try {
        logEvent("LLM-STREAM-START", `User ${uid} | prompt="${userText.slice(0, 120).replace(/\n/g, " ")}"`);
      } catch {}
      let lastEditTime = 0;
      let cumulative = "";
      let deltaCount = 0;
      await askModelStream(userText, {
        onDelta: async (delta) => {
          // Append the delta locally so the content only grows (prevents replacing past edits)
          deltaCount++;
          cumulative += delta;
          const now = Date.now();
          // throttle edits
          if (now - lastEditTime < (config.EDIT_THROTTLE_MS || 1200)) {
            logEvent("STREAM-THROTTLE", `User ${uid} | skipped delta #${deltaCount} | cumulative=${cumulative.length}`);
            return;
          }
          lastEditTime = now;
          // Use sentence truncation for intermediate edits
          const { truncateToSentences } = await import("../utils/text.js");
          const displayed = truncateToSentences(cumulative, 2) || cumulative.slice(0, config.MAX_RESPONSE_LENGTH || 1900);
          const truncated = displayed.length > (config.MAX_RESPONSE_LENGTH || 1900) ? displayed.slice(0, (config.MAX_RESPONSE_LENGTH || 1900) - 3) + "..." : displayed;
          try {
            if (replyMessage && replyMessage.editable) {
              await replyMessage.edit(truncated);
            } else {
              await message.channel.send(truncated);
              logEvent("RESPONSE-SEND", `Sent streamed message to channel for ${uid} (len=${truncated.length})`);
            }
          } catch (err) {
            // swallow edit errors but log
            logEvent("WARN", `Failed to edit streaming reply | ${err.message}`);
          }
        },
      });

      // After streaming completes, ensure we perform one final edit with the cumulative text
      try {
        logEvent("STREAM", `Streaming complete: ${deltaCount} deltas, cumulative length=${cumulative.length}`);
        if (cumulative && cumulative.length > 0) {
          const { truncateToSentences } = await import("../utils/text.js");
          const finalText = truncateToSentences(cumulative, 2) || cumulative;
          const truncated = finalText.length > (config.MAX_RESPONSE_LENGTH || 1900) ? finalText.slice(0, (config.MAX_RESPONSE_LENGTH || 1900) - 3) + "..." : finalText;
          try {
            if (replyMessage && replyMessage.editable) await replyMessage.edit(truncated);
          } catch (err) {
            logEvent("WARN", `Final cumulative edit failed | ${err.message}`);
          }
        }
      } catch (err) {
        logEvent("WARN", `Post-stream handling failed | ${err.message}`);
      }

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
        const { addPhraseToHistory, loadMemory, saveMemory, summarizePersona } = await import("../utils/memory.js");
        addPhraseToHistory(uid, cumulative);
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
          logEvent("WARN", `summarizePersona failed | ${err.message}`);
        }
      } catch (err) {
        logEvent("WARN", `Failed to update memory meta | ${err.message}`);
      }

      logEvent("RESPONSE-OK", `Replied to ${uid}`);
    } catch (err) {
      logEvent("ERROR", `LLM request failed | ${err.message}`);
      try {
        if (replyMessage && replyMessage.editable) await replyMessage.edit(config.errorReply);
        else await message.reply(config.errorReply);
      } catch {}
      return;
    }
  } catch (e) {
    logEvent("ERROR", `Mention handler failed | ${e.message}`);
  }
}

export default { handleMention };
