// Review tool: lay PNGs out on a dark grid, scaled up with hard pixels, and write one PNG.
//   node scripts/art/contact.ts <out.png> <scale> <file-or-dir>...
// Directories contribute every PNG inside them, in name order. Each row holds up to 8 images.

import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createImage, decodePng, encodePng, type Image } from './png.ts';

const [out, scaleArg, ...inputs] = process.argv.slice(2);
if (!out || !scaleArg || inputs.length === 0) {
  console.error('usage: node scripts/art/contact.ts <out.png> <scale> <file-or-dir>...');
  process.exit(1);
}
const scale = Number(scaleArg);

const files: string[] = [];
for (const input of inputs) {
  if (statSync(input).isDirectory()) {
    for (const f of readdirSync(input).sort()) if (f.endsWith('.png')) files.push(join(input, f));
  } else files.push(input);
}

const images: Image[] = files.map((f) => decodePng(readFileSync(f)));
const cols = Math.min(8, images.length);
const rows = Math.ceil(images.length / cols);
const cellW = Math.max(...images.map((i) => i.width)) * scale + 4;
const cellH = Math.max(...images.map((i) => i.height)) * scale + 4;
const sheet = createImage(cols * cellW, rows * cellH);

images.forEach((img, n) => {
  const ox = (n % cols) * cellW;
  const oy = Math.floor(n / cols) * cellH;
  for (let y = 0; y < cellH; y++) {
    for (let x = 0; x < cellW; x++) {
      const o = ((oy + y) * sheet.width + ox + x) * 4;
      // A checker so transparency and outlines both read.
      const c = ((x >> 3) + (y >> 3)) % 2 ? 46 : 38;
      sheet.data.set([c, c + 4, c, 255], o);
    }
  }
  for (let y = 0; y < img.height * scale; y++) {
    for (let x = 0; x < img.width * scale; x++) {
      const s = (Math.floor(y / scale) * img.width + Math.floor(x / scale)) * 4;
      const a = img.data[s + 3]! / 255;
      if (a === 0) continue;
      const o = ((oy + 2 + y) * sheet.width + ox + 2 + x) * 4;
      for (let k = 0; k < 3; k++) sheet.data[o + k] = Math.round(img.data[s + k]! * a + sheet.data[o + k]! * (1 - a));
    }
  }
});

writeFileSync(out, encodePng(sheet));
console.log(`${images.length} images -> ${out} (${sheet.width}x${sheet.height})`);
