export default {
  name: "guildMemberAdd",
  async execute(client, member) {
    const { logEvent } = await import("../utils/logger.js");
    const { guildMemberAdded } = await import("../handlers/memberHandler.js");
    logEvent("guildMemberAdd", `${member.user.username} just triggered event`);
    await guildMemberAdded(client, member);
  },
};
