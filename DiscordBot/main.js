"use strict";
const { app, BrowserWindow, Tray, Menu, ipcMain, dialog, shell, clipboard, nativeImage, screen } = require("electron");
const path = require("path");
const fs = require("fs");
const store = require("./src/store");
const { Bot } = require("./src/bot");
const { createUpdater } = require("./src/updater");

const START_HIDDEN = process.argv.includes("--hidden");
const ICON = path.join(__dirname, "assets", "icon.png");

// Hanya method ini yang boleh dipanggil dari renderer.
const BOT_METHODS = new Set([
    "getGuilds", "getChannels", "getMessages", "getPins", "getForumPosts", "getMembers", "getRoles", "getEmojis", "getStats",
    "send", "editMessage", "deleteMessage", "react", "pin", "createForumPost", "sendDM",
    "kick", "ban", "timeout", "setNickname", "setMemberRoles",
    "createChannel", "editChannel", "deleteChannel", "leaveGuild",
    "getProfile", "setUsername", "setAvatar", "setBanner", "editApplication",
]);

const SETTING_KEYS = new Set(["closeToTray", "startWithWindows", "autoConnect", "autoUpdate", "accent", "compact", "zoom", "last"]);
const IMAGE_LIMIT = 8 * 1024 * 1024;
const MIME = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif", ".webp": "image/webp" };
const bot = new Bot();
let settings;
let win = null;
let tray = null;
let updater = null;

function send(channel, payload) {
    if (win && !win.isDestroyed()) win.webContents.send(channel, payload);
}

function visibleBounds(b) {
    if (!b) return null;
    const ok = screen.getAllDisplays().some(d => {
        const a = d.workArea;
        return b.x < a.x + a.width && b.x + b.width > a.x && b.y < a.y + a.height && b.y + b.height > a.y;
    });
    return ok ? b : { width: b.width, height: b.height };
}

function winState() {
    return { maximized: win.isMaximized(), fullscreen: win.isFullScreen() };
}

function toggleFullscreen() {
    if (win) win.setFullScreen(!win.isFullScreen());
}

function applyZoom(delta) {
    if (!win) return;
    const next = delta === 0 ? 1 : Math.min(2, Math.max(0.6, +(win.webContents.getZoomFactor() + delta).toFixed(2)));
    win.webContents.setZoomFactor(next);
    settings.zoom = next;
    store.saveSettings(settings);
}

function createWindow() {
    const b = visibleBounds(settings.bounds);
    win = new BrowserWindow({
        width: (b && b.width) || 1320, height: (b && b.height) || 820, x: b && b.x, y: b && b.y,
        minWidth: 940, minHeight: 600, frame: false, show: false, backgroundColor: "#140b05",
        icon: ICON, title: "Mugiwara Bot",
        webPreferences: { preload: path.join(__dirname, "preload.js"), contextIsolation: true, nodeIntegration: false, sandbox: true, spellcheck: false },
    });

    win.loadFile(path.join(__dirname, "renderer", "index.html"));
    win.webContents.on("did-finish-load", () => win.webContents.setZoomFactor(settings.zoom || 1));
    win.once("ready-to-show", () => {
        if (settings.maximized) win.maximize();
        if (!START_HIDDEN) win.show();
    });

    let saveTimer = null;
    const saveBounds = () => {
        clearTimeout(saveTimer);
        saveTimer = setTimeout(() => {
            if (!win || win.isDestroyed()) return;
            settings.maximized = win.isMaximized();
            if (!win.isMaximized() && !win.isFullScreen() && !win.isMinimized()) settings.bounds = win.getBounds();
            store.saveSettings(settings);
        }, 400);
    };
    win.on("resize", saveBounds);
    win.on("move", saveBounds);
    for (const ev of ["maximize", "unmaximize", "enter-full-screen", "leave-full-screen"]) {
        win.on(ev, () => { send("win:state", winState()); saveBounds(); });
    }

    win.on("close", e => {
        if (!app.isQuitting && settings.closeToTray) {
            e.preventDefault();
            win.hide();
            return;
        }
        app.isQuitting = true;
    });

    win.webContents.setWindowOpenHandler(({ url }) => {
        if (/^https?:\/\//i.test(url)) shell.openExternal(url);
        return { action: "deny" };
    });
    win.webContents.on("will-navigate", e => e.preventDefault());

    win.webContents.on("before-input-event", (e, input) => {
        if (input.type !== "keyDown") return;
        const ctrl = input.control || input.meta;
        const key = String(input.key).toLowerCase();
        if (key === "f11") { toggleFullscreen(); e.preventDefault(); }
        else if (ctrl && (key === "=" || key === "+")) { applyZoom(0.1); e.preventDefault(); }
        else if (ctrl && key === "-") { applyZoom(-0.1); e.preventDefault(); }
        else if (ctrl && key === "0") { applyZoom(0); e.preventDefault(); }
        else if (!app.isPackaged && (key === "f12" || (ctrl && input.shift && key === "i"))) win.webContents.toggleDevTools();
    });

    win.webContents.on("context-menu", (_e, params) => {
        if (params.isEditable) {
            Menu.buildFromTemplate([{ role: "undo" }, { role: "redo" }, { type: "separator" }, { role: "cut" }, { role: "copy" }, { role: "paste" }, { role: "selectAll" }]).popup();
        } else if (params.selectionText) {
            Menu.buildFromTemplate([{ role: "copy" }]).popup();
        }
    });
}

function showWindow() {
    if (!win) return;
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
}

function statusLabel(st) {
    if (st.state === "online" && st.user) return `Online as ${st.user.tag}`;
    if (st.state === "connecting") return "Connecting...";
    if (st.state === "error") return "Connection error";
    return "Offline";
}

function updateTray() {
    if (!tray) return;
    const st = bot.status();
    tray.setToolTip(`Mugiwara Bot - ${statusLabel(st)}`);
    const presence = settings.presence || {};
    tray.setContextMenu(Menu.buildFromTemplate([
        { label: statusLabel(st), enabled: false },
        { type: "separator" },
        { label: win && win.isVisible() ? "Hide window" : "Show window", click: () => (win && win.isVisible() ? win.hide() : showWindow()) },
        {
            label: "Status", enabled: st.state === "online",
            submenu: ["online", "idle", "dnd", "invisible"].map(s => ({
                label: s === "dnd" ? "Do Not Disturb" : s[0].toUpperCase() + s.slice(1), type: "radio", checked: presence.status === s,
                click: () => setPresence({ ...presence, status: s }),
            })),
        },
        { label: "Close button hides to tray", type: "checkbox", checked: !!settings.closeToTray, click: m => updateSettings({ closeToTray: m.checked }) },
        { label: "Start with Windows", type: "checkbox", checked: !!settings.startWithWindows, click: m => updateSettings({ startWithWindows: m.checked }) },
        { type: "separator" },
        { label: "Quit and take the bot offline", click: () => { app.isQuitting = true; app.quit(); } },
    ]));
}

function createTray() {
    const icon = nativeImage.createFromPath(ICON).resize({ width: 16, height: 16 });
    tray = new Tray(icon);
    tray.on("click", () => (win && win.isVisible() && win.isFocused() ? win.hide() : showWindow()));
    updateTray();
}

function setPresence(presence) {
    settings.presence = presence;
    store.saveSettings(settings);
    bot.setPresence(presence);
    updateTray();
    return settings.presence;
}

function updateSettings(patch) {
    for (const [k, v] of Object.entries(patch)) if (SETTING_KEYS.has(k)) settings[k] = v;
    if ("startWithWindows" in patch && app.isPackaged) {
        app.setLoginItemSettings({ openAtLogin: !!settings.startWithWindows, args: ["--hidden"] });
    }
    if ("autoUpdate" in patch && updater) updater.start(!!settings.autoUpdate);
    store.saveSettings(settings);
    updateTray();
    send("app:settings", settings);
    return settings;
}

async function connectWith(token) {
    token = String(token || "").trim().replace(/^["']|["']$/g, "");
    if (!/^[\w-]{20,}\.[\w-]{5,}\.[\w-]{20,}$/.test(token)) throw new Error("That does not look like a bot token");
    const status = await bot.connect(token, settings.presence);
    store.saveToken(token);
    return status;
}

function registerIpc() {
    ipcMain.handle("app:info", () => ({
        version: app.getVersion(), hasToken: !!store.loadToken(), settings, status: bot.status(), logs: bot.logs.slice(-200),
        packaged: app.isPackaged, window: win ? winState() : { maximized: false, fullscreen: false },
        update: updater ? updater.state() : null, canUpdate: updater ? updater.supported : false,
    }));

    ipcMain.handle("app:checkUpdate", () => updater.check());
    ipcMain.handle("app:installUpdate", () => updater.install());

    ipcMain.handle("app:pickImage", async (_e, title) => {
        const res = await dialog.showOpenDialog(win, {
            title: title || "Choose an image", properties: ["openFile"],
            filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "gif", "webp"] }],
        });
        if (res.canceled || !res.filePaths[0]) return null;
        const file = res.filePaths[0];
        const mime = MIME[path.extname(file).toLowerCase()];
        const size = fs.statSync(file).size;
        if (!mime) throw new Error("Unsupported image type");
        if (size > IMAGE_LIMIT) throw new Error("The image is larger than 8 MB");
        return { name: path.basename(file), size, dataUrl: `data:${mime};base64,${fs.readFileSync(file).toString("base64")}` };
    });

    ipcMain.handle("app:connect", (_e, token) => connectWith(token).then(r => ({ ok: true, data: r }), err => ({ ok: false, error: err.message })));

    ipcMain.handle("app:reconnect", () => {
        const token = store.loadToken();
        if (!token) return { ok: false, error: "No saved token" };
        return bot.connect(token, settings.presence).then(r => ({ ok: true, data: r }), err => ({ ok: false, error: err.message }));
    });

    ipcMain.handle("app:importEnv", async () => {
        const res = await dialog.showOpenDialog(win, { title: "Choose your .env file", properties: ["openFile"], filters: [{ name: "Env / text", extensions: ["env", "txt", "*"] }] });
        if (res.canceled || !res.filePaths[0]) return { ok: false, error: "Cancelled" };
        try {
            const text = fs.readFileSync(res.filePaths[0], "utf8");
            const m = text.match(/^\s*DISCORD_TOKEN\s*=\s*(.+?)\s*$/m);
            if (!m) throw new Error("DISCORD_TOKEN was not found in that file");
            return { ok: true, data: await connectWith(m[1]) };
        } catch (err) {
            return { ok: false, error: err.message };
        }
    });

    ipcMain.handle("app:logout", async () => {
        await bot.disconnect();
        store.clearToken();
        return true;
    });

    ipcMain.handle("app:disconnect", async () => { await bot.disconnect(); return true; });
    ipcMain.handle("app:settings", (_e, patch) => updateSettings(patch || {}));
    ipcMain.handle("app:presence", (_e, presence) => setPresence(presence));

    ipcMain.handle("app:pickFiles", async () => {
        const res = await dialog.showOpenDialog(win, { title: "Attach files", properties: ["openFile", "multiSelections"] });
        if (res.canceled) return [];
        return res.filePaths.slice(0, 10).map(p => ({ path: p, name: path.basename(p), size: fs.statSync(p).size }));
    });

    ipcMain.handle("app:fileInfo", (_e, p) => {
        const st = fs.statSync(p);
        if (!st.isFile()) throw new Error("Not a file");
        return { path: p, name: path.basename(p), size: st.size };
    });

    ipcMain.handle("app:openExternal", (_e, url) => {
        if (/^https?:\/\//i.test(String(url))) shell.openExternal(String(url));
    });
    ipcMain.handle("app:copy", (_e, text) => { clipboard.writeText(String(text)); return true; });

    ipcMain.handle("app:quit", () => { app.isQuitting = true; app.quit(); });

    ipcMain.handle("bot:call", async (_e, method, ...args) => {
        if (!BOT_METHODS.has(method)) return { ok: false, error: "Unknown method" };
        try {
            return { ok: true, data: await bot[method](...args) };
        } catch (err) {
            bot.log("error", `${method}: ${err.message}`);
            return { ok: false, error: err.message };
        }
    });

    ipcMain.handle("win:minimize", e => BrowserWindow.fromWebContents(e.sender).minimize());
    ipcMain.handle("win:toggleMaximize", e => {
        const w = BrowserWindow.fromWebContents(e.sender);
        if (w.isFullScreen()) w.setFullScreen(false);
        else if (w.isMaximized()) w.unmaximize(); else w.maximize();
    });
    ipcMain.handle("win:toggleFullscreen", () => toggleFullscreen());
    ipcMain.handle("win:close", e => BrowserWindow.fromWebContents(e.sender).close());
}

function start() {
    app.on("second-instance", showWindow);
    app.on("before-quit", () => { app.isQuitting = true; bot.disconnect(); });
    app.on("window-all-closed", () => { if (app.isQuitting || !tray) app.quit(); });

    app.whenReady().then(async () => {
        settings = store.loadSettings();
        Menu.setApplicationMenu(Menu.buildFromTemplate([{ role: "editMenu" }]));
        updater = createUpdater({
            send, log: (level, text) => bot.log(level, text),
            beforeInstall: () => { app.isQuitting = true; },
        });
        registerIpc();
        createWindow();
        createTray();
        updater.start(settings.autoUpdate !== false);

        bot.on("status", st => { send("bot:status", st); updateTray(); });
        bot.on("event", ev => send("bot:event", ev));
        bot.on("log", l => send("bot:log", l));
        setInterval(() => { if (bot.state === "online") send("bot:status", bot.status()); }, 10000);

        const token = store.loadToken();
        if (token && settings.autoConnect) {
            bot.connect(token, settings.presence).catch(err => bot.log("error", "Auto-connect failed: " + err.message));
        }
    });
}

if (!app.requestSingleInstanceLock()) {
    app.quit();
} else {
    start();
}
