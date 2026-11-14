import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([length, typeBuf, data, crcBuf]);
}

function encodePng(width, height, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }

  return Buffer.concat([
    PNG_SIGNATURE,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

function hexToRgb(hex) {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

const BG = hexToRgb('#1c2621');
const RING = hexToRgb('#c9a17a');
const DOT = hexToRgb('#e8d5c5');

function renderEmblem(size, scale) {
  const SS = 3;
  const hi = size * SS;
  const hiBuf = Buffer.alloc(hi * hi * 4);

  const cx = hi / 2;
  const cy = hi / 2;
  const outer = hi * 0.3 * scale;
  const thickness = hi * 0.07 * scale;
  const inner = outer - thickness;
  const dotR = hi * 0.065 * scale;
  const angle = -Math.PI / 4;
  const dotX = cx + Math.cos(angle) * outer;
  const dotY = cy + Math.sin(angle) * outer;

  const [br, bg, bb] = BG;
  const [rr, rg, rb] = RING;
  const [dr, dg, db] = DOT;

  for (let y = 0; y < hi; y++) {
    for (let x = 0; x < hi; x++) {
      const px = x + 0.5;
      const py = y + 0.5;
      const i = (y * hi + x) * 4;
      let c = [br, bg, bb];

      const distC = Math.hypot(px - cx, py - cy);
      if (distC <= outer && distC >= inner) c = [rr, rg, rb];

      const distD = Math.hypot(px - dotX, py - dotY);
      if (distD <= dotR) c = [dr, dg, db];

      hiBuf[i] = c[0];
      hiBuf[i + 1] = c[1];
      hiBuf[i + 2] = c[2];
      hiBuf[i + 3] = 255;
    }
  }

  const out = Buffer.alloc(size * size * 4);
  const samples = SS * SS;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const si = ((y * SS + sy) * hi + (x * SS + sx)) * 4;
          r += hiBuf[si];
          g += hiBuf[si + 1];
          b += hiBuf[si + 2];
          a += hiBuf[si + 3];
        }
      }
      const oi = (y * size + x) * 4;
      out[oi] = Math.round(r / samples);
      out[oi + 1] = Math.round(g / samples);
      out[oi + 2] = Math.round(b / samples);
      out[oi + 3] = Math.round(a / samples);
    }
  }

  return out;
}

const outputs = [
  { path: join(ROOT, 'public', 'icons', 'icon-192.png'), size: 192, scale: 1 },
  { path: join(ROOT, 'public', 'icons', 'icon-512.png'), size: 512, scale: 1 },
  { path: join(ROOT, 'public', 'icons', 'maskable-512.png'), size: 512, scale: 0.7 },
  { path: join(ROOT, 'public', 'apple-touch-icon.png'), size: 180, scale: 1 },
];

let failed = false;

for (const { path, size, scale } of outputs) {
  mkdirSync(dirname(path), { recursive: true });
  const png = encodePng(size, size, renderEmblem(size, scale));
  writeFileSync(path, png);

  const check = readFileSync(path);
  const sigOk = PNG_SIGNATURE.equals(check.subarray(0, 8));
  const width = check.readUInt32BE(16);
  const height = check.readUInt32BE(20);
  const dimsOk = width === size && height === size;

  if (!sigOk || !dimsOk) failed = true;

  const bytes = statSync(path).size;
  console.log(`${path} - ${bytes} bytes (${width}x${height}) ${sigOk && dimsOk ? 'OK' : 'INVALID'}`);
}

if (failed) {
  console.error('Icon generation failed validation.');
  process.exit(1);
}
