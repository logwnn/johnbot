const { logEvent } = await import("../utils/logger.js");
export async function handleVoiceStateUpdate(client, oldState, newState) {
  logEvent(
    "VOICE-STATE-HANDLER",
    `Handling voice state update for user ${newState.id} in guild ${newState.guild.id}`
  );
}
