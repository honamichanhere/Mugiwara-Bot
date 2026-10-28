# Mugiwara Bot

Desktop app (Windows) for running and controlling the Mugiwara HUB Discord bot. It works like a normal Discord client, but you are signed in as the bot. While the app is open, the bot is online.

## Features

- **Hosting:** the bot stays online while the app runs. Closing the window hides it to the system tray (configurable). Optional start with Windows, minimized to the tray.
- **Server list and channels:** every server the bot is in, channels grouped by category, forum posts, active threads, unread and mention badges.
- **Messages:** live message feed, history loading, replies, edit and delete, reactions, pins, attachments, embeds, stickers, markdown, mentions and custom emoji.
- **Composer:** text, file attach (button or drag and drop), embed builder with live preview, emoji picker, `@` and `#` autocomplete, per-channel drafts.
- **Members:** member list grouped by role, profile, roles, nickname, timeout, kick, ban, direct message.
- **Channels and servers:** create, rename, edit topic, delete channels and categories; create forum posts; leave a server; copy invite link.
- **Dashboard:** servers, members reached, ping, uptime, presence (status and activity), activity log.
- **Window:** custom title bar, drag, resize, minimize, maximize, fullscreen (F11), zoom (Ctrl + / - / 0), quick switcher (Ctrl K).

## Setup

1. In the Discord Developer Portal, open your application, then **Bot**.
2. Turn on **Server Members Intent** and **Message Content Intent**. Without them the app still works, but cannot list members or read message text from other users.
3. Run the app and paste the bot token (or import it from a `.env` file containing `DISCORD_TOKEN=...`).

The token is encrypted with Windows secure storage (DPAPI) and stored in the app data folder. It is never written to the project folder.

## Run from source

```bash
npm install
```

The Electron download is blocked by npm's install-script protection on recent npm versions. Run this once after `npm install`:

```bash
node node_modules/electron/install.js
```

```bash
npm start
```

## Build the installer

```bash
npm run dist
```

Output goes to `../Installer/` (next to this folder): an installer (`Mugiwara-Bot-Setup-<version>.exe`), a portable build, and `latest.yml`. `Installer/` and `node_modules/` are git-ignored.

## Bot profile

Open **Settings → Edit bot profile** (or the status menu in the bottom-left corner, or the Dashboard). You can change the username, avatar, banner, app icon, description ("About me", 400 characters), and tags (up to 5). Username changes are limited by Discord to about 2 per hour. The install link and terms/privacy URLs are set in the Developer Portal.

## Auto-update

The installed version (from `Mugiwara-Bot-Setup-<version>.exe`) checks GitHub Releases on start and every 4 hours, downloads a newer version in the background, and shows an **Update ready, restart** button in the title bar. The portable build and `npm start` do not auto-update.

### Publishing an update

1. Raise `version` in `package.json` (for example `1.1.0` to `1.1.1`).
2. Run `npm run dist`.
3. On GitHub, create a **new Release** with the tag `v1.1.1` (not a draft, not a pre-release).
4. Upload these three files from `../Installer/`: `Mugiwara-Bot-Setup-1.1.1.exe`, `Mugiwara-Bot-Setup-1.1.1.exe.blockmap`, and `latest.yml`.

Installed apps pick it up on their next check. The updater always reads the **latest** release of the repository set in `package.json` (`build.publish`), so only publish bot releases there, or point `build.publish` at a dedicated repository.

## Project layout

| Path | Purpose |
|---|---|
| `main.js` | Electron main process: window, tray, IPC, settings |
| `preload.js` | Safe bridge between the UI and the main process |
| `src/bot.js` | All Discord logic (discord.js) |
| `src/store.js` | Settings and encrypted token storage |
| `src/updater.js` | Auto-update through GitHub Releases |
| `renderer/` | The UI (`app.js`, `ui.js`, `util.js`, `styles.css`) |
| `scripts/make-icon.js` | Generates `assets/icon.png` |
