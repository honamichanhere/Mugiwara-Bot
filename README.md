# Mugiwara Discord

Everything for the Mugiwara HUB Discord server and its bot.

| Folder | What it is |
|---|---|
| `DiscordBot/` | **Mugiwara Bot**, the Windows desktop app that runs and controls the bot (source code). See its own README. |
| `mugiwara-discord/` | Server tools: `setup.js` builds the server layout (roles, categories, channels, Community mode), `panel.js` is a small local page for sending embeds. |
| `Installer/` | Built installers (`Setup`, `portable`, `latest.yml`). Created by `npm run dist` in `DiscordBot/`. Not committed to git. |

## Quick start

**Use the app:** open `Installer/Mugiwara-Bot-Setup-<version>.exe`, install it, and paste the bot token.

**Build the app:**

```bash
cd DiscordBot
npm install
node node_modules/electron/install.js
npm run dist
```

The installer is written to `Installer/`.

**Server tools:**

```bash
cd mugiwara-discord
npm install
```

Copy `.env.example` to `.env`, fill in `DISCORD_TOKEN` and `GUILD_ID`, then run `npm run setup` (build or sync the server layout) or `npm run panel` (embed sender).

## Secrets

The bot token lives only in a local `.env` (server tools) or in Windows secure storage (the app). `.env` files are git-ignored. If a token ever leaks, reset it in the Discord Developer Portal (Bot tab, Reset Token).
