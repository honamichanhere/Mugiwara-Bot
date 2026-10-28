"use strict";
// Settings disimpan sebagai JSON di folder data aplikasi. Token bot dienkripsi dengan Windows DPAPI
// (Electron safeStorage), jadi tidak pernah tersimpan sebagai teks biasa.
const { app, safeStorage } = require("electron");
const fs = require("fs");
const path = require("path");

const settingsFile = () => path.join(app.getPath("userData"), "settings.json");
const tokenFile = () => path.join(app.getPath("userData"), "token.bin");

const DEFAULTS = {
    closeToTray: true,
    startWithWindows: false,
    autoConnect: true,
    autoUpdate: true,
    accent: "#ff9132",
    compact: false,
    zoom: 1,
    presence: { status: "online", activityType: "Playing", activityText: "Mugiwara HUB" },
    bounds: null,
    maximized: false,
    last: { guildId: null, channelId: null },
};

function loadSettings() {
    try {
        return { ...DEFAULTS, ...JSON.parse(fs.readFileSync(settingsFile(), "utf8")) };
    } catch {
        return { ...DEFAULTS };
    }
}

function saveSettings(settings) {
    fs.mkdirSync(path.dirname(settingsFile()), { recursive: true });
    fs.writeFileSync(settingsFile(), JSON.stringify(settings, null, 2));
}

function saveToken(token) {
    if (!safeStorage.isEncryptionAvailable()) throw new Error("Secure storage is not available on this system");
    fs.mkdirSync(path.dirname(tokenFile()), { recursive: true });
    fs.writeFileSync(tokenFile(), safeStorage.encryptString(token));
}

function loadToken() {
    try {
        return safeStorage.decryptString(fs.readFileSync(tokenFile()));
    } catch {
        return null;
    }
}

function clearToken() {
    try { fs.unlinkSync(tokenFile()); } catch { /* sudah tidak ada */ }
}

module.exports = { DEFAULTS, loadSettings, saveSettings, saveToken, loadToken, clearToken };
