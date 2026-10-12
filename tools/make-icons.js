// Renders the extension icon (red tile, white play button, slash through it)
// to PNGs with no dependencies. Run: node tools/make-icons.js
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const SIZES = [16, 32, 48, 128];
const SUPERSAMPLE = 6;
const OUT_DIR = path.join(__dirname, "..", "icons");

// All geometry is in a 0..1 unit square.
const TILE = { cx: 0.5, cy: 0.5, half: 0.46, radius: 0.2 };
const TRIANGLE = [
  [0.34, 0.25],
  [0.34, 0.75],
  [0.78, 0.5],
];
const SLASH = { a: [0.2, 0.2], b: [0.8, 0.8], width: 0.085, gap: 0.04 };

const TOP_RED = [255, 64, 64];
const BOTTOM_RED = [196, 0, 26];
const WHITE = [255, 255, 255];

function roundedRectDist(x, y, { cx, cy, half, radius }) {
  const qx = Math.abs(x - cx) - half + radius;
  const qy = Math.abs(y - cy) - half + radius;
  const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0));
  return outside + Math.min(Math.max(qx, qy), 0) - radius;
}

function inTriangle(x, y, [[ax, ay], [bx, by], [cx, cy]]) {
  const sign = (px, py, qx, qy, rx, ry) => (px - rx) * (qy - ry) - (qx - rx) * (py - ry);
  const d1 = sign(x, y, ax, ay, bx, by);
  const d2 = sign(x, y, bx, by, cx, cy);
  const d3 = sign(x, y, cx, cy, ax, ay);
  const hasNeg = d1 < 0 || d2 < 0 || d3 < 0;
  const hasPos = d1 > 0 || d2 > 0 || d3 > 0;
  return !(hasNeg && hasPos);
}

function segmentDist(x, y, [ax, ay], [bx, by]) {
  const dx = bx - ax;
  const dy = by - ay;
  const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(x - (ax + t * dx), y - (ay + t * dy));
}

function lerp(a, b, t) {
  return a.map((v, i) => v + (b[i] - v) * t);
}

// Returns [r, g, b, a] for a single point, a in 0..1.
function shade(x, y) {
  if (roundedRectDist(x, y, TILE) > 0) return [0, 0, 0, 0];
  const red = lerp(TOP_RED, BOTTOM_RED, y);
  const slashDist = segmentDist(x, y, SLASH.a, SLASH.b);
  if (slashDist < SLASH.width / 2) return [...WHITE, 1];
  if (slashDist < SLASH.width / 2 + SLASH.gap) return [...red, 1];
  if (inTriangle(x, y, TRIANGLE)) return [...WHITE, 1];
  return [...red, 1];
}

function render(size) {
  const pixels = Buffer.alloc(size * size * 4);
  const n = SUPERSAMPLE;
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < n; sy++) {
        for (let sx = 0; sx < n; sx++) {
          const [cr, cg, cb, ca] = shade((px + (sx + 0.5) / n) / size, (py + (sy + 0.5) / n) / size);
          r += cr * ca;
          g += cg * ca;
          b += cb * ca;
          a += ca;
        }
      }
      const i = (py * size + px) * 4;
      pixels[i] = a ? Math.round(r / a) : 0;
      pixels[i + 1] = a ? Math.round(g / a) : 0;
      pixels[i + 2] = a ? Math.round(b / a) : 0;
      pixels[i + 3] = Math.round((a / (n * n)) * 255);
    }
  }
  return pixels;
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(size, pixels) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const rows = [];
  for (let y = 0; y < size; y++) {
    rows.push(Buffer.from([0]), pixels.subarray(y * size * 4, (y + 1) * size * 4));
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(Buffer.concat(rows))),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

fs.mkdirSync(OUT_DIR, { recursive: true });
for (const size of SIZES) {
  fs.writeFileSync(path.join(OUT_DIR, `icon${size}.png`), encodePng(size, render(size)));
  console.log(`icons/icon${size}.png`);
}
