// Setup server Discord Mugiwara HUB (v2). Aman dijalankan ulang: yang sudah ada di-rename, dipindah, dan disinkronkan, bukan digandakan.
require("dotenv").config();
const {
    Client, GatewayIntentBits, ChannelType: T, PermissionFlagsBits: P, EmbedBuilder, Routes,
} = require("discord.js");

const TOKEN = process.env.DISCORD_TOKEN;
const GUILD_ID = process.env.GUILD_ID;
if (!TOKEN || !GUILD_ID) {
    console.error("Isi DISCORD_TOKEN dan GUILD_ID di file .env dulu.");
    process.exit(1);
}

const ACCENT = 0xff9132;
const DESCRIPTION = "Mugiwara HUB - Roblox script hub with Evade features and universal tools.";

// ---------------------------------------------------------------- roles (atas ke bawah)
const ROLES = [
    { key: "owner", old: ["owner"], name: "👑 Owner", color: 0xff9132, hoist: true, perms: [P.Administrator] },
    { key: "developer", old: ["developer"], name: "🛠️ Developer", color: 0xff6b35, hoist: true, perms: [P.ManageMessages, P.ManageThreads, P.ModerateMembers, P.ViewAuditLog] },
    { key: "moderator", old: ["moderator"], name: "🛡️ Moderator", color: 0xffbe6e, hoist: true, perms: [P.ManageMessages, P.ManageThreads, P.KickMembers, P.BanMembers, P.ModerateMembers, P.ManageNicknames, P.MuteMembers, P.MoveMembers, P.ViewAuditLog] },
    { key: "premium", old: ["premium"], name: "💎 Premium", color: 0xffdc82, hoist: true, perms: [] },
    { key: "tester", old: ["tester"], name: "🧪 Tester", color: 0x7fd1ae, hoist: false, perms: [] },
    { key: "member", old: ["member"], name: "✅ Member", color: 0x99aab5, hoist: false, perms: [] },
];

// Izin dasar @everyone: member biasa bisa ngobrol, bikin thread, dan voice. Tanpa mention @everyone.
const EVERYONE_PERMS = [
    P.ViewChannel, P.SendMessages, P.SendMessagesInThreads, P.CreatePublicThreads, P.EmbedLinks, P.AttachFiles,
    P.AddReactions, P.UseExternalEmojis, P.ReadMessageHistory, P.Connect, P.Speak, P.UseVAD, P.Stream,
    P.UseApplicationCommands, P.ChangeNickname,
];

// ---------------------------------------------------------------- layout
// kind: text | announcement | forum | voice
// access: public | readonly | premium | tester | staff
const LAYOUT = [
    { label: "START HERE", emoji: "📌", old: ["info"], channels: [
        { emoji: "👋", key: "welcome", kind: "text", access: "readonly", topic: "Welcome to Mugiwara HUB" },
        { emoji: "📜", key: "rules", kind: "text", access: "readonly", topic: "Read before you chat" },
        { emoji: "📢", key: "announcements", kind: "announcement", access: "readonly", topic: "Official announcements" },
        { emoji: "❓", key: "faq", kind: "text", access: "readonly", topic: "Frequently asked questions" },
        { emoji: "🎭", key: "roles-info", kind: "text", access: "readonly", topic: "What each role means" },
    ]},
    { label: "SCRIPT", emoji: "📦", old: [], channels: [
        { emoji: "🚀", key: "get-script", kind: "text", access: "readonly", topic: "Latest loader" },
        { emoji: "📝", key: "changelog", kind: "announcement", access: "readonly", topic: "Feature updates and bug fixes" },
        { emoji: "🎮", key: "supported-games", kind: "text", access: "readonly", topic: "Games and features" },
        { emoji: "🧰", key: "executor-guide", kind: "text", access: "readonly", topic: "Executor requirements and tips" },
        { emoji: "🚨", key: "risk-warnings", kind: "text", access: "readonly", topic: "Features that can get you banned" },
    ]},
    // Panel dibuat oleh bot lain (Panda Auth Core Bot dan Ticket Tool); channel dibiarkan read-only untuk member.
    { label: "STORE", emoji: "🛒", old: [], channels: [
        { emoji: "🔓", key: "redeem", kind: "text", access: "readonly", topic: "Redeem your key, reset your HWID, and get your script with the buttons below" },
        { emoji: "🎫", key: "open-ticket", kind: "text", access: "readonly", topic: "Open a ticket to buy a key" },
    ]},
    { label: "COMMUNITY", emoji: "💬", old: ["textchannels"], channels: [
        { emoji: "💬", key: "general", kind: "text", access: "public", topic: "Chat about anything" },
        { emoji: "📸", key: "showcase", kind: "text", access: "public", topic: "Show your setup, Lighting presets, and Korless results" },
        { emoji: "🎨", key: "presets", kind: "text", access: "public", topic: "Share Lighting presets and skyboxes" },
        { emoji: "🏃", key: "evade-chat", kind: "text", access: "public", topic: "Talk about Evade" },
        { emoji: "🎬", key: "clips", kind: "text", access: "public", topic: "Clips and videos" },
        { emoji: "😂", key: "memes", kind: "text", access: "public", topic: "Off-topic and memes" },
    ]},
    { label: "SUPPORT", emoji: "🆘", old: [], channels: [
        { emoji: "🆘", key: "support", kind: "forum", access: "public", topic: "One post per question. Include your executor and what you tried.",
          tags: [["Open", "🟢"], ["Need Info", "❔"], ["Solved", "✅"]] },
        { emoji: "🐛", key: "bug-report", kind: "forum", access: "public", topic: "Include the executor, the game, and the console error message.",
          tags: [["Open", "🟢"], ["Need Info", "❔"], ["Fixed", "✅"], ["Won't Fix", "🚫"]] },
        { emoji: "💡", key: "suggestions", kind: "forum", access: "public", topic: "One idea per post.",
          tags: [["Open", "🟢"], ["Planned", "📌"], ["Done", "✅"], ["Rejected", "🚫"]] },
        { emoji: "🔑", key: "key-help", kind: "text", access: "public", topic: "Problems with your key or key validation" },
        { emoji: "🧪", key: "beta-testing", kind: "text", access: "tester", topic: "Feedback for the dev branch" },
    ]},
    { label: "PREMIUM", emoji: "💎", old: [], channels: [
        { emoji: "💎", key: "premium-chat", kind: "text", access: "premium" },
        { emoji: "🔔", key: "premium-updates", kind: "text", access: "premium" },
        { emoji: "🛟", key: "premium-support", kind: "text", access: "premium", topic: "Priority support" },
    ]},
    { label: "VOICE", emoji: "🔊", old: ["voicechannels"], channels: [
        { emoji: "🔊", key: "Lounge", kind: "voice", access: "public", old: ["general"] },
        { emoji: "🎮", key: "Gaming 1", kind: "voice", access: "public" },
        { emoji: "🎮", key: "Gaming 2", kind: "voice", access: "public" },
        { emoji: "💤", key: "AFK", kind: "voice", access: "public" },
    ]},
    // Kategori tujuan channel tiket; Ticket Tool membuat channel per tiket di sini.
    { label: "TICKETS", emoji: "🎫", old: [], channels: [
        { emoji: "📑", key: "ticket-logs", kind: "text", access: "staff", topic: "Ticket transcripts" },
    ]},
    { label: "STAFF", emoji: "🛡️", old: [], channels: [
        { emoji: "💼", key: "staff-chat", kind: "text", access: "staff" },
        { emoji: "📋", key: "mod-log", kind: "text", access: "staff" },
        { emoji: "🔧", key: "dev-notes", kind: "text", access: "staff", topic: "Internal notes: commits, plans, bugs" },
        { emoji: "🤖", key: "bot-commands", kind: "text", access: "staff" },
        { emoji: "📡", key: "discord-updates", kind: "text", access: "staff", topic: "Discord community updates" },
    ]},
];

// ---------------------------------------------------------------- helpers
const base = s => String(s).toLowerCase().replace(/[^a-z0-9]/g, "");
const isTextLike = c => c.type === T.GuildText || c.type === T.GuildAnnouncement;
const kindOk = (c, kind) =>
    (kind === "text" || kind === "announcement") ? isTextLike(c)
    : kind === "forum" ? c.type === T.GuildForum
    : c.type === T.GuildVoice;
const channelName = d => d.kind === "voice" ? `${d.emoji}┃${d.key}` : `${d.emoji}┃${d.key}`;
const categoryName = c => `━━━ ${c.emoji} ${c.label} ━━━`;

async function step(label, fn) {
    try {
        const r = await fn();
        console.log("OK  ", label);
        return r;
    } catch (err) {
        console.error("GAGAL", label, "-", err.message);
        return null;
    }
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once("clientReady", async () => {
    try {
        const guild = await client.guilds.fetch(GUILD_ID);
        await guild.roles.fetch();
        await guild.channels.fetch();
        const me = await guild.members.fetchMe();
        const everyone = guild.roles.everyone;

        // ------------------------------------------------ roles
        const roles = {};
        for (const def of ROLES) {
            await step(`role ${def.name}`, async () => {
                let role = guild.roles.cache.find(r => def.old.includes(base(r.name)) || base(r.name) === base(def.name));
                const data = { name: def.name, colors: { primaryColor: def.color }, hoist: def.hoist, permissions: def.perms, mentionable: false };
                role = role ? await role.edit(data) : await guild.roles.create(data);
                roles[def.key] = role;
            });
        }
        await step("izin dasar @everyone", () => everyone.setPermissions(EVERYONE_PERMS));
        await step("urutan role", async () => {
            await guild.roles.fetch();
            const botRole = (await guild.members.fetchMe()).roles.highest;
            // Role bot lain (Panda Auth, Ticket Tool) ditaruh di atas role hub supaya bisa memberi role Premium.
            const otherBots = [...guild.roles.cache.values()].filter(r => r.managed && r.id !== botRole.id).sort((a, b) => b.position - a.position);
            const ordered = [...otherBots, ...ROLES.map(r => guild.roles.cache.get(roles[r.key]?.id)).filter(Boolean)];
            // Satu per satu dari role teratas, tiap role ditaruh tepat di bawah role sebelumnya.
            for (let i = 0; i < ordered.length; i++) {
                await ordered[i].setPosition(Math.max(1, botRole.position - 1 - i));
            }
        });

        const staff = [roles.owner, roles.developer, roles.moderator].filter(Boolean);
        const view = [P.ViewChannel, P.ReadMessageHistory];
        const talk = [P.SendMessages, P.SendMessagesInThreads, P.CreatePublicThreads, P.AddReactions, P.AttachFiles, P.EmbedLinks];

        function overwrites(def) {
            // Role bot (Panda Auth, Ticket Tool, dan seterusnya) ikut diberi akses, supaya tetap bisa posting
            // di channel read-only dan di channel yang disembunyikan dari @everyone.
            const bots = [...guild.roles.cache.values()].filter(r => r.managed);
            const staffAllow = [...staff, ...bots].map(r => ({ id: r.id, allow: def.kind === "voice" ? [...view, P.Connect, P.Speak, P.MoveMembers, P.MuteMembers] : [...view, ...talk, P.ManageThreads, P.ManageMessages] }));
            switch (def.access) {
                case "readonly":
                    return [{ id: everyone.id, allow: view, deny: [P.SendMessages, P.SendMessagesInThreads, P.CreatePublicThreads, P.CreatePrivateThreads] }, ...staffAllow];
                case "premium":
                    return [{ id: everyone.id, deny: [P.ViewChannel] }, { id: roles.premium.id, allow: [...view, ...talk] }, ...staffAllow];
                case "tester":
                    return [{ id: everyone.id, deny: [P.ViewChannel] }, { id: roles.tester.id, allow: [...view, ...talk] }, ...staffAllow];
                case "staff":
                    return [{ id: everyone.id, deny: [P.ViewChannel] }, ...staffAllow];
                default:
                    return staffAllow;
            }
        }

        // ------------------------------------------------ kategori + channel non-forum
        const cats = [];
        const chans = {};
        const pendingForums = [];
        const pendingAnnouncements = [];

        for (const block of LAYOUT) {
            const cat = await step(`kategori ${block.label}`, async () => {
                const name = categoryName(block);
                let c = guild.channels.cache.find(x => x.type === T.GuildCategory && (base(x.name) === base(block.label) || block.old.includes(base(x.name))));
                c = c ? await c.setName(name) : await guild.channels.create({ name, type: T.GuildCategory });
                return c;
            });
            if (!cat) continue;
            cats.push({ cat, block });

            for (const def of block.channels) {
                const fullName = channelName(def);
                await step(`channel ${fullName}`, async () => {
                    const wanted = [base(def.key), ...(def.old || [])];
                    let ch = guild.channels.cache.find(x => x.type !== T.GuildCategory && wanted.includes(base(x.name)) && (def.kind === "forum" ? true : kindOk(x, def.kind)));

                    if (def.kind === "forum") {
                        // Text channel lama tidak bisa diubah jadi forum, dan masih kosong: hapus lalu buat forum nanti.
                        if (ch && ch.type === T.GuildText) { await ch.delete(); ch = null; }
                        pendingForums.push({ def, cat, ch });
                        return;
                    }

                    const options = { name: fullName, parent: cat.id, permissionOverwrites: overwrites(def) };
                    if (def.kind === "voice") {
                        options.type = T.GuildVoice;
                    } else {
                        options.type = T.GuildText;
                        if (def.topic) options.topic = def.topic;
                    }

                    if (ch) {
                        await ch.edit({ name: fullName, parent: cat.id, lockPermissions: false, ...(options.topic ? { topic: options.topic } : {}) });
                        await ch.permissionOverwrites.set(overwrites(def));
                    } else {
                        ch = await guild.channels.create(options);
                    }
                    chans[def.key] = ch;
                    if (def.kind === "announcement") pendingAnnouncements.push(ch);
                });
            }
        }

        // ------------------------------------------------ Community (butuh rules + updates channel)
        await step("aktifkan mode Community", async () => {
            const features = new Set(guild.features);
            features.add("COMMUNITY");
            await client.rest.patch(Routes.guild(guild.id), { body: {
                features: [...features],
                rules_channel_id: chans["rules"].id,
                public_updates_channel_id: chans["discord-updates"].id,
                verification_level: 2,
                explicit_content_filter: 2,
                default_message_notifications: 1,
                preferred_locale: "en-US",
                description: DESCRIPTION,
            }});
        });
        await guild.fetch();

        // ------------------------------------------------ announcement + forum (butuh Community)
        for (const ch of pendingAnnouncements) {
            await step(`announcement ${ch.name}`, () => ch.setType(T.GuildAnnouncement));
        }
        for (const { def, cat, ch } of pendingForums) {
            await step(`forum ${channelName(def)}`, async () => {
                const tags = def.tags.map(([name, emoji]) => ({ name, emoji: { id: null, name: emoji }, moderated: false }));
                let forum = ch;
                if (forum) {
                    await forum.edit({ name: channelName(def), parent: cat.id, topic: def.topic, lockPermissions: false });
                    await forum.setAvailableTags(tags);
                    await forum.permissionOverwrites.set(overwrites(def));
                } else {
                    forum = await guild.channels.create({
                        name: channelName(def), type: T.GuildForum, parent: cat.id, topic: def.topic,
                        availableTags: tags, defaultReactionEmoji: { id: null, name: "👍" },
                        permissionOverwrites: overwrites(def),
                    });
                }
                chans[def.key] = forum;
            });
        }

        // ------------------------------------------------ pengaturan server
        await step("AFK voice + channel sistem", () => guild.edit({
            afkChannel: chans["AFK"]?.id ?? null,
            afkTimeout: 300,
            systemChannel: chans["general"]?.id ?? null,
        }));

        await step("urutan kategori dan channel", async () => {
            await guild.channels.setPositions(cats.map(({ cat }, i) => ({ channel: cat.id, position: i })));
            for (const { block } of cats) {
                const list = block.channels.map((def, j) => chans[def.key] && { channel: chans[def.key].id, position: j }).filter(Boolean);
                if (list.length) await guild.channels.setPositions(list);
            }
        });

        await step("hapus kategori bawaan yang kosong", async () => {
            await guild.channels.fetch();
            for (const c of guild.channels.cache.values()) {
                if (c.type === T.GuildCategory && ["textchannels", "voicechannels"].includes(base(c.name))
                    && !guild.channels.cache.some(x => x.parentId === c.id)) await c.delete();
            }
        });

        // ------------------------------------------------ pesan di channel info
        const mention = key => chans[key] ? `<#${chans[key].id}>` : `#${key}`;
        const embed = (title, description, fields) => {
            const e = new EmbedBuilder().setColor(ACCENT).setTitle(title).setFooter({ text: "Mugiwara HUB" });
            if (description) e.setDescription(description);
            if (fields) e.addFields(fields);
            return e;
        };

        const CONTENT = {
            "welcome": [embed("👋 Welcome to Mugiwara HUB",
                "A Roblox script hub with extra tools for **Evade** and universal features such as Lighting, Korless Visual, and movement.",
                [
                    { name: "📜 Start here", value: `Read ${mention("rules")} and ${mention("faq")}.` },
                    { name: "🚀 Get the script", value: `Find the latest loader in ${mention("get-script")}.` },
                    { name: "🆘 Need help?", value: `Open a post in ${mention("support")}, or ${mention("key-help")} for key problems.` },
                ])],
            "rules": [embed("📜 Server Rules", [
                "**1. Be respectful.** No harassment, hate speech, or personal attacks.",
                "**2. No spam or ads.** This includes self-promotion, invite links, and mass mentions.",
                "**3. Keep it SFW.** No NSFW or disturbing content.",
                "**4. Use the right channel.** Bugs go to bug-report and ideas go to suggestions.",
                "**5. No leaking or reselling.** Never share, trade, or sell Premium keys or script source.",
                "**6. Use at your own risk.** Scripts can get your Roblox account banned. Features marked HIGH RISK are the most likely cause, and staff cannot restore banned accounts.",
                "**7. Follow the Discord and Roblox Terms of Service.**",
                "",
                "Staff decisions are final. Breaking the rules can lead to a mute, kick, or ban.",
            ].join("\n"))],
            "faq": [embed("❓ FAQ", null, [
                { name: "What is Mugiwara HUB?", value: "A script hub with tools for Evade and other Roblox games." },
                { name: "How do I run it?", value: `Copy the loader from ${mention("get-script")} and run it in your executor.` },
                { name: "Which executors work?", value: `The executor must support \`loadstring\`, \`game:HttpGet\`, and \`getgenv\`. See ${mention("executor-guide")}.` },
                { name: "Can I get banned?", value: `Yes. Read ${mention("risk-warnings")} before you enable movement or farming features.` },
                { name: "My key does not work.", value: `Post in ${mention("key-help")} with the exact error message and your executor.` },
                { name: "Found a bug?", value: `Open a post in ${mention("bug-report")} with the executor, the game, and the console error.` },
            ])],
            "roles-info": [embed("🎭 Roles", null, [
                { name: "👑 Owner", value: "Runs the hub and the server." },
                { name: "🛠️ Developer", value: "Builds and maintains the script." },
                { name: "🛡️ Moderator", value: "Keeps the server safe and answers support." },
                { name: "💎 Premium", value: "Access to Premium features and the Premium channels." },
                { name: "🧪 Tester", value: "Tests new features from the dev branch before release." },
                { name: "✅ Member", value: "Regular community member." },
            ])],
            "get-script": [embed("🚀 Loader", "The latest loader line is posted here by staff after each release.\nIf you run into trouble, see " + mention("executor-guide") + " or " + mention("key-help") + ".")],
            "supported-games": [embed("🎮 Supported Games", null, [
                { name: "Evade", value: "AFK Farm and Auto Commands (needs VIP Commands access or a server you own), Halloween ticket farm, avatar and accessory tools, Korblox and Headless, movement." },
                { name: "Universal", value: "Lighting presets, volumetric clouds, Hide Sun, Korless Visual, cursor control, and movement tools." },
                { name: "Premium", value: "Some features are Premium only and show a lock in the menu." },
            ])],
            "executor-guide": [embed("🧰 Executor Guide", [
                "Your executor needs to support:",
                "• `loadstring` and `game:HttpGet`",
                "• `getgenv`",
                "• `queue_on_teleport` (for auto-execute after a server hop)",
                "",
                "Tips:",
                "• Run the loader once. Re-executing is safe, the hub cleans up the old session first.",
                "• If the menu stays empty or errors, copy the console output into " + mention("bug-report") + ".",
            ].join("\n"))],
            "risk-warnings": [embed("🚨 Risk Warnings",
                "These features change your character on the server side and are the most likely to be flagged. They are marked **[HIGH RISK]** in the menu.",
                [
                    { name: "Movement", value: "Speed Hack, Tween Speed, Jump Power, Infinite Jump, Fly, Noclip" },
                    { name: "Evade", value: "AFK Farm, Auto Execute, Auto Farm Tickets, Avoid NextBots" },
                    { name: "Safe (client-side only)", value: "Lighting, Hide Sun, Clouds, Korless Visual, and other visual tools only change what you see." },
                    { name: "Reminder", value: "No script is risk-free. Use an alt account if you are unsure." },
                ])],
        };

        for (const [key, embeds] of Object.entries(CONTENT)) {
            const ch = chans[key];
            if (!ch) continue;
            await step(`pesan #${key}`, async () => {
                const recent = await ch.messages.fetch({ limit: 50 });
                for (const m of recent.values()) if (m.author.id === client.user.id) await m.delete();
                await ch.send({ embeds });
            });
        }

        console.log("Selesai.");
    } catch (err) {
        console.error("Gagal:", err);
    } finally {
        client.destroy();
    }
});

client.login(TOKEN);
