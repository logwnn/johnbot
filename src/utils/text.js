export function truncateToSentences(text, maxSentences = 2) {
  if (!text) return text;
  const cleaned = text.replace(/\s+/g, " ").trim();
  const parts = cleaned.split(/(?<=[.!?])\s+/);
  if (parts.length <= maxSentences) return cleaned;
  return parts.slice(0, maxSentences).join(" ").trim();
}

export default { truncateToSentences };
