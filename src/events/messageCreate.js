export default {
  name: "messageCreate",
  async execute(client, message) {
    if (message.author?.bot) return;

    const { logEvent } = await import("../utils/logger.js");

    // If the bot is mentioned, handle with the LLM mention handler
    const { handleMention } = await import("../handlers/mentionHandler.js");
    if (message.mentions?.has(client.user)) {
      logEvent("MESSAGE-MENTION", `Mention from ${message.author.id} in ${message.channel.id}`);
      await handleMention(client, message);
      return;
    }

    // Otherwise delegate prefix-based commands to the command handler
    const { handleMessage } = await import("../handlers/commandHandler.js");
    await handleMessage(client, message);
  },
};
