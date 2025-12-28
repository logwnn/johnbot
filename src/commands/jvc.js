import { SlashCommandBuilder } from "discord.js";
import {
  joinVoiceChannel,
  EndBehaviorType,
  createAudioPlayer,
  createAudioResource,
  StreamType,
} from "@discordjs/voice";
import prism from "prism-media";
import fs from "fs";
import { execSync } from "child_process";
import { Readable } from "stream";
import OpenAI from "openai";
import { logEvent } from "../utils/logger.js";
import { config } from "../utils/config.js";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export default {
  name: "jvc",
  description: "John joins VC, listens, and responds with GPT-Audio",
  permissions: ["OWNER"],
  data: new SlashCommandBuilder()
    .setName("jvc")
    .setDescription("John joins VC, listens, and responds with GPT-Audio"),

  async execute(client, message) {
    await message.reply("Use /jvc in a voice channel!");
  },

  async executeSlash(client, interaction) {
    if (!interaction.member.voice.channel)
      return interaction.reply({ content: "Join a voice channel first.", ephemeral: true });

    const channel = interaction.member.voice.channel;

    const connection = joinVoiceChannel({
      channelId: channel.id,
      guildId: channel.guild.id,
      adapterCreator: channel.guild.voiceAdapterCreator,
      selfDeaf: false,
    });

    const player = createAudioPlayer();
    connection.subscribe(player);

    await interaction.reply({ content: "Joined VC! Listening...", ephemeral: true });

    let isProcessing = false; // Prevent multiple AI calls at the same time
    const RATE_LIMIT_MS = 8000; // 8 seconds between AI calls
    let lastProcessedTime = 0;
    const activeStreams = new Map();

    const cleanup = () => {
      logEvent("Cleaning up VC resources...");
      player.stop(true);
      for (const s of activeStreams.values()) s.destroy();
      activeStreams.clear();
    };

    connection.receiver.speaking.on("start", (userId) => {
      const opusStream = connection.receiver.subscribe(userId, {
        end: { behavior: EndBehaviorType.AfterSilence, duration: 1200 },
      });

      activeStreams.set(userId, opusStream);

      const decoder = new prism.opus.Decoder({ frameSize: 960, channels: 2, rate: 48000 });
      const chunks = [];
      opusStream.pipe(decoder);

      decoder.on("data", (chunk) => {
        if (Buffer.isBuffer(chunk)) chunks.push(chunk);
        else if (Array.isArray(chunk)) chunks.push(Buffer.from(chunk));
        else if (typeof chunk === "number") chunks.push(Buffer.from([chunk]));
      });

      decoder.once("end", async () => {
        activeStreams.delete(userId);
        const pcmBuffer = Buffer.concat(chunks);

        // Skip short audio (<3 seconds)
        if (pcmBuffer.length < 48000 * 2 * 3) return;

        const now = Date.now();
        if (isProcessing || now - lastProcessedTime < RATE_LIMIT_MS) {
          logEvent("RATE-LIMIT", `Skipping AI processing for user ${userId}`);
          return;
        }

        isProcessing = true;
        lastProcessedTime = now;

        try {
          // Write PCM to temp file
          const pcmPath = `./temp_${userId}.pcm`;
          const wavPath = `./temp_${userId}.wav`;
          const cleanPath = `./temp_${userId}_clean.wav`;
          fs.writeFileSync(pcmPath, pcmBuffer);

          // Convert PCM to WAV
          execSync(`ffmpeg -y -f s16le -ar 48000 -ac 2 -i ${pcmPath} ${wavPath}`);

          // Apply background noise reduction (afftdn)
          execSync(`ffmpeg -y -i ${wavPath} -af "afftdn=nf=-25" ${cleanPath}`);

          const audioData = fs.readFileSync(cleanPath);
          const base64str = Buffer.from(audioData).toString("base64");

          // GPT-Audio request (short, concise responses)
          const gptAudioResponse = await openai.chat.completions.create({
            model: "gpt-audio",
            modalities: ["text", "audio"],
            audio: { voice: "alloy", format: "wav" },
            messages: [
              { role: "system", content: config.personality },
              {
                role: "user",
                content: [
                  { type: "text", text: "Respond concisely to this voice input." },
                  { type: "input_audio", input_audio: { data: base64str, format: "wav" } },
                ],
              },
            ],
            store: true,
          });

          const audioOut = Buffer.from(gptAudioResponse.choices[0].message.audio.data, "base64");
          const resource = createAudioResource(Readable.from(audioOut), {
            inputType: StreamType.Arbitrary,
          });
          player.play(resource);

          logEvent(`[GPT-Audio Response] played for user ${userId}`);

          // Cleanup temp files
          [pcmPath, wavPath, cleanPath].forEach((p) => fs.existsSync(p) && fs.unlinkSync(p));

          await new Promise((resolve) => player.once("idle", resolve));
        } catch (err) {
          console.error("Error handling user speech:", err);
          logEvent("ERROR", `User speech handling failed: ${err.stack}`);
        } finally {
          isProcessing = false;
        }
      });
    });

    connection.on("stateChange", (_, newState) => {
      if (["disconnected", "destroyed"].includes(newState.status)) cleanup();
    });
  },
};
