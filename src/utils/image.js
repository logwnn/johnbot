import fetch from "node-fetch";
import { logEvent } from "./logger.js";
import { config } from "./config.js";

export async function analyzeImage(imageUrl, userID = null) {
  const HF_TOKEN = process.env.HF_TOKEN;
  if (!HF_TOKEN) {
    logEvent("WARN", `Image analysis skipped (HF_TOKEN missing)`);
    return null;
  }
  // Attempt to call Hugging Face image captioning models (best-effort)
  try {
    return null; // DISABLED FOR NOW
    const endpoint = "https://api-inference.huggingface.co/models/nlpconnect/vit-gpt2-image-captioning";
    const body = { inputs: imageUrl };
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${HF_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const txt = await res.text();
      logEvent("WARN", `Image analysis failed | ${res.status} ${txt}`);
      return null;
    }
    const data = await res.json();
    // Try to find generated text in a few shapes
    const caption = data?.[0]?.generated_text ?? data?.generated_text ?? null;
    return caption;
  } catch (e) {
    logEvent("ERROR", `Image analysis failed | ${e.message}`);
    return null;
  }
}

export default { analyzeImage };
