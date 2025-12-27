import { config } from "./config.js";
import { logEvent } from "./logger.js";
import OpenAI from "openai";
const client = new OpenAI();

export async function askModel(
  prompt,
  image_url,
  reasoningEffort,
  useWebSearch,
  MaxTokens,
  UsePersonality,
  onDelta
) {
  onDelta = onDelta || (() => {}); // prevent crashes if undefined
  const stream = await client.responses.create({
    model: config.LLM_MODEL || "gpt-5-nano",
    reasoning: { effort: reasoningEffort || "low" },
    instructions: UsePersonality ? config.personality : null,
    tools: useWebSearch ? [{ type: "web_search" }] : [],
    input: [
      {
        role: "user",
        content: [
          { type: "input_text", text: prompt },
          ...(image_url ? [{ type: "input_image", image_url }] : []),
        ],
      },
    ],
    max_output_tokens: MaxTokens || 600,
    stream: true,
  });
  let finalText = "";
  let buffer = "";
  let lastEditTime = Date.now();
  for await (const event of stream) {
    // handle plain text deltas
    if (event.type === "response.output_text.delta") {
      const delta = event.delta || "";
      finalText += delta;
      buffer += delta;
      // call onDelta every 300ms
      if (Date.now() - lastEditTime > 300) {
        onDelta(buffer, finalText);
        lastEditTime = Date.now();
        buffer = "";
      }
    }
    // handle completed event
    if (event.type === "response.completed") break;
  }
  // flush any remaining buffer
  if (buffer) onDelta(buffer, finalText);
  return finalText;
}
