# John Bot

A modular Discord bot that uses a configurable LLM persona to reply when mentioned, maintains per-user long-term memory, and exposes health & log endpoints for operations.

---

## Quick start

Requirements:

- Node.js 18+ (recommended)
- Discord bot token (set in `.env`)
- Hugging Face token (set in `.env`)

1. Make an `.env` and set values:
   You can use the .env.example also

```env
DISCORD_TOKEN=your_discord_token_here
OPENAI_KEY=your_hf_token_here
BOT_OWNER_ID=your_discord_user_id   # owner/admin checks (optional but recommended)
CLIENT_ID=your_discord_app_id       # optional (for CLI scripts)
GUILD_ID=optional_guild_id          # optional (for scripts)
```

2. Install dependencies:

```bash
npm install
```

3. Run the bot:

```bash
npm start
```

> The health server runs on `PORT` from env or `HEALTH_PORT` from config (default: `8080`).

---

## Interaction model

- Mention the bot anywhere (channel or DM) and it will reply using the LLM with streaming edits.
- Prefix commands are supported (default prefix `!`) and full **slash** commands are available.

Key slash commands (examples):

- `/ping` — latency & system info
- `/memory view` — view your persona summary and basic info
- `/memory edit` — open modal to update profile fields
- `/memory reset` — reset your stored memory
- `/export-memory` — download your memory JSON
- `/jvc` — Joins the current voice channel of the user uses speech to text and vice versa to talk to the user.
- `/blacklist` — admin blacklist menu (owner-only)
- `/deploy` — (owner-only) register slash commands
- `/askmodel` — (owner-only) ad-hoc model prompt
- `/archive-logs` — (owner-only) run log archiving now
- `/health` — returns uptime & system info (ephemeral)
- `/say` — (owner-only) make the bot send a message (audit logged)

---

## Health & Logs

An **Express** health server exposes operational endpoints:

- `GET /health` — JSON health payload (uptime, node, memory, guild & user counts)
- `GET /` — simple HTML status page with links
- `GET /logs` — list log files (`?archive=1` to list archived logs)
- `GET /logs/:name` — view a log file; supports query params:
  - `?lines=N` to return the last N lines
  - `?download=1` to download the file

Logs are written to `logs/` (one file per day) and archived to `logs/archive/` by the log archiver.

> All log operations are recorded via the built-in `logEvent` utility.

---

## Configuration

Runtime tunables are in `src/config/john.json` (some important keys):

- `personality` — persona prompt for the LLM
- `LLM_ENDPOINT`, `LLM_MODEL` — model selection
- `MEMORY_CONFIDENCE_THRESHOLD` — threshold for storing extracted facts
- `MAX_MESSAGE_HISTORY` — messages fetched for context
- `MAX_RESPONSE_LENGTH`, `EDIT_THROTTLE_MS` — streaming behavior
- `SUMMARIZE_PERSONA_INTERVAL` — how often persona summarization runs (interactions)
- `thinkingReply`, `errorReply`, `blacklistReply` — canned replies

You can override settings with environment variables where applicable.

---

## Memory & Privacy

- Per-user memory is saved in `memory.json`. The extraction logic only stores **explicit** long-term facts and avoids sensitive categories by design.
- Commands to manage data:
  - `/memory reset` or profile reset button — delete your memory entry
  - Admins can manage blacklist via `/blacklist` and component modals

**Note:** If you need GDPR/retention guarantees, manage `memory.json` and `logs/` as part of your deployment process.

---

## Project layout

- `start.js` — app entrypoint
- `src/commands/` — slash & prefix command modules
- `src/events/` — Discord event handlers (`ready`, `messageCreate`, `interactionCreate`)
- `src/handlers/` — logic for commands, slash registration, mentions, components
- `src/utils/` — `logger.js`, `llm.js`, `memory.js`, `image.js`, `text.js`, `logArchive.js`, `healthServer.js`
- `scripts/` — convenience scripts (backup/clear commands, etc.)

---

## Logging & Monitoring

- Use `logs/` to review activity (one file per day). Key event types are logged (e.g., `INIT`, `ERROR`, `LLM-STREAM-START`, `MEMORY-EXTRACT-NEW`, `ADMIN`, etc.).
- The `logArchive` utility gzips old logs to `logs/archive/` on a schedule. You can manually trigger via `/archive-logs`.
