"use strict";
// Update otomatis lewat GitHub Releases (electron-updater). Hanya aktif di versi yang di-install lewat Setup;
// versi portable dan mode development tidak bisa update sendiri.
const { app } = require("electron");

const CHECK_EVERY_MS = 4 * 60 * 60 * 1000;

function createUpdater({ send, log, beforeInstall }) {
    const supported = app.isPackaged && !process.env.PORTABLE_EXECUTABLE_FILE;
    const state = { state: supported ? "idle" : "unsupported", version: null, progress: 0, error: null, checkedAt: null };
    let autoUpdater = null;
    let timer = null;

    const publish = patch => { Object.assign(state, patch); send("app:update", { ...state }); };

    function init() {
        if (!supported || autoUpdater) return;
        autoUpdater = require("electron-updater").autoUpdater;
        autoUpdater.autoDownload = true;
        autoUpdater.autoInstallOnAppQuit = true;
        autoUpdater.logger = null;

        autoUpdater.on("checking-for-update", () => publish({ state: "checking", error: null }));
        autoUpdater.on("update-available", info => { log("info", `Update ${info.version} found, downloading...`); publish({ state: "downloading", version: info.version, progress: 0 }); });
        autoUpdater.on("update-not-available", () => publish({ state: "current", checkedAt: Date.now() }));
        autoUpdater.on("download-progress", p => publish({ state: "downloading", progress: Math.round(p.percent) }));
        autoUpdater.on("update-downloaded", info => { log("info", `Update ${info.version} is ready to install`); publish({ state: "ready", version: info.version, progress: 100 }); });
        autoUpdater.on("error", err => {
            // Rilis belum ada atau tidak ada internet: bukan masalah besar, cukup dicatat.
            log("warn", "Update check failed: " + (err && err.message ? err.message.split("\n")[0] : err));
            publish({ state: "error", error: err && err.message ? err.message.split("\n")[0] : String(err), checkedAt: Date.now() });
        });
    }

    async function check() {
        if (!supported) return state;
        init();
        if (state.state === "downloading" || state.state === "ready") return state;
        try { await autoUpdater.checkForUpdates(); } catch { /* sudah ditangani event error */ }
        return state;
    }

    function start(enabled) {
        if (!supported) return;
        clearInterval(timer);
        if (!enabled) return;
        setTimeout(check, 15000);
        timer = setInterval(check, CHECK_EVERY_MS);
    }

    function install() {
        if (!autoUpdater || state.state !== "ready") return false;
        beforeInstall();
        autoUpdater.quitAndInstall(true, true);
        return true;
    }

    return { state: () => ({ ...state }), check, start, install, supported };
}

module.exports = { createUpdater };
