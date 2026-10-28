"use strict";
// Membuat assets/icon.png (256x256): topi jerami di atas kotak membulat oranye. Tanpa dependensi.
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const SIZE = 256;
const SS = 4;

const crcTable = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        t[n] = c >>> 0;
    }
    return t;
})();
const crc32 = buf => {
    let c = 0xffffffff;
    for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
    return Buffer.concat([len, body, crc]);
};

const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
const inEllipse = (x, y, cx, cy, rx, ry) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;
const inRoundRect = (x, y, m, r) => {
    const lo = m, hi = SIZE - m;
    if (x < lo || x > hi || y < lo || y > hi) return false;
    const dx = Math.max(lo + r - x, 0, x - (hi - r)), dy = Math.max(lo + r - y, 0, y - (hi - r));
    return dx * dx + dy * dy <= r * r;
};

function shade(x, y) {
    if (!inRoundRect(x, y, 8, 56)) return null;
    let col = mix([255, 176, 96], [232, 108, 22], y / SIZE);

    const dome = inEllipse(x, y, 128, 128, 54, 52) && y < 150;
    const brim = inEllipse(x, y, 128, 152, 92, 26);
    const band = dome && y > 116 && y < 142;

    if (dome) col = mix([248, 222, 140], [226, 186, 96], (y - 76) / 80);
    if (band) col = [205, 52, 44];
    if (brim) col = y > 156 ? mix([226, 186, 96], [196, 152, 70], Math.min(1, (y - 156) / 22)) : [244, 214, 128];
    if (brim && inEllipse(x, y, 128, 149, 62, 14) && y < 160) col = dome ? col : [236, 200, 110];
    return col;
}

const raw = Buffer.alloc(SIZE * (SIZE * 4 + 1));
for (let y = 0; y < SIZE; y++) {
    raw[y * (SIZE * 4 + 1)] = 0;
    for (let x = 0; x < SIZE; x++) {
        let r = 0, g = 0, b = 0, hit = 0;
        for (let sy = 0; sy < SS; sy++) {
            for (let sx = 0; sx < SS; sx++) {
                const c = shade(x + (sx + 0.5) / SS, y + (sy + 0.5) / SS);
                if (c) { r += c[0]; g += c[1]; b += c[2]; hit++; }
            }
        }
        const o = y * (SIZE * 4 + 1) + 1 + x * 4;
        const total = SS * SS;
        raw[o] = hit ? Math.round(r / hit) : 0;
        raw[o + 1] = hit ? Math.round(g / hit) : 0;
        raw[o + 2] = hit ? Math.round(b / hit) : 0;
        raw[o + 3] = Math.round((hit / total) * 255);
    }
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0); ihdr.writeUInt32BE(SIZE, 4);
ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
const png = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0)),
]);

const out = path.join(__dirname, "..", "assets", "icon.png");
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, png);
console.log("Wrote", out, png.length, "bytes");
