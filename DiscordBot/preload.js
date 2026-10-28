"use strict";
const { contextBridge, ipcRenderer, webUtils } = require("electron");

const invoke = (channel, ...args) => ipcRenderer.invoke(channel, ...args);
const unwrap = r => {
    if (!r || r.ok === undefined) return r;
    if (!r.ok) throw new Error(r.error || "Something went wrong");
    return r.data;
};

const EVENTS = new Set(["bot:event", "bot:log", "bot:status", "win:state", "app:settings", "app:update"]);

contextBridge.exposeInMainWorld("api", {
    info: () => invoke("app:info"),
    connect: token => invoke("app:connect", token).then(unwrap),
    reconnect: () => invoke("app:reconnect").then(unwrap),
    importEnv: () => invoke("app:importEnv").then(unwrap),
    logout: () => invoke("app:logout"),
    disconnect: () => invoke("app:disconnect"),
    settings: patch => invoke("app:settings", patch),
    presence: p => invoke("app:presence", p),
    pickFiles: () => invoke("app:pickFiles"),
    pickImage: title => invoke("app:pickImage", title),
    checkUpdate: () => invoke("app:checkUpdate"),
    installUpdate: () => invoke("app:installUpdate"),
    fileInfo: p => invoke("app:fileInfo", p),
    pathForFile: file => webUtils.getPathForFile(file),
    openExternal: url => invoke("app:openExternal", url),
    copy: text => invoke("app:copy", text),
    quit: () => invoke("app:quit"),
    call: (method, ...args) => invoke("bot:call", method, ...args).then(unwrap),
    win: {
        minimize: () => invoke("win:minimize"),
        toggleMaximize: () => invoke("win:toggleMaximize"),
        toggleFullscreen: () => invoke("win:toggleFullscreen"),
        close: () => invoke("win:close"),
    },
    on: (channel, cb) => {
        if (!EVENTS.has(channel)) return;
        ipcRenderer.on(channel, (_e, payload) => cb(payload));
    },
});
