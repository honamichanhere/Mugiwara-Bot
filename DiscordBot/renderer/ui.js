"use strict";
// Komponen UI generik: toast, modal, menu konteks, konfirmasi, emoji picker, dan embed (render + builder).
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const { esc, icon } = U;

// ---------------------------------------------------------------------- toast
function toast(text, kind = "info") {
    const el = document.createElement("div");
    el.className = "toast " + kind;
    el.textContent = text;
    $("#toasts").appendChild(el);
    setTimeout(() => { el.classList.add("out"); setTimeout(() => el.remove(), 250); }, kind === "error" ? 6000 : 3200);
}

// ---------------------------------------------------------------------- modal
const modalStack = [];

function openModal({ title, body, actions = [], wide = false, onMount, onClose, className = "" }) {
    const wrap = document.createElement("div");
    wrap.className = "modal-wrap";
    wrap.innerHTML = `
        <div class="modal ${wide ? "wide" : ""} ${className}" role="dialog" aria-modal="true">
            <div class="modal-head"><div class="modal-title">${esc(title || "")}</div><button class="icon-btn" data-close>${icon("x")}</button></div>
            <div class="modal-body">${body || ""}</div>
            ${actions.length ? `<div class="modal-foot">${actions.map((a, i) => `<button class="btn ${a.primary ? "primary" : ""} ${a.danger ? "danger" : ""}" data-action="${i}">${esc(a.label)}</button>`).join("")}</div>` : ""}
        </div>`;
    const overlay = $("#overlay");
    overlay.classList.add("open");
    overlay.appendChild(wrap);

    const ctx = { el: wrap.querySelector(".modal"), close };
    function close(value) {
        if (!wrap.isConnected) return;
        wrap.remove();
        const i = modalStack.indexOf(ctx);
        if (i >= 0) modalStack.splice(i, 1);
        if (!overlay.children.length) overlay.classList.remove("open");
        if (onClose) onClose(value);
    }
    ctx.close = close;
    modalStack.push(ctx);

    wrap.addEventListener("mousedown", e => { if (e.target === wrap) close(); });
    wrap.querySelector("[data-close]").onclick = () => close();
    $$("[data-action]", wrap).forEach(btn => {
        btn.onclick = async () => {
            const a = actions[Number(btn.dataset.action)];
            if (!a.onClick) return close();
            btn.disabled = true;
            try {
                const r = await a.onClick(ctx);
                if (r !== false) close(r);
            } catch (err) {
                toast(err.message || String(err), "error");
            } finally {
                btn.disabled = false;
            }
        };
    });
    if (onMount) onMount(ctx);
    const first = wrap.querySelector("input:not([type=checkbox]),textarea,select");
    if (first) setTimeout(() => first.focus(), 30);
    return ctx;
}

function closeTopModal() {
    const top = modalStack[modalStack.length - 1];
    if (top) { top.close(); return true; }
    return false;
}

function confirmBox({ title, message, confirmLabel = "Confirm", danger = false }) {
    return new Promise(resolve => {
        let done = false;
        const finish = v => { if (!done) { done = true; resolve(v); } };
        openModal({
            title, body: `<p class="muted-text">${esc(message)}</p>`,
            actions: [{ label: "Cancel" }, { label: confirmLabel, primary: !danger, danger, onClick: () => { finish(true); } }],
            onClose: () => finish(false),
        });
    });
}

function promptBox({ title, label, value = "", placeholder = "", multiline = false, confirmLabel = "Save", required = false }) {
    return new Promise(resolve => {
        let done = false;
        const finish = v => { if (!done) { done = true; resolve(v); } };
        openModal({
            title,
            body: `<label class="lbl">${esc(label || "")}</label>${multiline
                ? `<textarea id="pb-input" rows="5" placeholder="${esc(placeholder)}">${esc(value)}</textarea>`
                : `<input id="pb-input" type="text" value="${esc(value)}" placeholder="${esc(placeholder)}">`}`,
            actions: [{ label: "Cancel" }, {
                label: confirmLabel, primary: true,
                onClick: ({ el }) => {
                    const v = $("#pb-input", el).value;
                    if (required && !v.trim()) throw new Error("This field is required");
                    finish(v);
                },
            }],
            onMount: ({ el }) => {
                if (!multiline) $("#pb-input", el).addEventListener("keydown", e => { if (e.key === "Enter") $("[data-action='1']", el).click(); });
            },
            onClose: () => finish(null),
        });
    });
}

// ---------------------------------------------------------------------- menu konteks
function hideMenu() {
    const m = $("#menu");
    m.classList.remove("open");
    m.innerHTML = "";
}

function showMenu(x, y, items) {
    const m = $("#menu");
    const list = items.filter(Boolean);
    m.innerHTML = list.map((it, i) => it.sep
        ? '<div class="menu-sep"></div>'
        : `<button class="menu-item ${it.danger ? "danger" : ""}" ${it.disabled ? "disabled" : ""} data-i="${i}">${it.icon ? icon(it.icon, 16) : '<span class="ic-gap"></span>'}<span>${esc(it.label)}</span></button>`).join("");
    m.classList.add("open");
    const r = m.getBoundingClientRect();
    m.style.left = Math.max(4, Math.min(x, innerWidth - r.width - 4)) + "px";
    m.style.top = Math.max(4, Math.min(y, innerHeight - r.height - 4)) + "px";
    $$(".menu-item", m).forEach(btn => {
        btn.onclick = async () => {
            const it = list[Number(btn.dataset.i)];
            hideMenu();
            try { await it.action(); } catch (err) { toast(err.message || String(err), "error"); }
        };
    });
}

document.addEventListener("mousedown", e => { if (!e.target.closest("#menu")) hideMenu(); }, true);
window.addEventListener("blur", hideMenu);
window.addEventListener("resize", hideMenu);

// ---------------------------------------------------------------------- emoji picker
const EMOJI = ("😀 😃 😄 😁 😆 😅 😂 🤣 😊 😇 🙂 🙃 😉 😍 🥰 😘 😋 😛 😜 🤪 🤗 🤔 🤨 😐 😑 😶 🙄 😏 😴 😎 🤓 😢 😭 😤 😡 🤬 😱 😨 😳 🥺 🤯 🥳 🤩 👍 👎 👏 🙌 🙏 💪 👀 🔥 ✨ ⭐ 🌟 💯 ✅ ❌ ⚠️ ❓ ❗ 💎 👑 🎉 🎁 🎮 🚀 💬 📢 📌 🔔 🔑 🛡️ ⚔️ 🏴‍☠️ 🍖 ❤️ 🧡 💛 💚 💙 💜 🖤 🤍 💔 ☠️ 👻 🎃 🤖 🐛 💡 🔧 🛠️ 📝 📦 🧪 🏆 🥇 ☕ 🍕 🍔 🍰 🌙 ☀️ ⚡ 🌈 🍀").split(" ");

function openEmojiPicker(anchor, customEmojis, onPick) {
    document.querySelectorAll(".emoji-picker").forEach(n => n.remove());
    const el = document.createElement("div");
    el.className = "emoji-picker";
    const custom = (customEmojis || []);
    el.innerHTML = `
        ${custom.length ? `<div class="ep-title">Server emoji</div><div class="ep-grid">${custom.map(e => `<button data-custom="${e.animated ? "a" : ""}:${esc(e.name)}:${e.id}" title=":${esc(e.name)}:"><img src="${esc(e.url)}" alt=""></button>`).join("")}</div>` : ""}
        <div class="ep-title">Emoji</div>
        <div class="ep-grid">${EMOJI.map(e => `<button data-e="${e}">${e}</button>`).join("")}</div>`;
    document.body.appendChild(el);
    const a = anchor.getBoundingClientRect(), r = el.getBoundingClientRect();
    el.style.left = Math.max(4, Math.min(a.right - r.width, innerWidth - r.width - 4)) + "px";
    el.style.top = Math.max(4, a.top - r.height - 8) + "px";
    const off = e => { if (!el.contains(e.target)) { el.remove(); document.removeEventListener("mousedown", off, true); } };
    setTimeout(() => document.addEventListener("mousedown", off, true), 0);
    el.addEventListener("click", e => {
        const b = e.target.closest("button");
        if (!b) return;
        if (b.dataset.custom !== undefined) {
            const [anim, name, id] = b.dataset.custom.split(":");
            onPick({ unicode: null, custom: `<${anim}:${name}:${id}>`, reactionKey: `${name}:${id}` });
        } else {
            onPick({ unicode: b.dataset.e, custom: null, reactionKey: b.dataset.e });
        }
        el.remove();
        document.removeEventListener("mousedown", off, true);
    });
}

// ---------------------------------------------------------------------- embed
function renderEmbed(e, ctx = {}) {
    if (!e) return "";
    const color = e.color !== undefined && e.color !== null ? U.colorHex(e.color) : "#4a3220";
    const author = e.author && e.author.name
        ? `<div class="em-author">${e.author.icon_url ? `<img src="${esc(e.author.icon_url)}" alt="">` : ""}${e.author.url ? `<a href="#" class="link" data-url="${esc(e.author.url)}">${esc(e.author.name)}</a>` : esc(e.author.name)}</div>` : "";
    const title = e.title ? `<div class="em-title">${e.url ? `<a href="#" class="link" data-url="${esc(e.url)}">${U.md(e.title, ctx)}</a>` : U.md(e.title, ctx)}</div>` : "";
    const desc = e.description ? `<div class="em-desc">${U.md(e.description, ctx)}</div>` : "";
    const fields = (e.fields || []).length
        ? `<div class="em-fields">${e.fields.map(f => `<div class="em-field ${f.inline ? "inline" : ""}"><div class="em-fname">${U.md(f.name, ctx)}</div><div class="em-fval">${U.md(f.value, ctx)}</div></div>`).join("")}</div>` : "";
    const image = e.image && e.image.url ? `<img class="em-image" src="${esc(e.image.url)}" alt="" data-zoom="${esc(e.image.url)}">` : "";
    const thumb = e.thumbnail && e.thumbnail.url ? `<img class="em-thumb" src="${esc(e.thumbnail.url)}" alt="">` : "";
    const footerText = [e.footer && e.footer.text, e.timestamp ? new Date(e.timestamp).toLocaleString() : null].filter(Boolean).join(" • ");
    const footer = footerText || (e.footer && e.footer.icon_url)
        ? `<div class="em-footer">${e.footer && e.footer.icon_url ? `<img src="${esc(e.footer.icon_url)}" alt="">` : ""}${esc(footerText)}</div>` : "";
    return `<div class="embed" style="border-left-color:${color}">${thumb}${author}${title}${desc}${fields}${image}${footer}</div>`;
}

// Builder: resolve dengan objek embed (format API Discord) atau null kalau dibatalkan.
function embedBuilder(initial) {
    return new Promise(resolve => {
        const start = initial || {};
        let done = false;
        const finish = v => { if (!done) { done = true; resolve(v); } };
        const fieldHtml = f => `<div class="ef">
            <div class="row2"><input class="ef-name" placeholder="Field name" maxlength="256" value="${esc(f.name || "")}"><input class="ef-value" placeholder="Field value" maxlength="1024" value="${esc(f.value || "")}"></div>
            <div class="ef-bar"><label class="chk"><input type="checkbox" class="ef-inline" ${f.inline ? "checked" : ""}> Inline</label><button class="btn small ghost ef-rm" type="button">Remove</button></div></div>`;

        openModal({
            title: "Embed builder", wide: true, className: "embed-modal",
            body: `<div class="split">
                <div>
                    <label class="lbl">Author</label><input id="eb-author" maxlength="256" value="${esc(start.author ? start.author.name : "")}">
                    <label class="lbl">Title</label><input id="eb-title" maxlength="256" value="${esc(start.title || "")}">
                    <label class="lbl">Title link (optional)</label><input id="eb-url" placeholder="https://..." value="${esc(start.url || "")}">
                    <label class="lbl">Description (markdown, &lt;#channelId&gt; mentions)</label><textarea id="eb-desc" rows="6" maxlength="4096">${esc(start.description || "")}</textarea>
                    <div class="row2">
                        <div><label class="lbl">Color</label><input type="color" id="eb-color" value="${U.colorHex(start.color !== undefined ? start.color : 0xff9132)}"></div>
                        <div><label class="lbl">Footer</label><input id="eb-footer" maxlength="2048" value="${esc(start.footer ? start.footer.text : "Mugiwara HUB")}"></div>
                    </div>
                    <div class="row2">
                        <div><label class="lbl">Image URL</label><input id="eb-image" placeholder="https://..." value="${esc(start.image ? start.image.url : "")}"></div>
                        <div><label class="lbl">Thumbnail URL</label><input id="eb-thumb" placeholder="https://..." value="${esc(start.thumbnail ? start.thumbnail.url : "")}"></div>
                    </div>
                    <label class="chk" style="margin-top:10px"><input type="checkbox" id="eb-ts" ${start.timestamp ? "checked" : ""}> Show timestamp</label>
                    <label class="lbl">Fields</label>
                    <div id="eb-fields">${(start.fields || []).map(fieldHtml).join("")}</div>
                    <button class="btn small ghost" id="eb-add" type="button">${icon("plus", 14)} Add field</button>
                </div>
                <div><label class="lbl">Preview</label><div class="preview-box" id="eb-preview"></div></div>
            </div>`,
            actions: [{ label: "Cancel" }, {
                label: "Use embed", primary: true,
                onClick: ({ el }) => {
                    const e = collect(el);
                    if (!e) throw new Error("Add at least a title, description, field, or image");
                    finish(e);
                },
            }],
            onMount: ({ el }) => {
                const render = () => {
                    const e = collect(el);
                    $("#eb-preview", el).innerHTML = e ? renderEmbed(e) : '<div class="muted-text">Nothing to preview yet</div>';
                };
                el.addEventListener("input", render);
                el.addEventListener("click", ev => {
                    if (ev.target.closest(".ef-rm")) { ev.target.closest(".ef").remove(); render(); }
                });
                $("#eb-add", el).onclick = () => { $("#eb-fields", el).insertAdjacentHTML("beforeend", fieldHtml({})); render(); };
                render();
            },
            onClose: () => finish(null),
        });

        function collect(el) {
            const v = id => $(id, el).value.trim();
            const e = { color: parseInt($("#eb-color", el).value.slice(1), 16) };
            if (v("#eb-author")) e.author = { name: v("#eb-author") };
            if (v("#eb-title")) e.title = v("#eb-title");
            if (v("#eb-url") && /^https?:\/\//.test(v("#eb-url"))) e.url = v("#eb-url");
            if ($("#eb-desc", el).value.trim()) e.description = $("#eb-desc", el).value;
            if (v("#eb-footer")) e.footer = { text: v("#eb-footer") };
            if (/^https?:\/\//.test(v("#eb-image"))) e.image = { url: v("#eb-image") };
            if (/^https?:\/\//.test(v("#eb-thumb"))) e.thumbnail = { url: v("#eb-thumb") };
            if ($("#eb-ts", el).checked) e.timestamp = new Date().toISOString();
            const fields = $$(".ef", el).map(f => ({
                name: $(".ef-name", f).value.trim(), value: $(".ef-value", f).value.trim(), inline: $(".ef-inline", f).checked,
            })).filter(f => f.name && f.value);
            if (fields.length) e.fields = fields;
            return e.title || e.description || e.fields || e.image || e.author ? e : null;
        }
    });
}

function openLightbox(url) {
    const el = document.createElement("div");
    el.className = "lightbox";
    el.innerHTML = `<img src="${esc(url)}" alt=""><div class="lb-bar"><button class="btn small" data-ext>Open original</button></div>`;
    el.addEventListener("click", e => {
        if (e.target.closest("[data-ext]")) { api.openExternal(url); return; }
        el.remove();
    });
    document.body.appendChild(el);
}
