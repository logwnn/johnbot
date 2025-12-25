export default {
  name: "messageCreate",
  async execute(client, message) {
    if (message.author?.bot) return;

    const { logEvent } = await import("../utils/logger.js");
    // Log basic receipt (avoid logging full content beyond a short snippet)
    try {
      const snippet = (message.content || "").slice(0, 120).replace(/\n/g, " ");
      logEvent("MESSAGE-RECV", `From ${message.author.id} in ${message.channel.id} | ${snippet}`);
    } catch (e) {
      // non-fatal logging error
    }

    // If the bot is mentioned, handle with the LLM mention handler
    const { handleMention } = await import("../handlers/mentionHandler.js");
    if (message.mentions?.has(client.user)) {
      logEvent("MESSAGE-MENTION", `Mention from ${message.author.id} in ${message.channel.id}`);
      await handleMention(client, message);
      return;
    }

    // Otherwise delegate prefix-based commands to the command handler
    const { handleMessage } = await import("../handlers/commandHandler.js");
    logEvent("MESSAGE-DELEGATE", `Delegating message from ${message.author.id} to command handler`);
    await handleMessage(client, message);
  },
};
