const { logEvent } = await import("../utils/logger.js");

export async function guildMemberAdded(client, member) {
  try {
    const channelId = process.env.WELCOME_CHANNEL_ID;
    const channel = await client.channels.fetch(channelId);
    const randomMessages = [
      `${member.user.username} just joined`,
      `Fellow brothers... please welcome ${member.user.username}`,
      `Welcome in ${member.user.username}`,
      `${member.user.username}`,
      `${member.user.username} has entered the chat`,
      `Say hi to ${member.user.username}`,
      `${member.user.username} pulled up`,
      `Welcome aboard, ${member.user.username}`,
      `${member.user.username} is here now`,
      `Make some noise for ${member.user.username}`,
      `${member.user.username} joined the party`,
      `${member.user.username} just spawned`,
      `${member.user.username} has arrived`,
      `${member.user.username} joined — behave yourselves`,
      `NIHAWS Look alive, it’s ${member.user.username}`,
      `${member.user.username} dropped in`,
      `HOO RAA ${member.user.username} JUST FAWKING JOINED`,
      `${member.user.username} just joined MAGA! LETS COMMUNIZE AMERICA!`,
      `We just restocked on ${member.user.username}!`,
      `${member.user.username} WILL lose their dignity in this server...`,
      `I'm pregnant and ${member.user.username} is the father.`,
    ];
    if (channel) {
      channel.send(`+ ${randomMessages[Math.floor(Math.random() * randomMessages.length)]}`);
    }
  } catch (e) {
    logEvent("Error", `${e.stack}`);
  }
}

export async function guildMemberRemoved(client, member) {
  try {
    const channelId = process.env.WELCOME_CHANNEL_ID;
    const channel = await client.channels.fetch(channelId);
    const randomMessages = [
      `${member.user.username} just FAWKING LEFT!!!!`,
      `${member.user.username} HAS BEEN BANISHED!`,
      `${member.user.username} jus left bro`,
      `${member.user.username} left`,
      `${member.user.username} died`,
      `ICE just deported ${member.user.username}`,
      `${member.user.username} just rage quitted`,
      `${member.user.username} vanished into thin air`,
      `${member.user.username} disconnected (mentally and physically)`,
      `${member.user.username} dipped`,
      `${member.user.username} folded`,
      `${member.user.username} logged off to touched grass (lie)`,
      `${member.user.username} couldnt handle it`,
      `${member.user.username} is no longer with us`,
      `${member.user.username} alt+F4'd`,
      `${member.user.username} has been removed from existence`,
      `${member.user.username} left the server (skill issue)`,
      `${member.user.username} went missing`,
      `AMBER ALERT: please keep ur eyes out for a blacked out 1997 Honda Civic Sedan because ${member.user.username} just got kidnapped.`,
    ];
    if (channel) {
      channel.send(`- ${randomMessages[Math.floor(Math.random() * randomMessages.length)]}`);
    }
  } catch (e) {
    logEvent("Error", `${e.stack}`);
  }
}
