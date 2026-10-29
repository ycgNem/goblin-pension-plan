// Download a PixelLab character or object (every rotation and animation) into art/raw/.
//   node scripts/art/pull.ts <id> <name> [characters|objects]
// Rotations land in art/raw/<name>/rotations/<direction>.png; animation frames in
// art/raw/<name>/<animation>_<dir>/<n>.png, with dir shortened (south -> s, north-east -> ne),
// which is how art/sheets.json names clip folders.

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { inflateRawSync } from 'node:zlib';

const [id, name, kind = 'characters'] = process.argv.slice(2);
if (!id || !name) {
  console.error('usage: node scripts/art/pull.ts <id> <name> [characters|objects]');
  process.exit(1);
}

const res = await fetch(`https://api.pixellab.ai/mcp/${kind}/${id}/download`);
if (!res.ok) throw new Error(`download: ${res.status} ${res.statusText} (still generating?)`);
const zip = Buffer.from(await res.arrayBuffer());

/** Every file in a ZIP, from its central directory. */
function* entries(buf: Buffer): Generator<{ name: string; data: Buffer }> {
  let end = buf.length - 22;
  while (end >= 0 && buf.readUInt32LE(end) !== 0x06054b50) end--;
  if (end < 0) throw new Error('Not a ZIP');
  let p = buf.readUInt32LE(end + 16);
  const count = buf.readUInt16LE(end + 10);
  for (let i = 0; i < count; i++) {
    const method = buf.readUInt16LE(p + 10);
    const size = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const file = buf.toString('utf8', p + 46, p + 46 + nameLen);
    const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const raw = buf.subarray(start, start + size);
    if (!file.endsWith('/')) yield { name: file, data: method === 8 ? inflateRawSync(raw) : raw };
    p += 46 + nameLen + extraLen + commentLen;
  }
}

const short = (dir: string) => dir.split('-').map((w) => w[0]).join('');
const root = join(import.meta.dirname, '..', '..', 'art', 'raw', name);
let count = 0;
for (const e of entries(zip)) {
  const parts = e.name.split('/');
  let out: string | null = null;
  const rot = parts.indexOf('rotations');
  const anim = parts.indexOf('animations');
  if (rot >= 0) out = join(root, 'rotations', parts[rot + 1]!);
  else if (anim >= 0 && parts.length >= anim + 4) {
    const frame = Number(parts[anim + 3]!.replace(/\D/g, ''));
    out = join(root, `${parts[anim + 1]}_${short(parts[anim + 2]!)}`, `${frame}.png`);
  }
  if (!out) continue;
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, e.data);
  count++;
}
console.log(`${name}: ${count} files into ${root}`);
