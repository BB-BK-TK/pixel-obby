// Generates icon-192.png and icon-512.png for the mobile app.
// Run with: node make_icons.js
"use strict";

const zlib = require("zlib");
const fs = require("fs");

/* ---- minimal PNG writer ---- */

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

function writePNG(path, w, h, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // RGBA
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
  fs.writeFileSync(path, png);
}

/* ---- 16x16 pixel art, scaled up ---- */

const ART = [
  "................",
  "..s.........s...",
  "................",
  ".....WWWWWW.....",
  ".....WWWWWW.....",
  ".....WEWWEW.....",
  ".....WEWWEW.....",
  ".....WWWWWW.....",
  ".....WWWWWW.....",
  "s...............",
  "...GGGGGGGGGG...",
  "...gggggggggg...",
  "................",
  "......s......s..",
  "................",
  "................",
];

const COLORS = {
  ".": [26, 26, 46, 255],     // dark sky
  "s": [150, 150, 190, 255],  // star
  "W": [232, 232, 232, 255],  // character body
  "E": [26, 26, 46, 255],     // eyes
  "G": [124, 252, 0, 255],    // platform top
  "g": [46, 125, 50, 255],    // platform body
};

function makeIcon(size) {
  const scale = size / 16;
  const buf = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const c = COLORS[ART[Math.floor(y / scale)][Math.floor(x / scale)]];
      const i = (y * size + x) * 4;
      buf[i] = c[0]; buf[i + 1] = c[1]; buf[i + 2] = c[2]; buf[i + 3] = c[3];
    }
  }
  return buf;
}

writePNG(__dirname + "/icon-192.png", 192, 192, makeIcon(192));
writePNG(__dirname + "/icon-512.png", 512, 512, makeIcon(512));
console.log("icons written: icon-192.png, icon-512.png");
