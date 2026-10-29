// Download art into art/raw/, so packing never depends on PixelLab's URLs staying up.
//   node scripts/art/fetch.ts <dest-dir> <name>=<url> [<name>=<url> ...]
// Each file lands at <dest-dir>/<name>.png (or the name's own extension, if it has one).

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, extname, join } from 'node:path';

const [dest, ...pairs] = process.argv.slice(2);
if (!dest || pairs.length === 0) {
  console.error('usage: node scripts/art/fetch.ts <dest-dir> <name>=<url>...');
  process.exit(1);
}

for (const pair of pairs) {
  const eq = pair.indexOf('=');
  const name = pair.slice(0, eq);
  const url = pair.slice(eq + 1);
  const file = join(dest, extname(name) ? name : `${name}.png`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status} ${res.statusText}`);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, new Uint8Array(await res.arrayBuffer()));
  console.log(`${file} (${res.headers.get('content-length') ?? '?'} bytes)`);
}
