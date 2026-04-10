// Generate simple PNG icons for the Chrome extension
// Run: node scripts/generate-icons.js

const fs = require('fs');
const path = require('path');

function createPNG(size) {
  // Minimal valid PNG with a purple/blue gradient-like brain icon
  // This creates a simple solid-color PNG as a placeholder
  const { createCanvas } = (() => {
    try {
      return require('canvas');
    } catch {
      return { createCanvas: null };
    }
  })();

  if (createCanvas) {
    const canvas = createCanvas(size, size);
    const ctx = canvas.getContext('2d');

    // Background gradient (purple to blue)
    const grad = ctx.createLinearGradient(0, 0, size, size);
    grad.addColorStop(0, '#7c3aed');
    grad.addColorStop(1, '#2563eb');

    // Rounded rect background
    const r = size * 0.15;
    ctx.beginPath();
    ctx.moveTo(r, 0);
    ctx.lineTo(size - r, 0);
    ctx.quadraticCurveTo(size, 0, size, r);
    ctx.lineTo(size, size - r);
    ctx.quadraticCurveTo(size, size, size - r, size);
    ctx.lineTo(r, size);
    ctx.quadraticCurveTo(0, size, 0, size - r);
    ctx.lineTo(0, r);
    ctx.quadraticCurveTo(0, 0, r, 0);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // "AI" text
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${size * 0.4}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('AI', size / 2, size / 2);

    return canvas.toBuffer('image/png');
  }

  // Fallback: create minimal 1x1 purple PNG that Chrome will accept
  // (user should replace with proper icons)
  return createMinimalPNG(size);
}

function createMinimalPNG(size) {
  // Create a minimal valid PNG file
  // PNG Signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  function crc32(buf) {
    let crc = 0xffffffff;
    for (let i = 0; i < buf.length; i++) {
      crc ^= buf[i];
      for (let j = 0; j < 8; j++) {
        crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
      }
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  function makeChunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeAndData = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(typeAndData), 0);
    return Buffer.concat([len, typeAndData, crc]);
  }

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type (RGB)
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  // IDAT - raw image data (purple pixels)
  const raw = [];
  for (let y = 0; y < size; y++) {
    raw.push(0); // filter byte
    for (let x = 0; x < size; x++) {
      // Purple gradient
      const t = (x + y) / (2 * size);
      raw.push(Math.round(124 * (1 - t) + 37 * t)); // R
      raw.push(Math.round(58 * (1 - t) + 99 * t));  // G
      raw.push(Math.round(237 * (1 - t) + 235 * t)); // B
    }
  }

  // Compress with zlib
  const zlib = require('zlib');
  const compressed = zlib.deflateSync(Buffer.from(raw));

  // IEND
  const iend = Buffer.alloc(0);

  return Buffer.concat([
    signature,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', compressed),
    makeChunk('IEND', iend),
  ]);
}

const iconsDir = path.join(__dirname, '..', 'public', 'icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

for (const size of [16, 48, 128]) {
  const png = createPNG(size);
  const outPath = path.join(iconsDir, `icon${size}.png`);
  fs.writeFileSync(outPath, png);
  console.log(`Created ${outPath} (${png.length} bytes)`);
}

console.log('Icons generated successfully!');
