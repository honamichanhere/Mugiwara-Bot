// Panel lokal untuk mengirim pesan dan embed lewat bot. Hanya listen di 127.0.0.1 dan butuh token sesi di URL.
require("dotenv").config();
const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { REST, Routes, ChannelType } = require("discord.js");

const TOKEN = process.env.DISCORD_TOKEN;
const GUILD_ID = process.env.GUILD_ID;
if (!TOKEN || !GUILD_ID) {
    console.error("Isi DISCORD_TOKEN dan GUILD_ID di file .env dulu.");
    process.exit(1);
}

const PORT = Number(process.env.PANEL_PORT) || 3210;
const SESSION = crypto.randomBytes(16).toString("hex");
const rest = new REST({ version: "10" }).setToken(TOKEN);

const SENDABLE = new Set([ChannelType.GuildText, ChannelType.GuildAnnouncement]);

function json(res, status, body) {
    res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify(body));
}

function readBody(req) {
    return new Promise((resolve, reject) => {
        let data = "";
        req.on("data", chunk => { data += chunk; if (data.length > 200000) { reject(new Error("Body terlalu besar")); req.destroy(); } });
        req.on("end", () => resolve(data));
        req.on("error", reject);
    });
}

async function listChannels() {
    const all = await rest.get(Routes.guildChannels(GUILD_ID));
    const cats = new Map(all.filter(c => c.type === ChannelType.GuildCategory).map(c => [c.id, c]));
    return all
        .filter(c => SENDABLE.has(c.type))
        .sort((a, b) => ((cats.get(a.parent_id)?.position ?? -1) - (cats.get(b.parent_id)?.position ?? -1)) || a.position - b.position)
        .map(c => ({ id: c.id, name: c.name, category: cats.get(c.parent_id)?.name || "" }));
}

const server = http.createServer(async (req, res) => {
    try {
        const url = new URL(req.url, `http://${req.headers.host}`);
        const hostOk = [`127.0.0.1:${PORT}`, `localhost:${PORT}`].includes(req.headers.host);
        if (!hostOk) return json(res, 403, { error: "Host tidak diizinkan" });

        if (req.method === "GET" && url.pathname === "/") {
            if (url.searchParams.get("t") !== SESSION) {
                res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
                return res.end("Buka panel lewat link yang ditampilkan di terminal.");
            }
            const html = fs.readFileSync(path.join(__dirname, "panel.html"), "utf8").replace("__SESSION__", SESSION);
            res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
            return res.end(html);
        }

        if (req.headers["x-session"] !== SESSION) return json(res, 403, { error: "Sesi tidak valid" });

        if (req.method === "GET" && url.pathname === "/api/channels") {
            return json(res, 200, await listChannels());
        }

        if (req.method === "POST" && url.pathname === "/api/send") {
            const { channelId, content, embeds, allowPings } = JSON.parse(await readBody(req));
            if (!/^\d{5,25}$/.test(String(channelId))) return json(res, 400, { error: "Channel tidak valid" });
            if (!content && !(embeds && embeds.length)) return json(res, 400, { error: "Pesan kosong" });
            const msg = await rest.post(Routes.channelMessages(channelId), { body: {
                content: content || undefined,
                embeds: embeds && embeds.length ? embeds : undefined,
                allowed_mentions: { parse: allowPings ? ["roles", "users", "everyone"] : [] },
            }});
            return json(res, 200, { id: msg.id, url: `https://discord.com/channels/${GUILD_ID}/${channelId}/${msg.id}` });
        }

        json(res, 404, { error: "Tidak ditemukan" });
    } catch (err) {
        json(res, 500, { error: err.message });
    }
});

server.listen(PORT, "127.0.0.1", () => {
    console.log("Panel siap. Buka link ini di browser:");
    console.log(`  http://127.0.0.1:${PORT}/?t=${SESSION}`);
    console.log("Tekan Ctrl+C untuk menutup panel.");
});
