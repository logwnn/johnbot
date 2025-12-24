# John Bot

Discord bot that uses LLM to respond to messages when pinged

---

## Requirements

- Node.js >= 16.9 (Node 18+ recommended)
- Discord bot token
- HuggingFace token
### Optional:
- ClientID from ur bot
- GuildID from ur Discord server

---

## How to use

1. Create a `.env` file in the repo root with the following variables:

```env
DISCORD_TOKEN=your_discord_token_here
HF_TOKEN=your_hf_token_here
CLIENT_ID=your_discord_app_id # optional, used by scripts/clear-commands.js
GUILD_ID=optional_guild_id    # optional, used by scripts/clear-commands.js
```

---

##  Features

- Personified chat behavior with a configurable personality
- Long-term per-user memory stored in `memory.json` (auto-saved).
- Make the bot ignore ppl using slash commands. Stored in `blacklist.json`.
- Slash commands: `/ping`, `/profile`, `/profileexport`, `/blacklist`.
- Logs written to the `logs/` directory.
- Optional image analysis (disabled by default, might not work properly).
- Ease-of-life tools for managing the bot in `scripts/`.

---

## Usage
- First install requirments with `npm install` then run with `node index.js` or `node .`
- Mention the bot or use any of the slash commands. Mentions also work in direct-messages.
- Slash commands:
  - `/ping` — latency & uptime
  - `/profile` — view/edit/reset your saved profile (modal-based)
  - `/profileexport` — download your profile JSON (private)
  - `/blacklist` — admin menu to manage the blacklist

Interactive behavior:

- The bot extracts _long-term facts_ from user messages and stores only explicit, non-sensitive items in `memory.json`.
- The persona and LLM settings are defined in `index.js` (see constants at top of file).

---

## Data & Privacy

- Long-term facts are stored in `memory.json` (human‑readable JSON). To reset a user's profile you can use `/profile reset` or delete the entry from `memory.json` (requires a restart).
- Blacklisted user IDs are saved in `blacklist.json`.
- Logs are stored in `logs/` (one file per day).

---

## Development & Scripts

- `scripts/clear-commands.js` helps list/clear application commands (see top of the script for usage). It uses `DISCORD_TOKEN`, `CLIENT_ID`, and optionally `GUILD_ID`.
- To change the LLM model or endpoint, edit the `LLM_MODEL` and `LLM_ENDPOINT` constants at the top of `index.js`.
- `analyzeImage()` is present but returns null `null` cus it doesnt work properly
