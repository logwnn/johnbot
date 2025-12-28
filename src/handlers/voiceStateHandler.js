const { logEvent } = await import("../utils/logger.js");
const { loadVoiceStateSubscribers, saveVoiceStateSubscribers } = await import("../utils/memory.js");
const subscribers = await loadVoiceStateSubscribers();
export async function handleVoiceStateUpdate(client, oldState, newState) {
  if (!newState.channelId) return;

  const subscribers = await loadVoiceStateSubscribers();

  for (const [userId, channelIds] of Object.entries(subscribers)) {
    for (const channelId of channelIds) {
      if (oldState.channelId !== channelId && newState.channelId === channelId) {
        try {
          const user = await client.users.fetch(userId);
          const dm = await user.createDM();
          const messages = [
            `https://media.discordapp.net/attachments/1351847916938985515/1394575628786733057/image.png?ex=69517f83&is=69502e03&hm=71f5a34043574db29f6a8f99ca6a8dca4a935418e15d3c0a2ead2868484be412&=&format=webp&quality=lossless&width=669&height=556`,
            `https://media.discordapp.net/attachments/1351847916938985515/1352793818529009837/image.png?ex=6951c46c&is=695072ec&hm=4904c4d2b58585e1e5062f6ecaa0c515b0347297aa08bb85b4118311757d5a29&=&format=webp&quality=lossless&width=504&height=218`,
            `https://media.discordapp.net/attachments/1351847916938985515/1453918118731583519/image.png?ex=69512c83&is=694fdb03&hm=5888f66191a0f9ef4b1d0446f8f8508d1f6c1f5e31163cfe4288796e72516ce2&=&format=webp&quality=lossless&width=603&height=158`,
            `https://media.discordapp.net/attachments/1351847916938985515/1453793661690314947/image.png?ex=6951615b&is=69500fdb&hm=19b84e6f6784c5510064f2dd87c257204592c555668afe4e6912393a28098db5&=&format=webp&quality=lossless&width=661&height=148`,
            `https://media.discordapp.net/attachments/1351847916938985515/1451675461020291072/IMG_4916.png?ex=695195a0&is=69504420&hm=c613b3d7fd4ef61927b9dad618e86a13b04fc777cff0237f85825452083dc367&=&format=webp&quality=lossless&width=1463&height=343`,
            `https://media.discordapp.net/attachments/1351847916938985515/1447355988872003726/Screenshot_2025-12-07_at_5.35.54_PM.png?ex=6951b0ce&is=69505f4e&hm=d9fcf827b255e69fc10f6433ade4277f270094100377b319708bedadd6ae28f7&=&format=webp&quality=lossless&width=828&height=163`,
            `https://media.discordapp.net/attachments/1351847916938985515/1446734562800566394/B60221EE-4DAC-4C81-A0C2-4190A99C7B51.png?ex=6951684e&is=695016ce&hm=2f3f1f229555dfeb1b2d9ca98dc5a27260e617bf3f13c9818da192c90eaa8331&=&format=webp&quality=lossless&width=746&height=125`,
            `https://media.discordapp.net/attachments/1351847916938985515/1444920417046499480/IMG_1399.png?ex=69516640&is=695014c0&hm=07dedf6962ea01df244d019aae6a3e1231ccf7289ea2fbc7ac9efcd1f07face0&=&format=webp&quality=lossless&width=1073&height=313`,
            `https://media.discordapp.net/attachments/1351847916938985515/1433014824916357221/IMG_20251028_132847_506.png?ex=695197ce&is=6950464e&hm=06ded39acdaf3fa762dc0f211fab0082b22bed2c5f8d5c8c2f3bb4c232b22901&=&format=webp&quality=lossless&width=850&height=845`,
            `https://media.discordapp.net/attachments/1351847916938985515/1415791102828613802/image.png?ex=69518e37&is=69503cb7&hm=84c20e666ef307d41d47873e342a2a3713ccac931a0b76f2a70f254448536ee7&=&format=webp&quality=lossless&width=816&height=950`,
            `https://media.discordapp.net/attachments/1351847916938985515/1410639462119247982/SPOILER_image.png?ex=69514560&is=694ff3e0&hm=7360a78ada89e288e72bc83efe1621d1a418959b7c33bd4e7b8cf356f534f702&=&format=webp&quality=lossless&width=815&height=950`,
            `https://cdn.discordapp.com/attachments/1351847916938985515/1398837540823236609/cachoro.gif?ex=69512eba&is=694fdd3a&hm=cf7333affed70ef61e9a23a27b8bdf48a5862715bc920f57e5b4fbdc11020fe6&`,
            `"cherry blossom iced tea"`,
            `You're mine.`,
            `"i love making kids watch me masturbate" - mewgrim`,
            `goo goo gaa gaa age regressing goo goo gaa gaa - mewgrim`,
            `"Hopeth on myme cock until my erection ceases to exist" - ungirm`,
            `"i told her how i wanted to still talk to him and that how ir using him (not in a bad way i was NOt talking bad about u cuz i was using him too)"`,
          ];
          await dm.send(
            `drag ${newState.member.user.username}... NOW NOW NOW!!\n\n${
              messages[Math.floor(Math.random() * messages.length)]
            }`
          );
        } catch (err) {
          logEvent("VC-NOTIFY-FAIL", `user=${userId} channel=${channelId} reason=${err?.message}`);
        }
      }
    }
  }
}
