export default {
  name: "voiceStateUpdate",
  async execute(client, oldState, newState) {
    const { logEvent } = await import("../utils/logger.js");
    const { handleVoiceStateUpdate } = await import("../handlers/voiceStateHandler.js");
    await handleVoiceStateUpdate(client, oldState, newState);
  },
};
