export default {
  name: "voiceStateUpdate",
  async execute(client, oldState, newState) {
    const { logEvent } = await import("../utils/logger.js");
    const { handleVoiceStateUpdate } = await import("../handlers/voiceStateHandler.js");
    await handleVoiceStateUpdate(client, oldState, newState);
    logEvent(
      "VOICE-STATE-UPDATE",
      `Voice state updated for user ${newState.id} in guild ${newState.guild.id}`
    );
  },
};
