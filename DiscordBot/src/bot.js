"use strict";
// Semua logika Discord ada di sini. Renderer tidak pernah memegang token atau objek discord.js,
// hanya data JSON hasil serialisasi dari fungsi-fungsi di bawah.
const EventEmitter = require("events");
const {
    Client, Events, GatewayIntentBits: I, Partials, ChannelType: T, ActivityType, PermissionFlagsBits: P,
} = require("discord.js");

const KIND = new Map([
    [T.GuildText, "text"], [T.GuildAnnouncement, "announcement"], [T.GuildVoice, "voice"],
    [T.GuildStageVoice, "stage"], [T.GuildCategory, "category"], [T.GuildForum, "forum"],
    [T.PublicThread, "thread"], [T.PrivateThread, "thread"], [T.AnnouncementThread, "thread"],
]);
if (T.GuildMedia !== undefined) KIND.set(T.GuildMedia, "forum");

const CREATE_TYPES = {
    text: T.GuildText, announcement: T.GuildAnnouncement, voice: T.GuildVoice,
    forum: T.GuildForum, category: T.GuildCategory, stage: T.GuildStageVoice,
};

const hex = n => (n ? "#" + n.toString(16).padStart(6, "0") : null);

class Bot extends EventEmitter {
    constructor() {
        super();
        this.client = null;
        this.state = "offline";
        this.user = null;
        this.error = null;
        this.startedAt = null;
        this.limited = { content: false, members: false };
        this.logs = [];
    }

    log(level, text) {
        const entry = { time: Date.now(), level, text };
        this.logs.push(entry);
        if (this.logs.length > 500) this.logs.shift();
        this.emit("log", entry);
    }

    status() {
        return {
            state: this.state, user: this.user, error: this.error, startedAt: this.startedAt,
            limited: this.limited, ping: this.client && this.client.ws ? this.client.ws.ping : null,
        };
    }

    setState(state, error = null) {
        this.state = state;
        this.error = error;
        this.emit("status", this.status());
    }

    // ------------------------------------------------------------------ koneksi
    async connect(token, presence) {
        await this.disconnect();
        this.setState("connecting");
        this.limited = { content: false, members: false };
        let privileged = true;

        for (let attempt = 0; attempt < 2; attempt++) {
            const intents = [I.Guilds, I.GuildMessages, I.GuildMessageReactions, I.DirectMessages];
            if (privileged) intents.push(I.MessageContent, I.GuildMembers);
            const client = new Client({ intents, partials: [Partials.Channel, Partials.Message, Partials.Reaction] });
            this.bind(client);
            try {
                const ready = new Promise(resolve => client.once(Events.ClientReady, resolve));
                await client.login(token);
                await ready;
                this.client = client;
                this.limited = { content: !privileged, members: !privileged };
                this.user = this.serializeUser(client.user);
                this.startedAt = Date.now();
                if (presence) this.setPresence(presence);
                this.log("info", `Connected as ${client.user.tag} in ${client.guilds.cache.size} server(s)` + (privileged ? "" : " (limited: privileged intents are off)"));
                this.setState("online");
                return this.status();
            } catch (err) {
                client.removeAllListeners();
                try { await client.destroy(); } catch { /* sudah mati */ }
                const intentError = /intent/i.test(err.message) || err.code === "DisallowedIntents";
                if (privileged && intentError) {
                    this.log("warn", "Privileged intents are not enabled in the Developer Portal. Retrying in limited mode.");
                    privileged = false;
                    continue;
                }
                this.log("error", "Connection failed: " + err.message);
                this.setState("error", err.message);
                throw err;
            }
        }
    }

    async disconnect() {
        if (this.client) {
            const c = this.client;
            this.client = null;
            c.removeAllListeners();
            try { await c.destroy(); } catch { /* abaikan */ }
            this.log("info", "Disconnected");
        }
        this.user = null;
        this.startedAt = null;
        if (this.state !== "offline") this.setState("offline");
    }

    bind(client) {
        const ev = payload => this.emit("event", payload);
        client.on(Events.Error, err => this.log("error", err.message));
        client.on(Events.Warn, msg => this.log("warn", String(msg)));
        client.on(Events.ShardDisconnect, () => this.log("warn", "Gateway disconnected, reconnecting..."));
        client.on(Events.ShardResume, () => this.log("info", "Gateway resumed"));

        client.on(Events.MessageCreate, m => ev({ type: "messageCreate", message: this.serializeMessage(m) }));
        client.on(Events.MessageUpdate, async (_old, m) => {
            try { if (m.partial) m = await m.fetch(); ev({ type: "messageUpdate", message: this.serializeMessage(m) }); } catch { /* pesan sudah hilang */ }
        });
        client.on(Events.MessageDelete, m => ev({ type: "messageDelete", id: m.id, channelId: m.channelId }));
        client.on(Events.MessageBulkDelete, ms => ms.forEach(m => ev({ type: "messageDelete", id: m.id, channelId: m.channelId })));
        const reaction = async r => {
            try {
                const m = r.message.partial ? await r.message.fetch() : r.message;
                ev({ type: "messageUpdate", message: this.serializeMessage(m) });
            } catch { /* abaikan */ }
        };
        client.on(Events.MessageReactionAdd, reaction);
        client.on(Events.MessageReactionRemove, reaction);

        const guildChange = guildId => guildId && ev({ type: "guildChange", guildId });
        for (const name of [Events.ChannelCreate, Events.ChannelDelete, Events.ChannelUpdate, Events.ThreadCreate, Events.ThreadDelete, Events.ThreadUpdate]) {
            client.on(name, c => guildChange((c.guild && c.guild.id) || (c.guildId)));
        }
        for (const name of [Events.GuildRoleCreate, Events.GuildRoleDelete, Events.GuildRoleUpdate]) {
            client.on(name, r => ev({ type: "memberChange", guildId: r.guild.id }));
        }
        client.on(Events.GuildMemberAdd, m => { ev({ type: "memberChange", guildId: m.guild.id }); this.log("info", `${m.user.tag} joined ${m.guild.name}`); });
        client.on(Events.GuildMemberRemove, m => { ev({ type: "memberChange", guildId: m.guild.id }); this.log("info", `${m.user.tag} left ${m.guild.name}`); });
        client.on(Events.GuildMemberUpdate, (_o, m) => ev({ type: "memberChange", guildId: m.guild.id }));
        client.on(Events.GuildCreate, g => { this.log("info", `Joined server ${g.name}`); ev({ type: "guildsChange" }); });
        client.on(Events.GuildDelete, g => { this.log("warn", `Removed from server ${g.name || g.id}`); ev({ type: "guildsChange" }); });
        client.on(Events.GuildUpdate, () => ev({ type: "guildsChange" }));
    }

    // ------------------------------------------------------------------ util
    need() {
        if (!this.client || this.state !== "online") throw new Error("The bot is not connected");
        return this.client;
    }

    guild(id) {
        const g = this.need().guilds.cache.get(id);
        if (!g) throw new Error("Server not found");
        return g;
    }

    async channel(id) {
        const c = await this.need().channels.fetch(id).catch(() => null);
        if (!c) throw new Error("Channel not found");
        return c;
    }

    async textChannel(id) {
        const c = await this.channel(id);
        if (!c.isTextBased()) throw new Error("This channel does not support messages");
        return c;
    }

    serializeUser(u) {
        return {
            id: u.id, username: u.username, tag: u.tag, displayName: u.globalName || u.username,
            avatar: u.displayAvatarURL({ size: 128, extension: "png" }), bot: !!u.bot,
        };
    }

    serializeMember(m) {
        const top = m.roles.color || null;
        return {
            id: m.id, username: m.user.username, displayName: m.displayName, nickname: m.nickname,
            avatar: m.displayAvatarURL({ size: 128, extension: "png" }), bot: !!m.user.bot,
            roles: [...m.roles.cache.keys()].filter(id => id !== m.guild.id),
            hoistRole: m.roles.hoist ? m.roles.hoist.id : null,
            color: top && top.color ? hex(top.color) : null,
            joinedTimestamp: m.joinedTimestamp, timeoutUntil: m.communicationDisabledUntilTimestamp,
        };
    }

    serializeChannel(c) {
        const kind = KIND.get(c.type) || "other";
        return {
            id: c.id, name: c.name, kind, parentId: c.parentId || null, position: c.rawPosition ?? c.position ?? 0,
            topic: c.topic || "", nsfw: !!c.nsfw,
            archived: kind === "thread" ? !!c.archived : undefined,
        };
    }

    serializeMessage(m) {
        const member = m.member;
        const color = member && member.displayHexColor && member.displayHexColor !== "#000000" ? member.displayHexColor : null;
        const client = this.client;
        const users = {};
        m.mentions.users.forEach(u => {
            const mm = m.mentions.members && m.mentions.members.get(u.id);
            users[u.id] = (mm && mm.displayName) || u.globalName || u.username;
        });
        const roles = {};
        m.mentions.roles.forEach(r => { roles[r.id] = { name: r.name, color: hex(r.color) }; });
        const channels = {};
        for (const match of (m.content || "").matchAll(/<#(\d+)>/g)) {
            const c = client && client.channels.cache.get(match[1]);
            channels[match[1]] = c ? c.name : "unknown";
        }

        let reference = null;
        if (m.reference && m.reference.messageId) {
            const ref = m.channel && m.channel.messages ? m.channel.messages.cache.get(m.reference.messageId) : null;
            reference = {
                id: m.reference.messageId,
                author: ref ? (ref.member ? ref.member.displayName : ref.author.globalName || ref.author.username) : null,
                avatar: ref ? ref.author.displayAvatarURL({ size: 32, extension: "png" }) : null,
                content: ref ? (ref.content || (ref.embeds.length ? "[embed]" : ref.attachments.size ? "[attachment]" : "")).slice(0, 140) : null,
            };
        }

        return {
            id: m.id, channelId: m.channelId, guildId: m.guildId || null,
            author: {
                id: m.author.id, name: (member && member.displayName) || m.author.globalName || m.author.username,
                username: m.author.username, avatar: m.author.displayAvatarURL({ size: 64, extension: "png" }),
                bot: !!m.author.bot, color,
            },
            content: m.content || "", timestamp: m.createdTimestamp, edited: m.editedTimestamp,
            pinned: !!m.pinned, system: !!m.system, type: m.type, webhook: !!m.webhookId,
            attachments: [...m.attachments.values()].map(a => ({
                id: a.id, url: a.url, name: a.name, size: a.size, contentType: a.contentType || "", width: a.width, height: a.height,
            })),
            embeds: m.embeds.map(e => e.toJSON()),
            components: (m.components || []).map(row => (row.components || []).map(c => ({
                type: c.type, label: c.label || null, style: c.style, url: c.url || null, disabled: !!c.disabled,
                emoji: c.emoji ? c.emoji.name : null, placeholder: c.placeholder || null,
            }))),
            reactions: [...m.reactions.cache.values()].map(r => ({
                id: r.emoji.id, name: r.emoji.name, animated: !!r.emoji.animated, count: r.count, me: r.me,
                url: r.emoji.id ? `https://cdn.discordapp.com/emojis/${r.emoji.id}.${r.emoji.animated ? "gif" : "webp"}?size=48` : null,
            })),
            stickers: [...m.stickers.values()].map(s => ({ id: s.id, name: s.name, url: s.url })),
            reference, mentions: { users, roles, channels, everyone: !!m.mentions.everyone },
        };
    }

    // ------------------------------------------------------------------ baca data
    async getGuilds() {
        return [...this.need().guilds.cache.values()].map(g => ({
            id: g.id, name: g.name, memberCount: g.memberCount, ownerId: g.ownerId,
            icon: g.iconURL({ size: 128, extension: "png" }),
            community: g.features.includes("COMMUNITY"),
        }));
    }

    async getChannels(guildId) {
        const g = this.guild(guildId);
        const all = await g.channels.fetch();
        const list = [...all.values()].filter(Boolean).map(c => this.serializeChannel(c));
        try {
            const active = await g.channels.fetchActiveThreads();
            active.threads.forEach(t => list.push(this.serializeChannel(t)));
        } catch { /* izin tidak cukup */ }
        return list;
    }

    async getMessages(channelId, before, limit = 50) {
        const ch = await this.textChannel(channelId);
        const msgs = await ch.messages.fetch({ limit, ...(before ? { before } : {}) });
        return [...msgs.values()].sort((a, b) => a.createdTimestamp - b.createdTimestamp).map(m => this.serializeMessage(m));
    }

    async getPins(channelId) {
        const ch = await this.textChannel(channelId);
        const fn = ch.messages.fetchPins || ch.messages.fetchPinned;
        const result = await fn.call(ch.messages);
        const items = result && result.items ? result.items.map(i => i.message) : [...result.values()];
        return items.map(m => this.serializeMessage(m));
    }

    async getForumPosts(channelId) {
        const forum = await this.channel(channelId);
        if (!forum.threads) throw new Error("This is not a forum channel");
        const out = new Map();
        const active = await forum.threads.fetchActive().catch(() => null);
        if (active) active.threads.forEach(t => out.set(t.id, t));
        const archived = await forum.threads.fetchArchived({ limit: 25 }).catch(() => null);
        if (archived) archived.threads.forEach(t => out.set(t.id, t));
        const tags = new Map((forum.availableTags || []).map(t => [t.id, t.name]));
        return [...out.values()]
            .sort((a, b) => (b.createdTimestamp || 0) - (a.createdTimestamp || 0))
            .map(t => ({
                id: t.id, name: t.name, createdTimestamp: t.createdTimestamp, messageCount: t.messageCount,
                archived: !!t.archived, locked: !!t.locked, pinned: t.flags ? t.flags.has(2) : false,
                tags: (t.appliedTags || []).map(id => tags.get(id)).filter(Boolean), ownerId: t.ownerId,
            }));
    }

    async getMembers(guildId) {
        if (this.limited.members) throw new Error("Enable \"Server Members Intent\" in the Developer Portal (Bot tab) to list members.");
        const g = this.guild(guildId);
        const members = await g.members.fetch();
        const roles = [...g.roles.cache.values()].filter(r => r.id !== g.id).map(r => ({
            id: r.id, name: r.name, color: hex(r.color), hoist: r.hoist, position: r.position, managed: r.managed,
            editable: r.editable,
        })).sort((a, b) => b.position - a.position);
        return { members: [...members.values()].map(m => this.serializeMember(m)), roles, ownerId: g.ownerId };
    }

    async getRoles(guildId) {
        const g = this.guild(guildId);
        await g.roles.fetch();
        return [...g.roles.cache.values()].filter(r => r.id !== g.id).map(r => ({
            id: r.id, name: r.name, color: hex(r.color), position: r.position, managed: r.managed, editable: r.editable,
        })).sort((a, b) => b.position - a.position);
    }

    async getEmojis(guildId) {
        const g = this.guild(guildId);
        return [...g.emojis.cache.values()].map(e => ({ id: e.id, name: e.name, animated: !!e.animated, url: e.imageURL({ size: 48 }) }));
    }

    async getStats() {
        const c = this.need();
        return {
            guilds: c.guilds.cache.size,
            users: c.guilds.cache.reduce((n, g) => n + (g.memberCount || 0), 0),
            channels: c.channels.cache.size,
            ping: c.ws.ping, uptime: this.startedAt ? Date.now() - this.startedAt : 0,
            memory: process.memoryUsage().rss,
            invite: `https://discord.com/oauth2/authorize?client_id=${c.user.id}&permissions=8&integration_type=0&scope=bot+applications.commands`,
        };
    }

    // ------------------------------------------------------------------ pesan
    async send(channelId, payload) {
        const ch = await this.textChannel(channelId);
        const opts = {
            content: payload.content || undefined,
            embeds: payload.embeds && payload.embeds.length ? payload.embeds : undefined,
            files: payload.files && payload.files.length ? payload.files.map(f => ({ attachment: f.path, name: f.name })) : undefined,
            allowedMentions: { parse: payload.allowPings ? ["users", "roles", "everyone"] : ["users"] },
        };
        if (payload.replyTo) opts.reply = { messageReference: payload.replyTo, failIfNotExists: false };
        if (!opts.content && !opts.embeds && !opts.files) throw new Error("The message is empty");
        const m = await ch.send(opts);
        this.log("info", `Sent a message to #${ch.name || channelId}`);
        return this.serializeMessage(m);
    }

    async editMessage(channelId, messageId, payload) {
        const ch = await this.textChannel(channelId);
        const m = await ch.messages.fetch(messageId);
        if (m.author.id !== this.need().user.id) throw new Error("The bot can only edit its own messages");
        const edited = await m.edit({ content: payload.content ?? m.content, ...(payload.embeds ? { embeds: payload.embeds } : {}) });
        return this.serializeMessage(edited);
    }

    async deleteMessage(channelId, messageId) {
        const ch = await this.textChannel(channelId);
        const m = await ch.messages.fetch(messageId);
        await m.delete();
        this.log("info", `Deleted a message in #${ch.name || channelId}`);
        return true;
    }

    async react(channelId, messageId, emoji, add) {
        const ch = await this.textChannel(channelId);
        const m = await ch.messages.fetch(messageId);
        if (add) {
            await m.react(emoji);
        } else {
            const r = m.reactions.resolve(emoji);
            if (r) await r.users.remove(this.need().user.id);
        }
        return true;
    }

    async pin(channelId, messageId, state) {
        const ch = await this.textChannel(channelId);
        const m = await ch.messages.fetch(messageId);
        if (state) await m.pin(); else await m.unpin();
        return true;
    }

    async createForumPost(channelId, { name, content, embeds }) {
        const forum = await this.channel(channelId);
        if (!forum.threads) throw new Error("This is not a forum channel");
        const t = await forum.threads.create({ name, message: { content: content || undefined, embeds: embeds && embeds.length ? embeds : undefined } });
        return t.id;
    }

    async sendDM(userId, content) {
        const user = await this.need().users.fetch(userId);
        await user.send(content);
        this.log("info", `Sent a DM to ${user.tag}`);
        return true;
    }

    // ------------------------------------------------------------------ moderasi
    async member(guildId, userId) {
        return this.guild(guildId).members.fetch(userId);
    }

    async kick(guildId, userId, reason) {
        const m = await this.member(guildId, userId);
        await m.kick(reason || undefined);
        this.log("warn", `Kicked ${m.user.tag}`);
        return true;
    }

    async ban(guildId, userId, reason, deleteSeconds = 0) {
        const g = this.guild(guildId);
        await g.members.ban(userId, { reason: reason || undefined, deleteMessageSeconds: deleteSeconds });
        this.log("warn", `Banned user ${userId} from ${g.name}`);
        return true;
    }

    async timeout(guildId, userId, ms, reason) {
        const m = await this.member(guildId, userId);
        await m.timeout(ms > 0 ? ms : null, reason || undefined);
        this.log("warn", `${ms > 0 ? "Timed out" : "Removed timeout of"} ${m.user.tag}`);
        return true;
    }

    async setNickname(guildId, userId, nick) {
        const m = await this.member(guildId, userId);
        await m.setNickname(nick || null);
        return true;
    }

    async setMemberRoles(guildId, userId, roleIds) {
        const m = await this.member(guildId, userId);
        const g = this.guild(guildId);
        const manageable = new Set([...g.roles.cache.values()].filter(r => r.editable && !r.managed && r.id !== g.id).map(r => r.id));
        const keep = [...m.roles.cache.keys()].filter(id => !manageable.has(id));
        await m.roles.set([...new Set([...keep, ...roleIds.filter(id => manageable.has(id))])]);
        return true;
    }

    // ------------------------------------------------------------------ channel dan server
    async createChannel(guildId, { name, kind, parentId, topic }) {
        const g = this.guild(guildId);
        const type = CREATE_TYPES[kind];
        if (type === undefined) throw new Error("Unknown channel type");
        const c = await g.channels.create({
            name, type, ...(kind !== "category" && parentId ? { parent: parentId } : {}), ...(topic && ["text", "announcement", "forum"].includes(kind) ? { topic } : {}),
        });
        this.log("info", `Created channel ${c.name} in ${g.name}`);
        return c.id;
    }

    async editChannel(channelId, { name, topic }) {
        const c = await this.channel(channelId);
        await c.edit({ ...(name ? { name } : {}), ...(topic !== undefined && "topic" in c ? { topic } : {}) });
        return true;
    }

    async deleteChannel(channelId) {
        const c = await this.channel(channelId);
        const name = c.name;
        await c.delete();
        this.log("warn", `Deleted channel ${name}`);
        return true;
    }

    async leaveGuild(guildId) {
        const g = this.guild(guildId);
        const name = g.name;
        await g.leave();
        this.log("warn", `Left server ${name}`);
        return true;
    }

    // ------------------------------------------------------------------ profil bot
    async getProfile() {
        const c = this.need();
        const [user, app] = await Promise.all([c.user.fetch(true), c.application.fetch()]);
        return {
            id: user.id, username: user.username, tag: user.tag,
            avatar: user.displayAvatarURL({ size: 256, extension: "png" }),
            banner: user.bannerURL({ size: 600, extension: "png" }) || null,
            accentColor: user.hexAccentColor || null,
            appIcon: app.iconURL({ size: 256, extension: "png" }) || null,
            description: app.description || "", tags: app.tags || [],
            installUrl: app.customInstallURL || null,
        };
    }

    async setUsername(name) {
        const u = await this.need().user.setUsername(String(name).trim());
        this.user = this.serializeUser(u);
        this.log("info", `Bot username changed to ${u.username}`);
        this.emit("status", this.status());
        return true;
    }

    async setAvatar(dataUrl) {
        const u = await this.need().user.setAvatar(dataUrl || null);
        this.user = this.serializeUser(u);
        this.log("info", "Bot avatar updated");
        this.emit("status", this.status());
        return true;
    }

    async setBanner(dataUrl) {
        await this.need().user.setBanner(dataUrl || null);
        this.log("info", dataUrl ? "Bot banner updated" : "Bot banner removed");
        return true;
    }

    // description, tags (maks 5), icon aplikasi, dan gambar sampul aplikasi
    async editApplication({ description, tags, icon, coverImage }) {
        const opts = {};
        if (description !== undefined) opts.description = String(description).slice(0, 400);
        if (tags !== undefined) {
            const list = tags.map(t => String(t).trim()).filter(Boolean);
            if (list.length > 5) throw new Error("Discord allows at most 5 tags");
            if (list.some(t => t.length > 20)) throw new Error("A tag can be at most 20 characters");
            opts.tags = list;
        }
        if (icon !== undefined) opts.icon = icon;
        if (coverImage !== undefined) opts.coverImage = coverImage;
        await this.need().application.edit(opts);
        this.log("info", "Application profile updated");
        return true;
    }

    setPresence({ status, activityType, activityText }) {
        const c = this.client;
        if (!c || !c.user) return false;
        const activities = [];
        if (activityText && activityType) {
            activities.push(activityType === "Custom"
                ? { name: "Custom Status", state: activityText, type: ActivityType.Custom }
                : { name: activityText, type: ActivityType[activityType] });
        }
        c.user.setPresence({ status: status || "online", activities });
        return true;
    }
}

module.exports = { Bot, P };
