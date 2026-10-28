import fs from 'node:fs';
import zlib from 'node:zlib';
import path from 'node:path';

function createPng(width, height, getPixel) {
  // RGBA buffer: (width * 4 + 1) * height bytes (with filter byte 0 at start of each scanline)
  const lineSize = width * 4 + 1;
  const rawData = Buffer.alloc(lineSize * height);

  for (let y = 0; y < height; y++) {
    const lineOffset = y * lineSize;
    rawData[lineOffset] = 0; // Filter type: None
    for (let x = 0; x < width; x++) {
      const pixelOffset = lineOffset + 1 + x * 4;
      const [r, g, b, a] = getPixel(x, y, width, height);
      rawData[pixelOffset] = r;
      rawData[pixelOffset + 1] = g;
      rawData[pixelOffset + 2] = b;
      rawData[pixelOffset + 3] = a;
    }
  }

  const compressedData = zlib.deflateSync(rawData);

  // PNG Header
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR Chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const ihdrChunk = makeChunk('IHDR', ihdr);
  const idatChunk = makeChunk('IDAT', compressedData);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function makeChunk(type, data) {
  const len = data.length;
  const chunk = Buffer.alloc(len + 12);
  chunk.writeUInt32BE(len, 0);
  chunk.write(type, 4, 4, 'ascii');
  data.copy(chunk, 8);

  const crc = crc32(chunk.subarray(4, len + 8));
  chunk.writeUInt32BE(crc, len + 8);
  return chunk;
}

// CRC32 table & calculation
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    if (c & 1) c = 0xedb88320 ^ (c >>> 1);
    else c = c >>> 1;
  }
  crcTable[n] = c >>> 0;
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

// Draw a themed icon: deep royal purple background, golden crown center, heart
function getIconPixel(x, y, w, h) {
  const nx = x / w;
  const ny = y / h;
  const dx = nx - 0.5;
  const dy = ny - 0.5;
  const dist = Math.sqrt(dx * dx + dy * dy);

  // Background gradient: dark slate to royal purple
  let r = Math.floor(15 + nx * 30);
  let g = Math.floor(23 + ny * 10);
  let b = Math.floor(42 + (nx + ny) * 35);
  let a = 255;

  // Outer gold ring
  if (dist >= 0.42 && dist <= 0.46) {
    return [245, 158, 11, 255];
  }

  // Inner gold glow
  if (dist < 0.42) {
    const glow = (1 - dist / 0.42) * 0.35;
    r = Math.min(255, Math.floor(r + 245 * glow));
    g = Math.min(255, Math.floor(g + 158 * glow));
    b = Math.min(255, Math.floor(b + 11 * glow));
  }

  // Golden crown in center
  if (ny >= 0.35 && ny <= 0.65 && Math.abs(dx) <= 0.28) {
    // Crown base
    if (ny >= 0.55 && ny <= 0.62) {
      return [234, 179, 8, 255];
    }
    // Crown peaks: 3 peaks
    const localX = (nx - 0.22) / 0.56; // 0 to 1
    const peak1 = Math.abs(localX - 0.15);
    const peak2 = Math.abs(localX - 0.5);
    const peak3 = Math.abs(localX - 0.85);
    const minPeak = Math.min(peak1, peak2 * 0.8, peak3);
    if (ny >= 0.35 + minPeak * 0.9) {
      return [250, 204, 21, 255];
    }
  }

  // Princess Ruby in center of crown
  if (Math.abs(dx) < 0.05 && ny >= 0.50 && ny <= 0.57) {
    return [239, 68, 68, 255];
  }

  return [r, g, b, a];
}

const publicDir = path.resolve('public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

console.log('Generating PNG icons for PWA installability...');
const png192 = createPng(192, 192, getIconPixel);
fs.writeFileSync(path.join(publicDir, 'pwa-192x192.png'), png192);

const png512 = createPng(512, 512, getIconPixel);
fs.writeFileSync(path.join(publicDir, 'pwa-512x512.png'), png512);
fs.writeFileSync(path.join(publicDir, 'pwa-maskable-512x512.png'), png512);
fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), png192);

console.log('Icons generated successfully in public/');
