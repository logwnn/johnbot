import { config } from "./config.js";
import { logEvent } from "./logger.js";

/**
 * askModel: simple non-streaming request that returns final text
 */
export async function askModel(prompt, options = {}) {
  const endpoint = config.LLM_ENDPOINT;
  const body = {
    model: config.LLM_MODEL,
    messages: [
      { role: "system", content: config.personality },
      { role: "user", content: prompt },
    ],
    max_tokens: options.max_tokens || 512,
    stream: false,
  };
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.HF_TOKEN}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`LLM error: ${res.status} ${txt}`);
  }
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content ?? data?.response ?? data?.text ?? data?.output_text ?? null;
  return content;
}

/**
 * askModelStream: streaming request that calls onDelta for each textual chunk
 * onDelta(delta, cumulative)
 */
export async function askModelStream(prompt, { onDelta, max_tokens = 512 } = {}) {
  try {
    logEvent("LLM-STREAM-REQUEST", `model=${config.LLM_MODEL} prompt_snip=${(prompt || "").slice(0, 60).replace(/\n/g, " ")}`);
  } catch {}
  const endpoint = config.LLM_ENDPOINT;
  const body = {
    model: config.LLM_MODEL,
    messages: [
      { role: "system", content: config.personality },
      { role: "user", content: prompt },
    ],
    max_tokens,
    stream: true,
  };

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.HF_TOKEN}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const txt = await res.text();
    logEvent("ERROR", `LLM stream request failed | ${res.status} ${txt}`);
    throw new Error(`LLM error: ${res.status} ${txt}`);
  }

  let output = "";

  if (!res.body || typeof res.body.getReader !== "function") {
    // Not a stream, fallback to JSON
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content ?? data?.response ?? data?.text ?? null;
    if (content && onDelta) await onDelta(content, content);
    try {
      logEvent("LLM-STREAM-END", `non-stream fallback length=${content?.length || 0}`);
    } catch {}
    return content;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop();
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      if (!trimmed.startsWith("data:")) continue;
      const jsonStr = trimmed.substring(5).trim();
      if (jsonStr === "[DONE]") continue;
      try {
        const data = JSON.parse(jsonStr);
        const delta = data?.choices?.[0]?.delta?.content ?? data?.response ?? data?.text ?? null;
        if (delta) {
          output += delta;
          try {
            if (onDelta) await onDelta(delta, output);
          } catch (err) {
            // swallow
            logEvent("ERROR", `onDelta callback failed | ${err.message}`);
          }
        }
      } catch (err) {
        // ignore parse error
        output += jsonStr;
        if (onDelta) await onDelta(jsonStr, output);
      }
    }
  }

  // flush remaining buffer if any
  if (buffer) {
    try {
      const data = JSON.parse(buffer);
      const delta = data?.choices?.[0]?.delta?.content ?? data?.response ?? data?.text ?? null;
      if (delta) {
        output += delta;
        if (onDelta) await onDelta(delta, output);
      }
    } catch {}
  }

  try {
    logEvent("LLM-STREAM-END", `output_length=${output.length}`);
  } catch {}
  return output;
}
