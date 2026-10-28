"use strict";
// Logika utama renderer: state, navigasi, tampilan server/channel/pesan, composer, anggota, dan dashboard.
const S = {
    settings: {}, status: { state: "offline" }, me: null, packaged: false, version: "",
    guilds: [], channels: {}, guildId: null, channelId: null, view: "home", homeTab: "dashboard",
    messages: [], atStart: false, loadingOlder: false, members: {}, showMembers: true, memberFilter: "",
    unread: {}, mentions: {}, drafts: {}, replyTo: null, editing: null, files: [], embeds: [], allowPings: false,
    logs: [], stats: null, forumPosts: [], emojis: {}, win: { maximized: false, fullscreen: false },
    collapsed: new Set(), ready: false, update: null, canUpdate: false,
};
try { S.collapsed = new Set(JSON.parse(localStorage.getItem("collapsed") || "[]")); } catch { /* storage tidak tersedia */ }

const run = async (fn, okText) => {
    try { const r = await fn(); if (okText) toast(okText, "ok"); return r; } catch (err) { toast(err.message || String(err), "error"); return undefined; }
};
const guildOf = id => S.guilds.find(g => g.id === id);
const chanList = gid => S.channels[gid] || [];
const chanOf = id => { for (const gid in S.channels) { const c = S.channels[gid].find(x => x.id === id); if (c) return { c, gid }; } return null; };
const TEXTLIKE = new Set(["text", "announcement", "thread"]);

// ====================================================================== titlebar
function renderTitlebar() {
    const st = S.status || {};
    const dot = { online: "ok", connecting: "warn", error: "err", offline: "off" }[st.state] || "off";
    const label = st.state === "online" ? (st.ping > 0 ? `${st.ping} ms` : "Online") : st.state === "connecting" ? "Connecting" : st.state === "error" ? "Error" : "Offline";
    const g = guildOf(S.guildId), ch = chanOf(S.channelId);
    const crumb = !S.ready ? "" : S.view === "home" ? "Dashboard" : [g && g.name, ch && ch.c.name].filter(Boolean).join("  ›  ");
    $("#titlebar").innerHTML = `
        <div class="tb-left"><img src="../assets/icon.png" alt="" class="tb-logo"><span class="tb-title">Mugiwara Bot</span></div>
        <div class="tb-mid" data-dblclick="max">${U.esc(crumb)}</div>
        <div class="tb-right">
            ${updateChip()}
            <span class="pill"><i class="dot ${dot}"></i>${label}</span>
            <button class="tb-btn" data-act="quick" title="Quick switcher (Ctrl+K)">${icon("search", 15)}</button>
            <button class="tb-btn" data-act="win-full" title="Fullscreen (F11)">${icon("fullscreen", 15)}</button>
            <button class="tb-btn" data-act="win-min" title="Minimize">${icon("minus", 15)}</button>
            <button class="tb-btn" data-act="win-max" title="${S.win.maximized ? "Restore" : "Maximize"}">${icon(S.win.maximized ? "restore" : "square", 15)}</button>
            <button class="tb-btn close" data-act="win-close" title="Close">${icon("x", 15)}</button>
        </div>`;
}

function updateChip() {
    const u = S.update;
    if (!u) return "";
    if (u.state === "ready") return `<button class="update-chip ready" data-act="install-update" title="Restart and install">${icon("refresh", 13)} Update ${U.esc(u.version || "")} ready, restart</button>`;
    if (u.state === "downloading") return `<span class="update-chip">${icon("refresh", 13)} Updating ${u.progress || 0}%</span>`;
    return "";
}

function updateStatusText() {
    const u = S.update;
    if (!S.canUpdate) return S.packaged ? "Auto-update is not available in the portable version. Use the installed version to get updates." : "Auto-update only works in the installed app.";
    if (!u) return "";
    return {
        idle: "No check yet.", checking: "Checking for updates...", current: "You are on the latest version.",
        downloading: `Downloading version ${u.version || ""} (${u.progress || 0}%)...`, ready: `Version ${u.version} is ready. Restart to install.`,
        error: "Could not check for updates right now (no release published yet, or no internet).",
    }[u.state] || "";
}

// ====================================================================== layar awal
function renderLogin(error) {
    S.ready = false;
    $("#root").innerHTML = `
        <div class="center-screen"><div class="login-card">
            <img src="../assets/icon.png" alt="" class="login-logo">
            <h1>Mugiwara Bot</h1>
            <p class="muted-text">Control your Discord bot like a normal Discord client. While this app is open, the bot stays online.</p>
            <label class="lbl">Bot token</label>
            <div class="row-input"><input id="token" type="password" placeholder="Paste your bot token" autocomplete="off" spellcheck="false">
            <button class="btn ghost" data-act="token-eye" type="button">Show</button></div>
            ${error ? `<div class="form-error">${U.esc(error)}</div>` : ""}
            <div class="bar"><button class="btn primary" data-act="login" id="login-btn">Connect</button>
            <button class="btn ghost" data-act="import-env">Import from .env</button></div>
            <details class="help"><summary>Where do I find the token?</summary>
                <ol><li>Open the Discord Developer Portal and select your application.</li>
                <li>Go to <b>Bot</b> and press <b>Reset Token</b>.</li>
                <li>Turn on <b>Server Members Intent</b> and <b>Message Content Intent</b> to see members and message text.</li></ol>
                <p class="muted-text">The token is encrypted with Windows secure storage and never leaves this computer.</p></details>
        </div></div>`;
    renderTitlebar();
    const t = $("#token");
    if (t) t.addEventListener("keydown", e => { if (e.key === "Enter") doLogin(); });
}

function renderOffline() {
    S.ready = false;
    const st = S.status;
    $("#root").innerHTML = `
        <div class="center-screen"><div class="login-card">
            <div class="big-ic">${icon(st.state === "connecting" ? "refresh" : "power", 40)}</div>
            <h1>${st.state === "connecting" ? "Connecting..." : st.state === "error" ? "Connection failed" : "Bot is offline"}</h1>
            ${st.error ? `<div class="form-error">${U.esc(st.error)}</div>` : '<p class="muted-text">The bot is not connected to Discord.</p>'}
            <div class="bar"><button class="btn primary" data-act="reconnect" ${st.state === "connecting" ? "disabled" : ""}>Reconnect</button>
            <button class="btn ghost" data-act="change-token">Change token</button></div>
        </div></div>`;
    renderTitlebar();
}

async function doLogin() {
    const token = $("#token").value.trim();
    if (!token) return;
    const btn = $("#login-btn");
    btn.disabled = true; btn.textContent = "Connecting...";
    try { await api.connect(token); } catch (err) { renderLogin(err.message); }
}

// ====================================================================== shell
function renderShell() {
    $("#root").innerHTML = `
        <div id="shell">
            <nav id="rail"></nav>
            <aside id="sidebar"></aside>
            <main id="main"></main>
            <aside id="members"></aside>
        </div>`;
}

async function onReady() {
    S.me = S.status.user;
    S.ready = true;
    renderShell();
    S.guilds = await api.call("getGuilds");
    await Promise.all(S.guilds.map(g => loadChannels(g.id, false)));
    renderRail();
    const last = S.settings.last || {};
    if (last.guildId && guildOf(last.guildId)) await go({ guildId: last.guildId, channelId: last.channelId });
    else await go({});
}

async function loadChannels(gid, rerender = true) {
    try { S.channels[gid] = await api.call("getChannels", gid); } catch (err) { S.channels[gid] = S.channels[gid] || []; toast(err.message, "error"); }
    if (rerender && gid === S.guildId) renderSidebar();
}

// ====================================================================== navigasi
async function go({ guildId = null, channelId = null }) {
    S.guildId = guildId;
    S.replyTo = null; S.editing = null;
    if (!guildId) {
        S.view = "home"; S.channelId = null;
        renderAll();
        loadStats();
        return;
    }
    if (!S.channels[guildId]) await loadChannels(guildId, false);
    const list = chanList(guildId);
    let c = channelId && list.find(x => x.id === channelId);
    if (!c) c = list.filter(x => ["text", "announcement", "forum"].includes(x.kind)).sort(byOrder)[0];
    if (!c) { S.view = "empty"; S.channelId = null; renderAll(); return; }
    await openChannel(c.id);
}

const byOrder = (a, b) => a.position - b.position;

async function openChannel(id) {
    const found = chanOf(id);
    if (!found) return;
    const { c, gid } = found;
    if (!["text", "announcement", "forum", "thread"].includes(c.kind)) { toast("Voice channels can't be opened here", "info"); return; }
    saveDraft();
    S.guildId = gid; S.channelId = id;
    S.replyTo = null; S.editing = null; S.files = []; S.embeds = [];
    delete S.unread[id]; delete S.mentions[id];
    S.settings.last = { guildId: gid, channelId: id };
    api.settings({ last: S.settings.last });
    S.view = c.kind === "forum" ? "forum" : "channel";
    S.messages = []; S.atStart = false;
    renderAll();
    if (S.view === "forum") await loadForum();
    else {
        await loadMessages();
        ensureMembers(gid);
        ensureEmojis(gid);
    }
}

function renderAll() {
    renderTitlebar(); renderRail(); renderSidebar(); renderMain(); renderMembers();
}

// ====================================================================== rail
function guildBadge(g) {
    const ids = chanList(g.id).map(c => c.id);
    const mentions = ids.reduce((n, id) => n + (S.mentions[id] || 0), 0);
    const unread = ids.some(id => S.unread[id]);
    return { mentions, unread };
}

function renderRail() {
    const rail = $("#rail");
    if (!rail) return;
    rail.innerHTML = `
        <button class="rail-item home ${S.view === "home" ? "active" : ""}" data-act="nav-home" title="Dashboard">${icon("bot", 24)}</button>
        <div class="rail-sep"></div>
        ${S.guilds.map(g => {
            const b = guildBadge(g);
            return `<button class="rail-item ${g.id === S.guildId ? "active" : ""} ${b.unread ? "unread" : ""}" data-act="nav-guild" data-id="${g.id}" data-ctx="guild" title="${U.esc(g.name)}">
                ${g.icon ? `<img src="${U.esc(g.icon)}" alt="">` : `<span>${U.esc(U.initials(g.name))}</span>`}
                ${b.mentions ? `<i class="badge">${b.mentions > 9 ? "9+" : b.mentions}</i>` : ""}</button>`;
        }).join("")}
        <div class="rail-spacer"></div>
        <button class="rail-item small" data-act="invite" title="Add the bot to another server">${icon("plus", 20)}</button>
        <button class="rail-item small" data-act="settings" title="Settings">${icon("settings", 20)}</button>`;
}

// ====================================================================== sidebar
function userPanel() {
    const me = S.me || {};
    const p = S.settings.presence || {};
    const dot = { online: "ok", idle: "warn", dnd: "err", invisible: "off" }[p.status] || "ok";
    return `<div class="user-panel">
        <button class="up-user" data-act="status-menu"><span class="av-wrap"><img class="av" src="${U.esc(me.avatar || "")}" alt=""><i class="dot ${dot} corner"></i></span>
            <span class="up-text"><b>${U.esc(me.displayName || "Bot")}</b><small>${U.esc(p.activityText ? `${p.activityType === "Custom" ? "" : (p.activityType || "") + " "}${p.activityText}` : (p.status || "online"))}</small></span></button>
        <button class="icon-btn" data-act="disconnect" title="Disconnect the bot">${icon("power", 17)}</button>
        <button class="icon-btn" data-act="settings" title="Settings">${icon("settings", 17)}</button>
    </div>`;
}

function renderSidebar() {
    const sb = $("#sidebar");
    if (!sb) return;
    if (S.view === "home") {
        const tabs = [["dashboard", "home", "Dashboard"], ["servers", "server", "Servers"], ["activity", "activity", "Activity log"]];
        sb.innerHTML = `<div class="sb-head"><b>Mugiwara Bot</b></div>
            <div class="sb-scroll">${tabs.map(([id, ic, label]) => `<button class="ch-item ${S.homeTab === id ? "active" : ""}" data-act="home-tab" data-id="${id}">${icon(ic, 17)}<span>${label}</span></button>`).join("")}</div>
            ${userPanel()}`;
        return;
    }
    const g = guildOf(S.guildId);
    const list = chanList(S.guildId);
    const cats = list.filter(c => c.kind === "category").sort(byOrder);
    const childOf = pid => list.filter(c => c.parentId === pid && c.kind !== "category" && c.kind !== "thread")
        .sort((a, b) => ((["voice", "stage"].includes(a.kind) ? 1 : 0) - (["voice", "stage"].includes(b.kind) ? 1 : 0)) || byOrder(a, b));
    const threads = pid => list.filter(c => c.kind === "thread" && c.parentId === pid);
    const item = c => {
        const un = S.unread[c.id], men = S.mentions[c.id];
        const t = threads(c.id).map(th => `<button class="ch-item thread ${th.id === S.channelId ? "active" : ""}" data-act="nav-channel" data-id="${th.id}" data-ctx="channel">${icon("thread", 15)}<span>${U.esc(th.name)}</span></button>`).join("");
        return `<button class="ch-item ${c.id === S.channelId ? "active" : ""} ${un ? "unread" : ""}" data-act="nav-channel" data-id="${c.id}" data-ctx="channel">
            ${icon(U.kindIcon(c.kind), 17)}<span>${U.esc(c.name)}</span>${men ? `<i class="badge">${men}</i>` : ""}</button>${t}`;
    };
    const loose = childOf(null);
    sb.innerHTML = `
        <button class="sb-head" data-act="guild-menu"><b>${U.esc(g ? g.name : "")}</b>${icon("chevronDown", 16)}</button>
        <div class="sb-scroll">
            ${loose.map(item).join("")}
            ${cats.map(cat => {
                const open = !S.collapsed.has(cat.id);
                const kids = childOf(cat.id);
                return `<div class="cat"><button class="cat-head" data-act="toggle-cat" data-id="${cat.id}" data-ctx="category">${icon(open ? "chevronDown" : "chevronRight", 12)}<span>${U.esc(cat.name)}</span>
                    <span class="cat-add" data-act="create-channel" data-parent="${cat.id}" title="Create channel">${icon("plus", 14)}</span></button>
                    ${open ? kids.map(item).join("") : kids.filter(k => k.id === S.channelId || S.unread[k.id]).map(item).join("")}</div>`;
            }).join("")}
        </div>
        ${userPanel()}`;
}

// ====================================================================== main
function renderMain() {
    const main = $("#main");
    if (!main) return;
    if (S.view === "home") return renderHome();
    if (S.view === "empty") { main.innerHTML = '<div class="empty-state">This server has no text channels the bot can open.</div>'; return; }
    if (S.view === "forum") return renderForum();
    buildChannelView();
}

// ---------------------------------------------------------------------- home
async function loadStats() {
    try { S.stats = await api.call("getStats"); if (S.view === "home") renderHome(); } catch { /* offline */ }
}

function renderHome() {
    const main = $("#main");
    const logRow = l => `<div class="log ${l.level}"><span class="lt">${U.time(l.time)}</span><span class="ll">${l.level}</span><span class="lm">${U.esc(l.text)}</span></div>`;
    const st = S.stats;
    const p = S.settings.presence || {};
    let body = "";
    if (S.homeTab === "dashboard") {
        body = `
        <div class="cards">
            <div class="card stat"><small>Servers</small><b>${st ? st.guilds : S.guilds.length}</b></div>
            <div class="card stat"><small>Members reached</small><b>${st ? st.users : "-"}</b></div>
            <div class="card stat"><small>Ping</small><b>${S.status.ping > 0 ? S.status.ping + " ms" : "-"}</b></div>
            <div class="card stat"><small>Uptime</small><b id="uptime">${S.status.startedAt ? U.duration(Date.now() - S.status.startedAt) : "-"}</b></div>
        </div>
        <div class="grid2">
            <div class="card"><h3>Presence</h3>
                <label class="lbl">Status</label>
                <select id="pr-status">${[["online", "Online"], ["idle", "Idle"], ["dnd", "Do Not Disturb"], ["invisible", "Invisible"]].map(([v, l]) => `<option value="${v}" ${p.status === v ? "selected" : ""}>${l}</option>`).join("")}</select>
                <div class="row2"><div><label class="lbl">Activity</label>
                    <select id="pr-type">${["", "Playing", "Watching", "Listening", "Competing", "Custom"].map(v => `<option value="${v}" ${(p.activityType || "") === v ? "selected" : ""}>${v || "None"}</option>`).join("")}</select></div>
                <div><label class="lbl">Text</label><input id="pr-text" value="${U.esc(p.activityText || "")}" maxlength="128"></div></div>
                <div class="bar"><button class="btn primary" data-act="apply-presence">Apply</button><button class="btn" data-act="edit-profile">Edit bot profile</button></div>
            </div>
            <div class="card"><h3>Hosting</h3>
                <p class="muted-text">The bot is online for as long as this app is running. Closing the window ${S.settings.closeToTray ? "<b>hides it to the system tray</b> and the bot keeps running." : "quits the app and the bot goes offline."}</p>
                <div class="bar"><button class="btn" data-act="settings">Open settings</button><button class="btn ghost" data-act="invite">Invite link</button></div>
            </div>
        </div>
        <div class="card"><h3>Recent activity</h3><div class="logs">${S.logs.slice(-8).reverse().map(logRow).join("") || '<div class="muted-text">Nothing yet</div>'}</div></div>`;
    } else if (S.homeTab === "servers") {
        body = `<div class="cards servers">${S.guilds.map(g => `
            <div class="card server" data-ctx="guild" data-id="${g.id}">
                <div class="srv-ic">${g.icon ? `<img src="${U.esc(g.icon)}" alt="">` : `<span>${U.esc(U.initials(g.name))}</span>`}</div>
                <div class="srv-info"><b>${U.esc(g.name)}</b><small>${g.memberCount ?? "?"} members • ${chanList(g.id).filter(c => c.kind !== "category").length} channels</small></div>
                <div class="bar"><button class="btn small primary" data-act="nav-guild" data-id="${g.id}">Open</button><button class="btn small danger" data-act="leave-guild" data-id="${g.id}">Leave</button></div>
            </div>`).join("") || '<div class="muted-text">The bot is not in any server yet.</div>'}</div>`;
    } else {
        body = `<div class="card"><h3>Activity log</h3><div class="logs full" id="logs">${S.logs.slice().reverse().map(logRow).join("") || '<div class="muted-text">Nothing yet</div>'}</div></div>`;
    }
    main.innerHTML = `<div class="page"><div class="page-head"><h2>${{ dashboard: "Dashboard", servers: "Servers", activity: "Activity log" }[S.homeTab]}</h2></div>${body}</div>`;
}

// ---------------------------------------------------------------------- forum
async function loadForum() {
    $("#main").innerHTML = '<div class="empty-state">Loading posts...</div>';
    try { S.forumPosts = await api.call("getForumPosts", S.channelId); } catch (err) { S.forumPosts = []; toast(err.message, "error"); }
    renderForum();
}

function renderForum() {
    const found = chanOf(S.channelId);
    const c = found && found.c;
    $("#main").innerHTML = `
        <div class="ch-head"><span class="ch-title">${icon("forum", 20)}<b>${U.esc(c ? c.name : "")}</b></span><span class="ch-topic">${U.esc(c ? c.topic : "")}</span>
            <span class="spacer"></span><button class="btn small primary" data-act="new-post">${icon("plus", 14)} New post</button>
            <button class="icon-btn" data-act="refresh" title="Refresh">${icon("refresh", 17)}</button></div>
        <div class="forum-list">${S.forumPosts.map(p => `
            <button class="post-card" data-act="nav-channel" data-id="${p.id}">
                <div class="post-title">${p.pinned ? icon("pin", 14) : ""}${U.esc(p.name)}</div>
                <div class="post-meta">${p.tags.map(t => `<span class="tag">${U.esc(t)}</span>`).join("")}
                    <span>${p.messageCount ?? 0} message(s)</span><span>${p.createdTimestamp ? U.ago(p.createdTimestamp) : ""}</span>
                    ${p.archived ? '<span class="tag dim">Closed</span>' : ""}${p.locked ? `<span class="tag dim">${icon("lock", 11)} Locked</span>` : ""}</div>
            </button>`).join("") || '<div class="empty-state">No posts yet</div>'}</div>`;
}

// ---------------------------------------------------------------------- channel
function buildChannelView() {
    const found = chanOf(S.channelId);
    const c = found && found.c;
    const parent = c && c.kind === "thread" ? chanOf(c.parentId) : null;
    $("#main").innerHTML = `
        <div class="ch-head">
            ${parent ? `<button class="icon-btn" data-act="nav-channel" data-id="${parent.c.id}" title="Back to ${U.esc(parent.c.name)}">${icon("chevronRight", 17).replace("<svg", '<svg style="transform:rotate(180deg)"')}</button>` : ""}
            <span class="ch-title">${icon(U.kindIcon(c ? c.kind : "text"), 20)}<b>${U.esc(c ? c.name : "")}</b></span>
            <span class="ch-topic">${U.esc(c ? c.topic : "")}</span><span class="spacer"></span>
            <button class="icon-btn" data-act="pins" title="Pinned messages">${icon("pin", 18)}</button>
            <button class="icon-btn" data-act="refresh" title="Refresh">${icon("refresh", 18)}</button>
            ${S.guildId ? `<button class="icon-btn ${S.showMembers ? "on" : ""}" data-act="toggle-members" title="Member list">${icon("users", 18)}</button>` : ""}
        </div>
        <div class="msgs-wrap"><div id="msgs" class="msgs"></div><button id="jump" class="jump hidden" data-act="jump-bottom">New messages ${icon("chevronDown", 14)}</button></div>
        <div class="composer-wrap">
            <div id="ac" class="ac hidden"></div>
            <div id="banner" class="banner hidden"></div>
            <div id="attach" class="attach hidden"></div>
            <div class="composer">
                <button class="icon-btn" data-act="attach" title="Attach files">${icon("paperclip", 19)}</button>
                <textarea id="cin" rows="1" placeholder="Message ${c && c.kind !== "thread" ? "#" : ""}${U.esc(c ? c.name : "")}" spellcheck="true"></textarea>
                <button class="icon-btn" data-act="embed" title="Add embed">${icon("image", 19)}</button>
                <button class="icon-btn" data-act="emoji" title="Emoji">${icon("smile", 19)}</button>
                <button class="icon-btn send" data-act="send" title="Send (Enter)">${icon("send", 19)}</button>
            </div>
            <label class="chk pings"><input type="checkbox" id="pings" ${S.allowPings ? "checked" : ""}> Allow @everyone / @here / role pings</label>
        </div>`;
    const ta = $("#cin");
    ta.value = S.drafts[S.channelId] || "";
    autoGrow(ta);
    ta.addEventListener("input", () => { autoGrow(ta); autocomplete(); });
    ta.addEventListener("keydown", onComposerKey);
    ta.addEventListener("click", autocomplete);
    $("#pings").onchange = e => { S.allowPings = e.target.checked; };
    const msgs = $("#msgs");
    msgs.addEventListener("scroll", onMsgScroll);
    const drop = $(".composer-wrap");
    ["dragover", "drop"].forEach(ev => drop.addEventListener(ev, e => e.preventDefault()));
    drop.addEventListener("drop", onDropFiles);
    msgs.addEventListener("drop", onDropFiles);
    renderBanner(); renderAttach();
    msgs.innerHTML = '<div class="empty-state">Loading messages...</div>';
}

function autoGrow(ta) {
    ta.style.height = "auto";
    ta.style.height = Math.min(220, ta.scrollHeight) + "px";
}

function saveDraft() {
    const ta = $("#cin");
    if (ta && S.channelId && !S.editing) S.drafts[S.channelId] = ta.value;
}

async function loadMessages() {
    const id = S.channelId;
    try {
        const msgs = await api.call("getMessages", id, undefined, 50);
        if (id !== S.channelId) return;
        S.messages = msgs;
        S.atStart = msgs.length < 50;
    } catch (err) {
        if (id !== S.channelId) return;
        S.messages = [];
        const box = $("#msgs");
        if (box) box.innerHTML = `<div class="empty-state">${U.esc(err.message)}</div>`;
        return;
    }
    renderMessages(true);
}

async function loadOlder() {
    if (S.loadingOlder || S.atStart || !S.messages.length) return;
    S.loadingOlder = true;
    const id = S.channelId, box = $("#msgs");
    try {
        const older = await api.call("getMessages", id, S.messages[0].id, 50);
        if (id !== S.channelId) return;
        S.atStart = older.length < 50;
        const prevHeight = box.scrollHeight;
        S.messages = [...older, ...S.messages];
        renderMessages(false);
        box.scrollTop = box.scrollHeight - prevHeight;
    } catch (err) { toast(err.message, "error"); } finally { S.loadingOlder = false; }
}

function onMsgScroll() {
    const box = $("#msgs");
    if (box.scrollTop < 120) loadOlder();
    const near = box.scrollHeight - box.scrollTop - box.clientHeight < 200;
    $("#jump").classList.toggle("hidden", near);
}

function nearBottom() {
    const box = $("#msgs");
    return !box || box.scrollHeight - box.scrollTop - box.clientHeight < 200;
}

function attachmentHtml(a) {
    const url = U.esc(a.url);
    if ((a.contentType || "").startsWith("image/") || (a.width && a.height && !(a.contentType || "").startsWith("video"))) {
        return `<img class="att-img" src="${url}" alt="${U.esc(a.name)}" data-zoom="${url}" loading="lazy">`;
    }
    if ((a.contentType || "").startsWith("video/")) return `<video class="att-video" src="${url}" controls preload="metadata"></video>`;
    if ((a.contentType || "").startsWith("audio/")) return `<audio src="${url}" controls preload="none"></audio>`;
    return `<a href="#" class="att-file link" data-url="${url}">${icon("file", 22)}<span><b>${U.esc(a.name)}</b><small>${U.bytes(a.size || 0)}</small></span></a>`;
}

function reactionHtml(m, r) {
    const key = r.id ? `${r.name}:${r.id}` : r.name;
    const face = r.url ? `<img class="emoji" src="${U.esc(r.url)}" alt="">` : U.esc(r.name);
    return `<button class="react ${r.me ? "me" : ""}" data-act="react-toggle" data-mid="${m.id}" data-key="${U.esc(key)}" data-me="${r.me ? 1 : 0}">${face}<span>${r.count}</span></button>`;
}

function componentsHtml(rows) {
    const rowsHtml = rows.filter(r => r.length).map(r => `<div class="comp-row">${r.map(c => {
        if (c.type === 2) return `<span class="comp-btn s${c.style} ${c.disabled ? "dis" : ""}">${c.emoji ? U.esc(c.emoji) + " " : ""}${U.esc(c.label || "")}${c.url ? " " + icon("external", 12) : ""}</span>`;
        return `<span class="comp-select">${U.esc(c.placeholder || "Select an option")} ${icon("chevronDown", 12)}</span>`;
    }).join("")}</div>`).join("");
    return rowsHtml ? `<div class="comps">${rowsHtml}<small class="muted-text">Interactive components are shown read-only</small></div>` : "";
}

const SYSTEM = { 7: "joined the server.", 8: "boosted the server.", 18: "created a thread.", 6: "pinned a message to this channel.", 19: "replied." };

function msgHtml(m, prev) {
    const ctx = { users: m.mentions.users, roles: m.mentions.roles, channels: m.mentions.channels };
    const day = !prev || U.dayKey(prev.timestamp) !== U.dayKey(m.timestamp);
    const divider = day ? `<div class="divider"><span>${U.esc(U.date(m.timestamp))}</span></div>` : "";
    if (m.system) {
        return `${divider}<div class="msg sys" data-mid="${m.id}" data-ctx="message">${icon("check", 14)}<span><b>${U.esc(m.author.name)}</b> ${U.esc(SYSTEM[m.type] || "(system message)")}</span><small>${U.time(m.timestamp)}</small></div>`;
    }
    const grouped = !day && prev && !prev.system && prev.author.id === m.author.id && m.timestamp - prev.timestamp < 7 * 60000 && !m.reference;
    const own = S.me && m.author.id === S.me.id;
    const ref = m.reference ? `<div class="ref">${icon("reply", 12).replace("<svg", '<svg style="transform:scaleX(-1)"')}${m.reference.author
        ? `<img class="av xs" src="${U.esc(m.reference.avatar || "")}" alt=""><b>${U.esc(m.reference.author)}</b><span>${U.esc(m.reference.content || "")}</span>`
        : "<span>Original message not loaded</span>"}</div>` : "";
    const head = grouped ? "" : `<div class="m-head"><span class="m-name" style="${m.author.color ? `color:${m.author.color}` : ""}">${U.esc(m.author.name)}</span>
        ${m.author.bot ? `<span class="tagbot">${m.webhook ? "WEBHOOK" : "BOT"}</span>` : ""}<span class="m-time" title="${U.esc(U.full(m.timestamp))}">${U.stamp(m.timestamp)}</span></div>`;
    const tools = `<div class="tools">
        <button data-act="msg-react" data-mid="${m.id}" title="Add reaction">${icon("smile", 15)}</button>
        <button data-act="msg-reply" data-mid="${m.id}" title="Reply">${icon("reply", 15)}</button>
        ${own ? `<button data-act="msg-edit" data-mid="${m.id}" title="Edit">${icon("pencil", 15)}</button>` : ""}
        <button data-act="msg-delete" data-mid="${m.id}" title="Delete">${icon("trash", 15)}</button>
        <button data-act="msg-more" data-mid="${m.id}" title="More">${icon("more", 15)}</button></div>`;
    return `${divider}<div class="msg ${grouped ? "grouped" : ""} ${m.pinned ? "pinned" : ""}" data-mid="${m.id}" data-ctx="message">
        ${ref}
        <div class="m-row">
            ${grouped ? `<span class="m-gtime">${U.time(m.timestamp)}</span>` : `<img class="av" src="${U.esc(m.author.avatar)}" alt="">`}
            <div class="m-body">${head}
                ${m.content ? `<div class="m-text">${U.md(m.content, ctx)}${m.edited ? '<small class="edited" title="Edited">(edited)</small>' : ""}</div>` : ""}
                ${m.attachments.map(attachmentHtml).join("")}
                ${m.stickers.map(s => `<img class="sticker" src="${U.esc(s.url)}" alt="${U.esc(s.name)}">`).join("")}
                ${m.embeds.map(e => renderEmbed(e, ctx)).join("")}
                ${componentsHtml(m.components)}
                ${m.reactions.length ? `<div class="reacts">${m.reactions.map(r => reactionHtml(m, r)).join("")}</div>` : ""}
            </div>
        </div>${tools}</div>`;
}

function renderMessages(scrollBottom) {
    const box = $("#msgs");
    if (!box) return;
    const stick = scrollBottom || nearBottom();
    const keep = box.scrollTop;
    box.innerHTML = (S.atStart ? '<div class="start-note">This is the start of the channel.</div>' : "")
        + (S.messages.length ? S.messages.map((m, i) => msgHtml(m, S.messages[i - 1])).join("") : '<div class="empty-state">No messages yet</div>');
    if (stick) box.scrollTop = box.scrollHeight; else box.scrollTop = keep;
    onMsgScroll();
}

// ---------------------------------------------------------------------- composer
function renderBanner() {
    const b = $("#banner");
    if (!b) return;
    if (S.editing) {
        b.className = "banner"; b.innerHTML = `${icon("pencil", 14)}<span>Editing message</span><button class="icon-btn" data-act="cancel-edit">${icon("x", 14)}</button>`;
    } else if (S.replyTo) {
        b.className = "banner"; b.innerHTML = `${icon("reply", 14)}<span>Replying to <b>${U.esc(S.replyTo.author.name)}</b></span><button class="icon-btn" data-act="cancel-reply">${icon("x", 14)}</button>`;
    } else { b.className = "banner hidden"; b.innerHTML = ""; }
}

function renderAttach() {
    const a = $("#attach");
    if (!a) return;
    if (!S.files.length && !S.embeds.length) { a.className = "attach hidden"; a.innerHTML = ""; return; }
    a.className = "attach";
    a.innerHTML = S.files.map((f, i) => `<span class="chip">${icon("file", 14)}${U.esc(f.name)} <small>${U.bytes(f.size)}</small><button data-act="rm-file" data-i="${i}">${icon("x", 12)}</button></span>`).join("")
        + S.embeds.map((e, i) => `<span class="chip embed-chip">${icon("image", 14)}Embed: ${U.esc(e.title || (e.description || "").slice(0, 28) || "untitled")}<button data-act="edit-embed" data-i="${i}" title="Edit">${icon("pencil", 12)}</button><button data-act="rm-embed" data-i="${i}">${icon("x", 12)}</button></span>`).join("");
}

async function onDropFiles(e) {
    e.preventDefault();
    for (const f of e.dataTransfer.files) {
        try { S.files.push(await api.fileInfo(api.pathForFile(f))); } catch { toast("Could not read " + f.name, "error"); }
    }
    S.files = S.files.slice(0, 10);
    renderAttach();
}

function onComposerKey(e) {
    const ac = $("#ac");
    if (ac && !ac.classList.contains("hidden")) {
        const items = $$(".ac-item", ac);
        const cur = items.findIndex(i => i.classList.contains("sel"));
        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            const next = (cur + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
            items.forEach((i, n) => i.classList.toggle("sel", n === next));
            return;
        }
        if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); (items[cur] || items[0]).click(); return; }
        if (e.key === "Escape") { ac.classList.add("hidden"); return; }
    }
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); submit(); }
    else if (e.key === "Escape" && (S.editing || S.replyTo)) { S.editing = null; S.replyTo = null; $("#cin").value = S.drafts[S.channelId] || ""; renderBanner(); }
    else if (e.key === "ArrowUp" && !$("#cin").value) {
        const mine = [...S.messages].reverse().find(m => S.me && m.author.id === S.me.id && !m.system);
        if (mine) { e.preventDefault(); startEdit(mine.id); }
    }
}

function autocomplete() {
    const ta = $("#cin"), ac = $("#ac");
    if (!ta || !ac) return;
    const before = ta.value.slice(0, ta.selectionStart);
    const m = before.match(/([@#])([\w-]{0,32})$/);
    if (!m || !S.guildId) { ac.classList.add("hidden"); return; }
    const q = m[2].toLowerCase();
    let items = [];
    if (m[1] === "@") {
        const data = S.members[S.guildId];
        if (data && data.members) {
            items = data.members.filter(x => x.displayName.toLowerCase().includes(q) || x.username.toLowerCase().includes(q)).slice(0, 6)
                .map(x => ({ label: x.displayName, sub: "@" + x.username, insert: `<@${x.id}> `, img: x.avatar }));
            items.push(...(data.roles || []).filter(r => r.name.toLowerCase().includes(q)).slice(0, 4).map(r => ({ label: r.name, sub: "role", insert: `<@&${r.id}> `, color: r.color })));
        }
        if ("everyone".startsWith(q)) items.push({ label: "everyone", sub: "notify everyone", insert: "@everyone " });
        if ("here".startsWith(q)) items.push({ label: "here", sub: "notify online", insert: "@here " });
    } else {
        items = chanList(S.guildId).filter(c => TEXTLIKE.has(c.kind) || c.kind === "forum").filter(c => c.name.toLowerCase().includes(q)).slice(0, 8)
            .map(c => ({ label: c.name, sub: "#", insert: `<#${c.id}> ` }));
    }
    items = items.slice(0, 10);
    if (!items.length) { ac.classList.add("hidden"); return; }
    ac.innerHTML = items.map((it, i) => `<button class="ac-item ${i === 0 ? "sel" : ""}" data-i="${i}">${it.img ? `<img class="av xs" src="${U.esc(it.img)}" alt="">` : ""}<b style="${it.color ? `color:${it.color}` : ""}">${U.esc(it.label)}</b><small>${U.esc(it.sub)}</small></button>`).join("");
    ac.classList.remove("hidden");
    $$(".ac-item", ac).forEach((btn, i) => btn.onclick = () => {
        const start = ta.selectionStart - m[0].length;
        ta.value = ta.value.slice(0, start) + items[i].insert + ta.value.slice(ta.selectionStart);
        ta.selectionStart = ta.selectionEnd = start + items[i].insert.length;
        ac.classList.add("hidden"); autoGrow(ta); ta.focus();
    });
}

async function submit() {
    const ta = $("#cin");
    const text = ta.value;
    if (S.editing) {
        const id = S.editing.id;
        if (!text.trim()) { toast("A message can't be empty", "error"); return; }
        await run(() => api.call("editMessage", S.channelId, id, { content: text }));
        S.editing = null; ta.value = S.drafts[S.channelId] || ""; autoGrow(ta); renderBanner();
        return;
    }
    if (!text.trim() && !S.files.length && !S.embeds.length) return;
    const btn = $(".send");
    btn.disabled = true;
    try {
        await api.call("send", S.channelId, {
            content: text.trim(), embeds: S.embeds, files: S.files.map(f => ({ path: f.path, name: f.name })),
            replyTo: S.replyTo ? S.replyTo.id : undefined, allowPings: S.allowPings,
        });
        ta.value = ""; delete S.drafts[S.channelId]; autoGrow(ta);
        S.files = []; S.embeds = []; S.replyTo = null;
        renderBanner(); renderAttach();
    } catch (err) { toast(err.message, "error"); } finally { btn.disabled = false; ta.focus(); }
}

function startEdit(mid) {
    const m = S.messages.find(x => x.id === mid);
    if (!m) return;
    saveDraft();
    S.editing = m; S.replyTo = null;
    const ta = $("#cin");
    ta.value = m.content; autoGrow(ta); ta.focus();
    renderBanner();
}

// ---------------------------------------------------------------------- members
async function ensureMembers(gid) {
    if (!gid || S.members[gid]) return;
    S.members[gid] = { loading: true };
    try { S.members[gid] = await api.call("getMembers", gid); } catch (err) { S.members[gid] = { error: err.message }; }
    if (gid === S.guildId) renderMembers();
}

async function ensureEmojis(gid) {
    if (!gid || S.emojis[gid]) return;
    try { S.emojis[gid] = await api.call("getEmojis", gid); } catch { S.emojis[gid] = []; }
}

function renderMembers() {
    const el = $("#members");
    if (!el) return;
    const show = S.view === "channel" && S.guildId && S.showMembers;
    el.classList.toggle("hidden", !show);
    if (!show) { el.innerHTML = ""; return; }
    const d = S.members[S.guildId];
    if (!d || d.loading) { el.innerHTML = '<div class="mem-note">Loading members...</div>'; return; }
    if (d.error) { el.innerHTML = `<div class="mem-note">${U.esc(d.error)}</div>`; return; }
    const q = S.memberFilter.toLowerCase();
    const list = d.members.filter(m => !q || m.displayName.toLowerCase().includes(q) || m.username.toLowerCase().includes(q));
    const roleMap = new Map(d.roles.map(r => [r.id, r]));
    const groups = new Map();
    for (const m of list) {
        const key = m.hoistRole && roleMap.has(m.hoistRole) ? m.hoistRole : "_";
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(m);
    }
    const order = [...d.roles.filter(r => r.hoist).map(r => r.id), "_"].filter(k => groups.has(k));
    el.innerHTML = `<div class="mem-search"><input id="mem-q" placeholder="Search members" value="${U.esc(S.memberFilter)}"></div>
        <div class="mem-scroll">${order.map(k => {
            const ms = groups.get(k).sort((a, b) => a.displayName.localeCompare(b.displayName));
            const r = roleMap.get(k);
            return `<div class="mem-group">${U.esc(r ? r.name : "Members")} — ${ms.length}</div>${ms.map(m => `
                <button class="mem" data-act="profile" data-id="${m.id}" data-ctx="member">
                    <img class="av sm" src="${U.esc(m.avatar)}" alt=""><span class="mn" style="${m.color ? `color:${m.color}` : ""}">${U.esc(m.displayName)}</span>
                    ${m.bot ? '<span class="tagbot">BOT</span>' : ""}${m.timeoutUntil && m.timeoutUntil > Date.now() ? icon("clock", 13) : ""}</button>`).join("")}`;
        }).join("")}</div>`;
    const inp = $("#mem-q");
    inp.addEventListener("input", () => {
        S.memberFilter = inp.value; const pos = inp.selectionStart; renderMembers();
        const n = $("#mem-q"); n.focus(); n.setSelectionRange(pos, pos);
    });
}

// ====================================================================== aksi dialog
function openProfile(uid) {
    const d = S.members[S.guildId];
    const m = d && d.members && d.members.find(x => x.id === uid);
    if (!m) return;
    const roleMap = new Map(d.roles.map(r => [r.id, r]));
    const isMe = S.me && m.id === S.me.id;
    const timedOut = m.timeoutUntil && m.timeoutUntil > Date.now();
    openModal({
        title: "Member", className: "profile",
        body: `<div class="prof-head"><img class="av lg" src="${U.esc(m.avatar)}" alt=""><div><h3 style="${m.color ? `color:${m.color}` : ""}">${U.esc(m.displayName)} ${m.bot ? '<span class="tagbot">BOT</span>' : ""}</h3>
            <small class="muted-text">@${U.esc(m.username)} • ${m.id}</small></div></div>
            ${timedOut ? `<div class="notice">${icon("clock", 14)} Timed out until ${U.esc(U.full(m.timeoutUntil))}</div>` : ""}
            <div class="prof-sec"><label class="lbl">Joined</label><div>${m.joinedTimestamp ? U.esc(U.full(m.joinedTimestamp)) : "-"}</div></div>
            <div class="prof-sec"><label class="lbl">Roles</label><div class="role-chips">${m.roles.map(id => roleMap.get(id)).filter(Boolean).sort((a, b) => b.position - a.position)
                .map(r => `<span class="role-chip"><i style="background:${r.color || "#99aab5"}"></i>${U.esc(r.name)}</span>`).join("") || '<span class="muted-text">No roles</span>'}</div></div>`,
        actions: isMe ? [{ label: "Close" }] : [
            { label: "Message", onClick: () => { memberAction("dm", m); return false; } },
            { label: "Roles", onClick: () => { memberAction("roles", m); return false; } },
            { label: "Nickname", onClick: () => { memberAction("nick", m); return false; } },
            { label: timedOut ? "Remove timeout" : "Timeout", onClick: () => { memberAction(timedOut ? "untimeout" : "timeout", m); return false; } },
            { label: "Kick", danger: true, onClick: () => { memberAction("kick", m); return false; } },
            { label: "Ban", danger: true, onClick: () => { memberAction("ban", m); return false; } },
        ],
    });
}

async function refreshMembers() {
    delete S.members[S.guildId];
    await ensureMembers(S.guildId);
}

async function memberAction(kind, m) {
    const gid = S.guildId;
    if (kind === "dm") {
        const text = await promptBox({ title: `Message ${m.displayName}`, label: "Direct message", multiline: true, confirmLabel: "Send", required: true });
        if (text) await run(() => api.call("sendDM", m.id, text), "Message sent");
    } else if (kind === "nick") {
        const nick = await promptBox({ title: "Change nickname", label: `Nickname for ${m.username} (empty to reset)`, value: m.nickname || "" });
        if (nick !== null) { await run(() => api.call("setNickname", gid, m.id, nick), "Nickname updated"); refreshMembers(); }
    } else if (kind === "timeout") {
        timeoutDialog(m);
    } else if (kind === "untimeout") {
        await run(() => api.call("timeout", gid, m.id, 0), "Timeout removed"); refreshMembers();
    } else if (kind === "kick") {
        if (await confirmBox({ title: "Kick member", message: `Kick ${m.displayName} from the server?`, confirmLabel: "Kick", danger: true })) {
            await run(() => api.call("kick", gid, m.id), "Member kicked"); refreshMembers();
        }
    } else if (kind === "ban") {
        banDialog(m);
    } else if (kind === "roles") {
        rolesDialog(m);
    }
}

function timeoutDialog(m) {
    openModal({
        title: `Timeout ${m.displayName}`,
        body: `<label class="lbl">Duration</label><select id="to-dur">
            ${[["60", "60 seconds"], ["300", "5 minutes"], ["600", "10 minutes"], ["3600", "1 hour"], ["86400", "1 day"], ["604800", "1 week"]].map(([v, l]) => `<option value="${v}">${l}</option>`).join("")}</select>
            <label class="lbl">Reason (optional)</label><input id="to-reason" maxlength="200">`,
        actions: [{ label: "Cancel" }, {
            label: "Timeout", primary: true,
            onClick: async ({ el }) => {
                await api.call("timeout", S.guildId, m.id, Number($("#to-dur", el).value) * 1000, $("#to-reason", el).value);
                toast("Member timed out", "ok"); refreshMembers();
            },
        }],
    });
}

function banDialog(m) {
    openModal({
        title: `Ban ${m.displayName}`,
        body: `<label class="lbl">Delete message history</label><select id="ban-del">
            ${[["0", "Don't delete any"], ["3600", "Previous hour"], ["86400", "Previous 24 hours"], ["604800", "Previous 7 days"]].map(([v, l]) => `<option value="${v}">${l}</option>`).join("")}</select>
            <label class="lbl">Reason (optional)</label><input id="ban-reason" maxlength="200">`,
        actions: [{ label: "Cancel" }, {
            label: "Ban", danger: true,
            onClick: async ({ el }) => {
                await api.call("ban", S.guildId, m.id, $("#ban-reason", el).value, Number($("#ban-del", el).value));
                toast("Member banned", "ok"); refreshMembers();
            },
        }],
    });
}

async function rolesDialog(m) {
    const roles = await run(() => api.call("getRoles", S.guildId));
    if (!roles) return;
    openModal({
        title: `Roles for ${m.displayName}`,
        body: `<div class="role-list">${roles.map(r => `<label class="chk role-row ${r.editable && !r.managed ? "" : "dis"}">
            <input type="checkbox" value="${r.id}" ${m.roles.includes(r.id) ? "checked" : ""} ${r.editable && !r.managed ? "" : "disabled"}>
            <i style="background:${r.color || "#99aab5"}"></i>${U.esc(r.name)}${r.managed ? " <small>(bot role)</small>" : !r.editable ? " <small>(above the bot)</small>" : ""}</label>`).join("")}</div>`,
        actions: [{ label: "Cancel" }, {
            label: "Save", primary: true,
            onClick: async ({ el }) => {
                const ids = $$("input[type=checkbox]:checked", el).map(i => i.value);
                await api.call("setMemberRoles", S.guildId, m.id, ids);
                toast("Roles updated", "ok"); refreshMembers();
            },
        }],
    });
}

function channelDialog(parentId, gid = S.guildId) {
    const cats = chanList(gid).filter(c => c.kind === "category").sort(byOrder);
    openModal({
        title: "Create channel",
        body: `<label class="lbl">Type</label><select id="cc-kind">${[["text", "Text"], ["announcement", "Announcement"], ["forum", "Forum"], ["voice", "Voice"], ["category", "Category"]].map(([v, l]) => `<option value="${v}">${l}</option>`).join("")}</select>
            <label class="lbl">Name</label><input id="cc-name" maxlength="100" placeholder="new-channel">
            <div id="cc-cat-wrap"><label class="lbl">Category</label><select id="cc-cat"><option value="">(none)</option>${cats.map(c => `<option value="${c.id}" ${c.id === parentId ? "selected" : ""}>${U.esc(c.name)}</option>`).join("")}</select></div>
            <div id="cc-topic-wrap"><label class="lbl">Topic (optional)</label><input id="cc-topic" maxlength="1024"></div>`,
        actions: [{ label: "Cancel" }, {
            label: "Create", primary: true,
            onClick: async ({ el }) => {
                const kind = $("#cc-kind", el).value, name = $("#cc-name", el).value.trim();
                if (!name) throw new Error("Enter a name");
                await api.call("createChannel", gid, { name, kind, parentId: $("#cc-cat", el).value || null, topic: $("#cc-topic", el).value.trim() });
                toast("Channel created", "ok"); await loadChannels(gid);
            },
        }],
        onMount: ({ el }) => {
            const sync = () => {
                const k = $("#cc-kind", el).value;
                $("#cc-cat-wrap", el).style.display = k === "category" ? "none" : "";
                $("#cc-topic-wrap", el).style.display = ["text", "announcement", "forum"].includes(k) ? "" : "none";
            };
            $("#cc-kind", el).onchange = sync; sync();
        },
    });
}

function editChannelDialog(c) {
    const hasTopic = ["text", "announcement", "forum"].includes(c.kind);
    openModal({
        title: `Edit ${c.name}`,
        body: `<label class="lbl">Name</label><input id="ec-name" value="${U.esc(c.name)}" maxlength="100">
            ${hasTopic ? `<label class="lbl">Topic</label><textarea id="ec-topic" rows="3" maxlength="1024">${U.esc(c.topic || "")}</textarea>` : ""}`,
        actions: [{ label: "Cancel" }, {
            label: "Save", primary: true,
            onClick: async ({ el }) => {
                await api.call("editChannel", c.id, { name: $("#ec-name", el).value.trim(), ...(hasTopic ? { topic: $("#ec-topic", el).value } : {}) });
                toast("Channel updated", "ok"); await loadChannels(S.guildId); renderTitlebar();
            },
        }],
    });
}

async function deleteChannelFlow(c) {
    if (!await confirmBox({ title: "Delete channel", message: `Delete "${c.name}"? This cannot be undone.`, confirmLabel: "Delete", danger: true })) return;
    await run(() => api.call("deleteChannel", c.id), "Channel deleted");
    await loadChannels(S.guildId);
    if (S.channelId === c.id) await go({ guildId: S.guildId });
}

async function leaveFlow(gid) {
    const g = guildOf(gid);
    if (!await confirmBox({ title: "Leave server", message: `Make the bot leave "${g ? g.name : gid}"?`, confirmLabel: "Leave", danger: true })) return;
    await run(() => api.call("leaveGuild", gid), "Left the server");
    S.guilds = await api.call("getGuilds");
    if (S.guildId === gid) await go({}); else renderAll();
}

async function pinsDialog() {
    const pins = await run(() => api.call("getPins", S.channelId));
    if (!pins) return;
    openModal({
        title: `Pinned messages (${pins.length})`, wide: true,
        body: `<div class="msgs static">${pins.map((m, i) => msgHtml(m, pins[i - 1])).join("") || '<div class="empty-state">No pinned messages</div>'}</div>`,
    });
}

function newPostDialog() {
    openModal({
        title: "New forum post",
        body: `<label class="lbl">Title</label><input id="np-title" maxlength="100"><label class="lbl">Message</label><textarea id="np-text" rows="6"></textarea>`,
        actions: [{ label: "Cancel" }, {
            label: "Post", primary: true,
            onClick: async ({ el }) => {
                const name = $("#np-title", el).value.trim(), content = $("#np-text", el).value.trim();
                if (!name || !content) throw new Error("Enter a title and a message");
                const id = await api.call("createForumPost", S.channelId, { name, content });
                await loadChannels(S.guildId, false);
                await openChannel(id);
            },
        }],
    });
}

function settingsDialog() {
    const st = S.status, s = S.settings;
    openModal({
        title: "Settings", wide: true,
        body: `
        <div class="set-sec"><h4>Connection</h4>
            <div class="set-row"><div><b>${U.esc(S.me ? S.me.tag : "Not connected")}</b><small class="muted-text">${st.state}${st.limited && st.limited.members ? " • limited mode (privileged intents are off)" : ""}</small></div>
            <div class="bar" style="margin-top:0"><button class="btn small" id="s-profile">Edit bot profile</button><button class="btn small" id="s-reconnect">Reconnect</button><button class="btn small danger" id="s-logout">Remove token</button></div></div>
            ${st.limited && st.limited.members ? '<div class="notice">Turn on <b>Server Members Intent</b> and <b>Message Content Intent</b> in the Developer Portal (Bot tab), then press Reconnect, to see members and message text.</div>' : ""}</div>
        <div class="set-sec"><h4>Behavior</h4>
            <label class="chk set-chk"><input type="checkbox" id="s-tray" ${s.closeToTray ? "checked" : ""}> Closing the window hides it to the system tray (the bot stays online)</label>
            <label class="chk set-chk"><input type="checkbox" id="s-auto" ${s.autoConnect ? "checked" : ""}> Connect the bot automatically when the app starts</label>
            <label class="chk set-chk"><input type="checkbox" id="s-boot" ${s.startWithWindows ? "checked" : ""}> Start with Windows (minimized to tray)${S.packaged ? "" : " <small>- only in the installed app</small>"}</label></div>
        <div class="set-sec"><h4>Updates</h4>
            <label class="chk set-chk"><input type="checkbox" id="s-upd" ${s.autoUpdate !== false ? "checked" : ""} ${S.canUpdate ? "" : "disabled"}> Check for updates automatically</label>
            <div class="set-row"><small class="muted-text" id="upd-text">${U.esc(updateStatusText())}</small>
            <button class="btn small" id="s-checkupd" ${S.canUpdate ? "" : "disabled"}>Check now</button></div></div>
        <div class="set-sec"><h4>Appearance</h4>
            <div class="row2"><div><label class="lbl">Accent color</label><input type="color" id="s-accent" value="${U.esc(s.accent || "#ff9132")}"></div>
            <div><label class="chk set-chk" style="margin-top:28px"><input type="checkbox" id="s-compact" ${s.compact ? "checked" : ""}> Compact messages</label></div></div>
            <small class="muted-text">Zoom with Ctrl + / Ctrl − / Ctrl 0. Fullscreen with F11. Quick switcher with Ctrl K.</small></div>
        <div class="set-sec"><h4>About</h4><small class="muted-text">Mugiwara Bot ${U.esc(S.version)}</small></div>`,
        actions: [{ label: "Close" }],
        onMount: ({ el, close }) => {
            const set = patch => api.settings(patch);
            $("#s-tray", el).onchange = e => set({ closeToTray: e.target.checked });
            $("#s-auto", el).onchange = e => set({ autoConnect: e.target.checked });
            $("#s-boot", el).onchange = e => set({ startWithWindows: e.target.checked });
            $("#s-upd", el).onchange = e => set({ autoUpdate: e.target.checked });
            $("#s-checkupd", el).onclick = async () => { await api.checkUpdate(); const t = $("#upd-text"); if (t) t.textContent = updateStatusText(); };
            $("#s-profile", el).onclick = () => { close(); botProfileDialog(); };
            $("#s-accent", el).oninput = e => set({ accent: e.target.value });
            $("#s-compact", el).onchange = e => set({ compact: e.target.checked });
            $("#s-reconnect", el).onclick = () => { close(); doReconnect(); };
            $("#s-logout", el).onclick = async () => {
                if (!await confirmBox({ title: "Remove token", message: "The bot goes offline and the saved token is deleted from this computer.", confirmLabel: "Remove", danger: true })) return;
                close(); await api.logout(); S.hasToken = false; S.guilds = []; S.channels = {}; S.members = {}; renderLogin();
            };
        },
    });
}

async function botProfileDialog() {
    const p = await run(() => api.call("getProfile"));
    if (!p) return;
    // undefined = tidak diubah, "remove" = hapus, string = data URL gambar baru
    const pending = { avatar: undefined, banner: undefined, appIcon: undefined };
    const bg = url => (url ? `style="background-image:url('${U.esc(url)}')"` : "");
    openModal({
        title: "Bot profile", wide: true, className: "bot-profile",
        body: `<div class="split">
            <div>
                <div class="prof-banner" id="bp-banner" ${bg(p.banner)}></div>
                <img class="prof-avatar" id="bp-avatar" src="${U.esc(p.avatar)}" alt="">
                <div class="bar" style="margin-top:8px">
                    <button class="btn small" id="bp-pick-avatar">Change avatar</button>
                    <button class="btn small" id="bp-pick-banner">Change banner</button>
                    <button class="btn small ghost" id="bp-rm-banner">Remove banner</button>
                </div>
                <label class="lbl">App icon (shown in the app directory and install page)</label>
                <div class="row-input"><img class="av" id="bp-icon" src="${U.esc(p.appIcon || p.avatar)}" alt=""><button class="btn small" id="bp-pick-icon">Change app icon</button></div>
                <small class="muted-text">Avatar and app icon are separate in Discord. Images up to 8 MB (PNG, JPG, GIF, WEBP).</small>
            </div>
            <div>
                <label class="lbl">Username</label><input id="bp-name" value="${U.esc(p.username)}" maxlength="32">
                <small class="muted-text">Discord limits username changes to about 2 per hour.</small>
                <label class="lbl">About me / description <span id="bp-count" class="muted-text"></span></label>
                <textarea id="bp-desc" rows="6" maxlength="400">${U.esc(p.description)}</textarea>
                <label class="lbl">Tags (comma separated, max 5, 20 characters each)</label>
                <input id="bp-tags" value="${U.esc((p.tags || []).join(", "))}" placeholder="roblox, scripts, utility">
                <label class="lbl">Install link</label>
                <input value="${U.esc(p.installUrl || "Set it in Developer Portal → Installation")}" readonly>
            </div>
        </div>`,
        actions: [{ label: "Cancel" }, {
            label: "Save changes", primary: true,
            onClick: async ({ el }) => {
                const done = [], failed = [];
                const attempt = async (label, fn) => { try { await fn(); done.push(label); } catch (err) { failed.push(`${label}: ${err.message}`); } };
                const name = $("#bp-name", el).value.trim();
                const desc = $("#bp-desc", el).value;
                const tags = $("#bp-tags", el).value.split(",").map(t => t.trim()).filter(Boolean);
                if (name && name !== p.username) await attempt("Username", () => api.call("setUsername", name));
                if (pending.avatar) await attempt("Avatar", () => api.call("setAvatar", pending.avatar));
                if (pending.banner === "remove") await attempt("Banner", () => api.call("setBanner", null));
                else if (pending.banner) await attempt("Banner", () => api.call("setBanner", pending.banner));
                const app = {};
                if (desc !== p.description) app.description = desc;
                if (tags.join("|") !== (p.tags || []).join("|")) app.tags = tags;
                if (pending.appIcon) app.icon = pending.appIcon;
                if (Object.keys(app).length) await attempt("Description, tags, or icon", () => api.call("editApplication", app));
                if (failed.length) { toast(failed.join("\n"), "error"); if (!done.length) return false; }
                if (done.length) toast(`Saved: ${done.join(", ")}`, "ok");
                renderSidebar();
                return undefined;
            },
        }],
        onMount: ({ el }) => {
            const count = () => { $("#bp-count", el).textContent = `${$("#bp-desc", el).value.length}/400`; };
            $("#bp-desc", el).addEventListener("input", count); count();
            const pick = async (title, apply) => {
                try { const img = await api.pickImage(title); if (img) apply(img.dataUrl); } catch (err) { toast(err.message, "error"); }
            };
            $("#bp-pick-avatar", el).onclick = () => pick("Choose an avatar", url => { pending.avatar = url; $("#bp-avatar", el).src = url; });
            $("#bp-pick-banner", el).onclick = () => pick("Choose a banner", url => { pending.banner = url; $("#bp-banner", el).style.backgroundImage = `url('${url}')`; });
            $("#bp-rm-banner", el).onclick = () => { pending.banner = "remove"; $("#bp-banner", el).style.backgroundImage = "none"; };
            $("#bp-pick-icon", el).onclick = () => pick("Choose an app icon", url => { pending.appIcon = url; $("#bp-icon", el).src = url; });
        },
    });
}

function quickSwitcher() {
    const entries = [];
    for (const g of S.guilds) {
        entries.push({ label: g.name, sub: "Server", run: () => go({ guildId: g.id }) });
        for (const c of chanList(g.id)) if (["text", "announcement", "forum", "thread"].includes(c.kind)) entries.push({ label: "#" + c.name, sub: g.name, run: () => openChannel(c.id) });
    }
    openModal({
        title: "Quick switcher", className: "quick",
        body: `<input id="qs" placeholder="Jump to a server or channel" autocomplete="off"><div id="qs-list" class="qs-list"></div>`,
        onMount: ({ el, close }) => {
            let sel = 0, shown = [];
            const draw = () => {
                const q = $("#qs", el).value.toLowerCase();
                shown = entries.filter(e => !q || (e.label + " " + e.sub).toLowerCase().includes(q)).slice(0, 12);
                sel = Math.min(sel, Math.max(0, shown.length - 1));
                $("#qs-list", el).innerHTML = shown.map((e, i) => `<button class="qs-item ${i === sel ? "sel" : ""}" data-i="${i}"><b>${U.esc(e.label)}</b><small>${U.esc(e.sub)}</small></button>`).join("") || '<div class="muted-text">No results</div>';
            };
            const pick = i => { const e = shown[i]; if (e) { close(); e.run(); } };
            $("#qs", el).addEventListener("input", () => { sel = 0; draw(); });
            $("#qs", el).addEventListener("keydown", e => {
                if (e.key === "ArrowDown") { sel = Math.min(shown.length - 1, sel + 1); draw(); e.preventDefault(); }
                else if (e.key === "ArrowUp") { sel = Math.max(0, sel - 1); draw(); e.preventDefault(); }
                else if (e.key === "Enter") pick(sel);
            });
            $("#qs-list", el).addEventListener("click", e => { const b = e.target.closest(".qs-item"); if (b) pick(Number(b.dataset.i)); });
            draw();
        },
    });
}

async function doReconnect() {
    try { await api.reconnect(); } catch (err) { S.status = { ...S.status, state: "error", error: err.message }; renderOffline(); }
}

// ====================================================================== menu konteks
function messageMenu(mid) {
    const m = S.messages.find(x => x.id === mid);
    if (!m) return [];
    const own = S.me && m.author.id === S.me.id;
    const link = `https://discord.com/channels/${S.guildId || "@me"}/${S.channelId}/${m.id}`;
    return [
        { label: "Reply", icon: "reply", action: () => { S.replyTo = m; S.editing = null; renderBanner(); $("#cin").focus(); } },
        { label: "Add reaction", icon: "smile", action: () => reactPicker(mid) },
        own && { label: "Edit message", icon: "pencil", action: () => startEdit(mid) },
        { label: m.pinned ? "Unpin message" : "Pin message", icon: "pin", action: () => run(() => api.call("pin", S.channelId, mid, !m.pinned)) },
        { sep: true },
        { label: "Copy text", icon: "copy", disabled: !m.content, action: () => api.copy(m.content) },
        { label: "Copy message link", icon: "link", action: () => api.copy(link) },
        { label: "Copy message ID", icon: "copy", action: () => api.copy(m.id) },
        { label: "Copy user ID", icon: "copy", action: () => api.copy(m.author.id) },
        { sep: true },
        { label: "Delete message", icon: "trash", danger: true, action: () => deleteMessage(mid) },
    ];
}

async function deleteMessage(mid) {
    if (!await confirmBox({ title: "Delete message", message: "Delete this message for everyone?", confirmLabel: "Delete", danger: true })) return;
    await run(() => api.call("deleteMessage", S.channelId, mid));
}

function reactPicker(mid, anchor) {
    const a = anchor || $(`.msg[data-mid="${mid}"]`) || $("#cin");
    openEmojiPicker(a, S.emojis[S.guildId], e => run(() => api.call("react", S.channelId, mid, e.reactionKey, true)));
}

function memberMenu(id) {
    const d = S.members[S.guildId];
    const m = d && d.members && d.members.find(x => x.id === id);
    if (!m) return [];
    const isMe = S.me && m.id === S.me.id;
    const timedOut = m.timeoutUntil && m.timeoutUntil > Date.now();
    return [
        { label: "Profile", icon: "user", action: () => openProfile(id) },
        !isMe && { label: "Send message", icon: "send", action: () => memberAction("dm", m) },
        !isMe && { label: "Manage roles", icon: "shield", action: () => memberAction("roles", m) },
        !isMe && { label: "Change nickname", icon: "pencil", action: () => memberAction("nick", m) },
        !isMe && { sep: true },
        !isMe && { label: timedOut ? "Remove timeout" : "Timeout", icon: "clock", action: () => memberAction(timedOut ? "untimeout" : "timeout", m) },
        !isMe && { label: "Kick", icon: "logout", danger: true, action: () => memberAction("kick", m) },
        !isMe && { label: "Ban", icon: "ban", danger: true, action: () => memberAction("ban", m) },
        { sep: true },
        { label: "Copy user ID", icon: "copy", action: () => api.copy(m.id) },
    ];
}

function channelMenu(id) {
    const f = chanOf(id);
    if (!f) return [];
    const { c } = f;
    return [
        ["text", "announcement", "forum", "thread"].includes(c.kind) && { label: "Open", icon: "hash", action: () => openChannel(id) },
        { label: "Edit channel", icon: "pencil", action: () => editChannelDialog(c) },
        { label: "Copy mention", icon: "copy", action: () => api.copy(`<#${id}>`) },
        { label: "Copy channel ID", icon: "copy", action: () => api.copy(id) },
        { sep: true },
        { label: "Delete channel", icon: "trash", danger: true, action: () => deleteChannelFlow(c) },
    ];
}

function guildMenu(gid) {
    const g = guildOf(gid);
    return [
        { label: "Open server", icon: "server", action: () => go({ guildId: gid }) },
        { label: "Create channel", icon: "plus", action: () => channelDialog(null, gid) },
        { label: "Refresh channels", icon: "refresh", action: async () => { await loadChannels(gid); delete S.members[gid]; if (gid === S.guildId) { renderSidebar(); ensureMembers(gid); } } },
        { label: "Copy server ID", icon: "copy", action: () => api.copy(gid) },
        { sep: true },
        { label: `Leave ${g ? g.name : "server"}`, icon: "logout", danger: true, action: () => leaveFlow(gid) },
    ];
}

function statusMenu(x, y) {
    const p = S.settings.presence || {};
    const set = status => run(async () => { S.settings.presence = await api.presence({ ...p, status }); renderSidebar(); });
    showMenu(x, y, [...[["online", "Online"], ["idle", "Idle"], ["dnd", "Do Not Disturb"], ["invisible", "Invisible"]]
        .map(([v, l]) => ({ label: (p.status === v ? "● " : "○ ") + l, action: () => set(v) })),
    { sep: true }, { label: "Edit bot profile", icon: "user", action: () => botProfileDialog() }]);
}

// ====================================================================== event klik
document.addEventListener("click", async e => {
    const link = e.target.closest("a.link");
    if (link) { e.preventDefault(); api.openExternal(link.dataset.url); return; }
    const zoom = e.target.closest("[data-zoom]");
    if (zoom) { openLightbox(zoom.dataset.zoom); return; }
    const sp = e.target.closest(".spoiler");
    if (sp) { sp.classList.toggle("shown"); return; }

    const el = e.target.closest("[data-act]");
    if (!el) return;
    const act = el.dataset.act, id = el.dataset.id, mid = el.dataset.mid;
    const rect = el.getBoundingClientRect();
    switch (act) {
        case "win-min": return api.win.minimize();
        case "win-max": return api.win.toggleMaximize();
        case "win-full": return api.win.toggleFullscreen();
        case "win-close": return api.win.close();
        case "quick": return quickSwitcher();
        case "login": return doLogin();
        case "token-eye": { const t = $("#token"); t.type = t.type === "password" ? "text" : "password"; el.textContent = t.type === "password" ? "Show" : "Hide"; return; }
        case "import-env": try { await api.importEnv(); } catch (err) { if (err.message !== "Cancelled") renderLogin(err.message); } return;
        case "reconnect": return doReconnect();
        case "change-token": await api.logout(); S.hasToken = false; return renderLogin();
        case "nav-home": return go({});
        case "nav-guild": return go({ guildId: id });
        case "nav-channel": return openChannel(id);
        case "home-tab": S.homeTab = id; renderSidebar(); renderMain(); if (id === "dashboard") loadStats(); return;
        case "toggle-cat":
            if (e.target.closest(".cat-add")) return;
            S.collapsed.has(id) ? S.collapsed.delete(id) : S.collapsed.add(id);
            try { localStorage.setItem("collapsed", JSON.stringify([...S.collapsed])); } catch { /* abaikan */ }
            return renderSidebar();
        case "create-channel": e.stopPropagation(); return channelDialog(el.dataset.parent);
        case "guild-menu": return showMenu(rect.left, rect.bottom + 4, guildMenu(S.guildId));
        case "leave-guild": return leaveFlow(id);
        case "invite": { const st = S.stats || await api.call("getStats"); await api.copy(st.invite); return toast("Invite link copied. Open it in a browser to add the bot to another server.", "ok"); }
        case "settings": return settingsDialog();
        case "edit-profile": return botProfileDialog();
        case "install-update": return api.installUpdate();
        case "disconnect": if (await confirmBox({ title: "Disconnect", message: "Take the bot offline? You can reconnect any time.", confirmLabel: "Disconnect", danger: true })) await api.disconnect(); return;
        case "status-menu": return statusMenu(rect.left, rect.top - 150);
        case "apply-presence": {
            const type = $("#pr-type").value;
            S.settings.presence = await api.presence({ status: $("#pr-status").value, activityType: type, activityText: type ? $("#pr-text").value.trim() : "" });
            toast("Presence updated", "ok"); return renderSidebar();
        }
        case "refresh": return S.view === "forum" ? loadForum() : (S.messages = [], loadMessages());
        case "toggle-members": S.showMembers = !S.showMembers; el.classList.toggle("on", S.showMembers); renderMembers(); if (S.showMembers) ensureMembers(S.guildId); return;
        case "pins": return pinsDialog();
        case "new-post": return newPostDialog();
        case "jump-bottom": { const b = $("#msgs"); b.scrollTop = b.scrollHeight; return; }
        case "send": return submit();
        case "attach": { const files = await api.pickFiles(); S.files = [...S.files, ...files].slice(0, 10); return renderAttach(); }
        case "rm-file": S.files.splice(Number(el.dataset.i), 1); return renderAttach();
        case "embed": { const em = await embedBuilder(); if (em) { S.embeds.push(em); renderAttach(); } return; }
        case "edit-embed": { const i = Number(el.dataset.i); const em = await embedBuilder(S.embeds[i]); if (em) { S.embeds[i] = em; renderAttach(); } return; }
        case "rm-embed": S.embeds.splice(Number(el.dataset.i), 1); return renderAttach();
        case "emoji": return openEmojiPicker(el, S.emojis[S.guildId], em => {
            const ta = $("#cin"); const ins = em.custom || em.unicode;
            ta.setRangeText(ins, ta.selectionStart, ta.selectionEnd, "end"); autoGrow(ta); ta.focus();
        });
        case "cancel-reply": S.replyTo = null; return renderBanner();
        case "cancel-edit": S.editing = null; $("#cin").value = S.drafts[S.channelId] || ""; renderBanner(); return;
        case "msg-reply": { const m = S.messages.find(x => x.id === mid); if (m) { S.replyTo = m; S.editing = null; renderBanner(); $("#cin").focus(); } return; }
        case "msg-edit": return startEdit(mid);
        case "msg-delete": return deleteMessage(mid);
        case "msg-react": return reactPicker(mid, el);
        case "msg-more": return showMenu(rect.left - 150, rect.bottom + 4, messageMenu(mid));
        case "react-toggle": return run(() => api.call("react", S.channelId, mid, el.dataset.key, el.dataset.me !== "1"));
        case "profile": return openProfile(id);
        default: return;
    }
});

document.addEventListener("dblclick", e => { if (e.target.closest("[data-dblclick='max']")) api.win.toggleMaximize(); });

document.addEventListener("contextmenu", e => {
    const t = e.target.closest("[data-ctx]");
    if (!t) return;
    const kind = t.dataset.ctx;
    let items = [];
    if (kind === "message") items = messageMenu(t.dataset.mid);
    else if (kind === "member") items = memberMenu(t.dataset.id);
    else if (kind === "channel" || kind === "category") items = channelMenu(t.dataset.id);
    else if (kind === "guild") items = guildMenu(t.dataset.id);
    if (!items.length) return;
    e.preventDefault();
    showMenu(e.clientX, e.clientY, items);
});

document.addEventListener("keydown", e => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); if (S.ready && !$(".modal")) quickSwitcher(); return; }
    if (e.key === "Escape") {
        const lb = $(".lightbox"); if (lb) { lb.remove(); return; }
        const ep = $(".emoji-picker"); if (ep) { ep.remove(); return; }
        if ($("#menu").classList.contains("open")) { hideMenu(); return; }
        closeTopModal();
    }
});

// ====================================================================== event dari main
function applySettings() {
    document.documentElement.style.setProperty("--accent", S.settings.accent || "#ff9132");
    document.body.classList.toggle("compact", !!S.settings.compact);
}

function onBotEvent(ev) {
    switch (ev.type) {
        case "messageCreate": {
            const m = ev.message;
            if (m.channelId === S.channelId && S.view === "channel") {
                const stick = nearBottom();
                if (!S.messages.some(x => x.id === m.id)) S.messages.push(m);
                renderMessages(stick);
            } else if (!(S.me && m.author.id === S.me.id)) {
                S.unread[m.channelId] = true;
                const mine = S.me && (m.mentions.users[S.me.id] !== undefined || m.mentions.everyone);
                if (mine) S.mentions[m.channelId] = (S.mentions[m.channelId] || 0) + 1;
                renderRail(); if (m.guildId === S.guildId) renderSidebar();
            }
            break;
        }
        case "messageUpdate": {
            const m = ev.message;
            const i = S.messages.findIndex(x => x.id === m.id);
            if (i >= 0) { S.messages[i] = m; renderMessages(false); }
            break;
        }
        case "messageDelete": {
            if (ev.channelId !== S.channelId) break;
            S.messages = S.messages.filter(x => x.id !== ev.id);
            renderMessages(false);
            break;
        }
        case "guildChange": loadChannels(ev.guildId); break;
        case "guildsChange": api.call("getGuilds").then(g => { S.guilds = g; renderRail(); if (S.view === "home") renderMain(); }).catch(() => {}); break;
        case "memberChange":
            if (S.members[ev.guildId] && !S.members[ev.guildId].loading) { delete S.members[ev.guildId]; if (ev.guildId === S.guildId) ensureMembers(ev.guildId); }
            break;
        default: break;
    }
}

function onStatus(st) {
    const prev = S.status;
    S.status = st;
    if (st.user) S.me = st.user;
    renderTitlebar();
    if (S.ready && st.state === "online" && prev.user && st.user && (prev.user.avatar !== st.user.avatar || prev.user.username !== st.user.username)) renderSidebar();
    if (st.state === "online" && (!S.ready || prev.state !== "online")) { onReady(); return; }
    if (st.state !== "online" && prev.state === "online") { renderOffline(); return; }
    if (st.state === "connecting" || st.state === "error") { if (S.hasToken) renderOffline(); return; }
    if (S.view === "home" && S.homeTab === "dashboard") { const u = $("#uptime"); if (u && st.startedAt) u.textContent = U.duration(Date.now() - st.startedAt); }
}

// ====================================================================== start
async function init() {
    const info = await api.info();
    S.settings = info.settings; S.status = info.status; S.version = info.version; S.packaged = info.packaged;
    S.logs = info.logs; S.win = info.window; S.hasToken = info.hasToken;
    S.update = info.update; S.canUpdate = !!info.canUpdate;
    applySettings();
    renderTitlebar();

    api.on("win:state", s => { S.win = s; renderTitlebar(); });
    api.on("app:settings", s => { S.settings = { ...S.settings, ...s }; applySettings(); if (S.view === "home") renderMain(); });
    api.on("bot:log", l => {
        S.logs.push(l); if (S.logs.length > 500) S.logs.shift();
        if (S.view === "home" && S.homeTab !== "servers") renderMain();
    });
    api.on("app:update", u => {
        S.update = u; renderTitlebar();
        const t = $("#upd-text"); if (t) t.textContent = updateStatusText();
    });
    api.on("bot:event", onBotEvent);
    api.on("bot:status", st => { if (st.state !== "offline" || S.hasToken || S.ready) S.hasToken = S.hasToken || st.state === "online"; onStatus(st); });

    if (S.status.state === "online") onReady();
    else if (info.hasToken) renderOffline();
    else renderLogin();

    setInterval(() => { if (S.view === "home") { const u = $("#uptime"); if (u && S.status.startedAt) u.textContent = U.duration(Date.now() - S.status.startedAt); } }, 1000);
}

init();
