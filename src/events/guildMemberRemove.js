export default {
  name: "guildMemberRemove",
  async execute(client, member) {
    try {
      const { logEvent } = await import("../utils/logger.js");
      const { guildMemberRemoved } = await import("../handlers/memberHandler.js");
      logEvent("guildMemberRemove", `${member.user.username} just triggered event`);
      await guildMemberRemoved(client, member);
    } catch (e) {
      console.log(e.stack);
    }
  },
};
