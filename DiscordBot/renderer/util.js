"use strict";
// Helper murni tanpa akses ke state aplikasi: escape HTML, ikon, markdown ala Discord, format waktu.
const U = (() => {
    const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

    const PATHS = {
        hash: '<line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/><line x1="10" y1="3" x2="8" y2="21"/><line x1="16" y1="3" x2="14" y2="21"/>',
        volume: '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>',
        megaphone: '<path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>',
        forum: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
        thread: '<path d="M4 4v10a4 4 0 0 0 4 4h12"/><polyline points="16 14 20 18 16 22"/>',
        chevronDown: '<polyline points="6 9 12 15 18 9"/>',
        chevronRight: '<polyline points="9 18 15 12 9 6"/>',
        plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
        x: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
        minus: '<line x1="5" y1="12" x2="19" y2="12"/>',
        square: '<rect x="5" y="5" width="14" height="14" rx="1"/>',
        restore: '<rect x="8" y="8" width="11" height="11" rx="1"/><path d="M5 15V6a1 1 0 0 1 1-1h9"/>',
        fullscreen: '<path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>',
        send: '<line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>',
        paperclip: '<path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>',
        smile: '<circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/>',
        reply: '<polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/>',
        pencil: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/>',
        trash: '<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>',
        pin: '<line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24z"/>',
        users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
        user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
        settings: '<line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/>',
        home: '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
        search: '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
        ban: '<circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>',
        clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
        link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
        file: '<path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/>',
        power: '<path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/>',
        more: '<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>',
        logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>',
        refresh: '<polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>',
        bot: '<rect x="3" y="8" width="18" height="12" rx="2"/><path d="M12 8V4"/><circle cx="12" cy="3" r="1"/><line x1="8" y1="14" x2="8.01" y2="14"/><line x1="16" y1="14" x2="16.01" y2="14"/>',
        shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
        image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>',
        external: '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>',
        check: '<polyline points="20 6 9 17 4 12"/>',
        copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
        activity: '<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>',
        server: '<rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/>',
        lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    };

    const icon = (name, size = 18) =>
        `<svg class="ic" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${PATHS[name] || ""}</svg>`;

    const kindIcon = kind => ({ text: "hash", announcement: "megaphone", voice: "volume", stage: "volume", forum: "forum", thread: "thread" }[kind] || "hash");

    // ------------------------------------------------------------------ markdown
    // ctx: { users: {id: name}, roles: {id: {name, color}}, channels: {id: name} }
    function md(src, ctx = {}) {
        let t = String(src ?? "");
        const blocks = [];
        const inlines = [];
        t = t.replace(/```(?:[a-z0-9+#-]+\n)?([\s\S]*?)```/gi, (_m, c) => { blocks.push(c.replace(/^\n|\n$/g, "")); return `\u0000B${blocks.length - 1}\u0000`; });
        // Blok kode tampil sebagai elemen blok, jadi newline di sekelilingnya hanya akan menambah baris kosong.
        t = t.replace(/\n?(\u0000B\d+\u0000)\n?/g, "$1");
        t = t.replace(/`([^`\n]+)`/g, (_m, c) => { inlines.push(c); return `\u0000I${inlines.length - 1}\u0000`; });
        t = esc(t);

        // Mention, emoji, dan link disimpan sebagai placeholder supaya sintaks markdown tidak merusak HTML-nya.
        const stash = [];
        const keep = html => { stash.push(html); return `\u0000S${stash.length - 1}\u0000`; };

        // Link dulu: URL custom emoji yang disisipkan setelahnya tidak boleh ikut terdeteksi sebagai link.
        t = t.replace(/https?:\/\/[^\s<>]+/g, m => {
            let url = m, tail = "";
            let hit;
            while ((hit = url.match(/(&gt;|&quot;|&#39;|[.,;:!?)\]])$/))) { tail = hit[0] + tail; url = url.slice(0, -hit[0].length); }
            return keep(`<a href="#" class="link" data-url="${url}">${url}</a>`) + tail;
        });

        const name = (map, id, fallback) => (map && map[id] !== undefined ? map[id] : fallback);
        t = t.replace(/&lt;@!?(\d+)&gt;/g, (_m, id) => keep(`<span class="mention">@${esc(name(ctx.users, id, "unknown-user"))}</span>`));
        t = t.replace(/&lt;@&amp;(\d+)&gt;/g, (_m, id) => {
            const r = ctx.roles && ctx.roles[id];
            const style = r && r.color ? ` style="color:${r.color};background:${r.color}22"` : "";
            return keep(`<span class="mention"${style}>@${esc(r ? r.name : "role")}</span>`);
        });
        t = t.replace(/&lt;#(\d+)&gt;/g, (_m, id) => keep(`<span class="mention">#${esc(name(ctx.channels, id, "channel"))}</span>`));
        t = t.replace(/&lt;(a?):(\w+):(\d+)&gt;/g, (_m, anim, n, id) =>
            keep(`<img class="emoji" alt=":${n}:" title=":${n}:" src="https://cdn.discordapp.com/emojis/${id}.${anim ? "gif" : "webp"}?size=48">`));
        t = t.replace(/@(everyone|here)\b/g, (_m, w) => keep(`<span class="mention">@${w}</span>`));

        t = t.replace(/\*\*([\s\S]+?)\*\*/g, "<b>$1</b>");
        t = t.replace(/__([\s\S]+?)__/g, "<u>$1</u>");
        t = t.replace(/(^|[^\w*])\*(?!\s)([^*\n]+?)\*(?!\w)/g, "$1<i>$2</i>");
        t = t.replace(/(^|[^\w])_(?!\s)([^_\n]+?)_(?!\w)/g, "$1<i>$2</i>");
        t = t.replace(/~~([\s\S]+?)~~/g, "<s>$1</s>");
        t = t.replace(/\|\|([\s\S]+?)\|\|/g, '<span class="spoiler">$1</span>');

        // Quote, heading, dan list diproses per baris. Elemen blok tidak diberi newline tambahan.
        const lines = t.split("\n");
        let out = "";
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            let html = line, block = false;
            let m;
            if ((m = line.match(/^&gt; ?(.*)$/))) { html = `<div class="quote">${m[1]}</div>`; block = true; }
            else if ((m = line.match(/^(#{1,3}) (.+)$/))) { html = `<div class="h h${m[1].length}">${m[2]}</div>`; block = true; }
            else if ((m = line.match(/^[-*] (.+)$/))) { html = `<div class="li">• ${m[1]}</div>`; block = true; }
            out += html;
            if (!block && i < lines.length - 1 && !(lines[i + 1] || "").match(/^(&gt; |#{1,3} |[-*] )/)) out += "\n";
            else if (!block && i < lines.length - 1) out += "";
        }

        out = out.replace(/\u0000S(\d+)\u0000/g, (_m, i) => stash[i]);
        out = out.replace(/\u0000I(\d+)\u0000/g, (_m, i) => `<code>${esc(inlines[i])}</code>`);
        out = out.replace(/\u0000B(\d+)\u0000/g, (_m, i) => `<pre><code>${esc(blocks[i])}</code></pre>`);
        return out;
    }

    // ------------------------------------------------------------------ format
    const pad = n => String(n).padStart(2, "0");
    const time = ts => { const d = new Date(ts); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
    const date = ts => new Date(ts).toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" });
    const full = ts => new Date(ts).toLocaleString();
    const dayKey = ts => { const d = new Date(ts); return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; };
    const stamp = ts => {
        const d = new Date(ts), now = new Date();
        if (dayKey(ts) === dayKey(now.getTime())) return "Today at " + time(ts);
        const y = new Date(now.getTime() - 86400000);
        if (dayKey(ts) === dayKey(y.getTime())) return "Yesterday at " + time(ts);
        return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${time(ts)}`;
    };
    const ago = ts => {
        const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
        if (s < 60) return "just now";
        if (s < 3600) return Math.floor(s / 60) + "m ago";
        if (s < 86400) return Math.floor(s / 3600) + "h ago";
        return Math.floor(s / 86400) + "d ago";
    };
    const duration = ms => {
        const s = Math.floor(ms / 1000), d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60);
        return d ? `${d}d ${h}h` : h ? `${h}h ${m}m` : `${m}m ${s % 60}s`;
    };
    const bytes = n => (n < 1024 ? n + " B" : n < 1048576 ? (n / 1024).toFixed(1) + " KB" : (n / 1048576).toFixed(1) + " MB");
    const initials = name => String(name || "?").split(/\s+/).map(w => w[0]).join("").slice(0, 3).toUpperCase();
    const colorHex = n => (typeof n === "number" ? "#" + n.toString(16).padStart(6, "0") : n || "#ff9132");

    return { esc, icon, kindIcon, md, time, date, full, dayKey, stamp, ago, duration, bytes, initials, colorHex };
})();
