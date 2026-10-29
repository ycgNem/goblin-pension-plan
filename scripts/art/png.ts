// A small PNG reader and writer on node:zlib, so the art scripts need no dependencies.
// Reads 8-bit (and low-bit palette/grey) images of every color type; writes 8-bit RGBA.

import { deflateSync, inflateSync } from 'node:zlib';

export interface Image {
  width: number;
  height: number;
  /** RGBA, 4 bytes per pixel, row-major. */
  data: Uint8Array;
}

export function createImage(width: number, height: number): Image {
  return { width, height, data: new Uint8Array(width * height * 4) };
}

const SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** Width and height straight from the IHDR chunk, without decoding. */
export function pngSize(bytes: Uint8Array): { width: number; height: number } {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (let i = 0; i < 8; i++) if (bytes[i] !== SIGNATURE[i]) throw new Error('Not a PNG');
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

export function decodePng(bytes: Uint8Array): Image {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (let i = 0; i < 8; i++) if (bytes[i] !== SIGNATURE[i]) throw new Error('Not a PNG');
  let pos = 8;
  let width = 0;
  let height = 0;
  let depth = 8;
  let colorType = 6;
  let interlace = 0;
  let palette: Uint8Array | null = null;
  let trns: Uint8Array | null = null;
  const idat: Uint8Array[] = [];
  while (pos < bytes.length) {
    const len = view.getUint32(pos);
    const type = String.fromCharCode(...bytes.subarray(pos + 4, pos + 8));
    const body = bytes.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') {
      width = view.getUint32(pos + 8);
      height = view.getUint32(pos + 12);
      depth = body[8]!;
      colorType = body[9]!;
      interlace = body[12]!;
    } else if (type === 'PLTE') palette = body;
    else if (type === 'tRNS') trns = body;
    else if (type === 'IDAT') idat.push(body);
    else if (type === 'IEND') break;
    pos += 12 + len;
  }
  if (interlace !== 0) throw new Error('Interlaced PNGs are not supported');
  if (depth === 16) throw new Error('16-bit PNGs are not supported');
  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[colorType];
  if (!channels) throw new Error(`Unknown PNG color type ${colorType}`);
  const raw = inflateSync(Buffer.concat(idat));
  const bitsPerPixel = channels * depth;
  const stride = Math.ceil((width * bitsPerPixel) / 8);
  const bpp = Math.max(1, bitsPerPixel >> 3);
  const lines = new Uint8Array(stride * height);
  let prev = new Uint8Array(stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)]!;
    const src = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const line = lines.subarray(y * stride, (y + 1) * stride);
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? line[x - bpp]! : 0;
      const b = prev[x]!;
      const c = x >= bpp ? prev[x - bpp]! : 0;
      let v = src[x]!;
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      line[x] = v & 0xff;
    }
    prev = line;
  }

  const img = createImage(width, height);
  const sample = (line: Uint8Array, i: number): number => {
    if (depth === 8) return line[i]!;
    const bit = i * depth;
    return (line[bit >> 3]! >> (8 - depth - (bit & 7))) & ((1 << depth) - 1);
  };
  for (let y = 0; y < height; y++) {
    const line = lines.subarray(y * stride, (y + 1) * stride);
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4;
      if (colorType === 6) img.data.set(line.subarray(x * 4, x * 4 + 4), o);
      else if (colorType === 2) {
        img.data.set(line.subarray(x * 3, x * 3 + 3), o);
        const t = trns && trns.length >= 6 && line[x * 3] === trns[1] && line[x * 3 + 1] === trns[3] && line[x * 3 + 2] === trns[5];
        img.data[o + 3] = t ? 0 : 255;
      } else if (colorType === 3) {
        const i = sample(line, x);
        img.data[o] = palette?.[i * 3] ?? 0;
        img.data[o + 1] = palette?.[i * 3 + 1] ?? 0;
        img.data[o + 2] = palette?.[i * 3 + 2] ?? 0;
        img.data[o + 3] = trns && i < trns.length ? trns[i]! : 255;
      } else if (colorType === 0) {
        const v = sample(line, x);
        const g = depth === 8 ? v : Math.round((v * 255) / ((1 << depth) - 1));
        img.data.fill(g, o, o + 3);
        img.data[o + 3] = trns && trns.length >= 2 && v === trns[1] ? 0 : 255;
      } else {
        img.data.fill(line[x * 2]!, o, o + 3);
        img.data[o + 3] = line[x * 2 + 1]!;
      }
    }
  }
  return img;
}

function chunk(type: string, body: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + body.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, body.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(body, 8);
  view.setUint32(8 + body.length, crc32(out.subarray(4, 8 + body.length)));
  return out;
}

export function encodePng(img: Image): Uint8Array {
  const ihdr = new Uint8Array(13);
  const view = new DataView(ihdr.buffer);
  view.setUint32(0, img.width);
  view.setUint32(4, img.height);
  ihdr.set([8, 6, 0, 0, 0], 8);
  const stride = img.width * 4;
  const raw = new Uint8Array((stride + 1) * img.height);
  for (let y = 0; y < img.height; y++) raw.set(img.data.subarray(y * stride, (y + 1) * stride), y * (stride + 1) + 1);
  return Buffer.concat([
    Buffer.from(SIGNATURE),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', new Uint8Array(0)),
  ]);
}

/** Copy a w×h block from one image to another. Fully transparent source pixels are skipped. */
export function blit(src: Image, sx: number, sy: number, w: number, h: number, dst: Image, dx: number, dy: number): void {
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const tx = dx + x;
      const ty = dy + y;
      const fx = sx + x;
      const fy = sy + y;
      if (tx < 0 || ty < 0 || tx >= dst.width || ty >= dst.height) continue;
      if (fx < 0 || fy < 0 || fx >= src.width || fy >= src.height) continue;
      const s = (fy * src.width + fx) * 4;
      if (src.data[s + 3] === 0) continue;
      dst.data.set(src.data.subarray(s, s + 4), (ty * dst.width + tx) * 4);
    }
  }
}

/** The smallest box holding every pixel with alpha above the threshold, or null if there are none. */
export function opaqueBounds(img: Image, threshold = 0): { x0: number; y0: number; x1: number; y1: number } | null {
  let x0 = img.width;
  let y0 = img.height;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      if (img.data[(y * img.width + x) * 4 + 3]! <= threshold) continue;
      if (x < x0) x0 = x;
      if (y < y0) y0 = y;
      if (x > x1) x1 = x;
      if (y > y1) y1 = y;
    }
  }
  return x1 < 0 ? null : { x0, y0, x1, y1 };
}
