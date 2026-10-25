// 홈 화면 추가용 아이콘을 만든다 (PRD 4번 사용 환경). 외부 라이브러리 없이 PNG를 직접 쓴다.
// 그림: 네이비 바탕에 흰 핀 스트라이프, 가운데 흰 사각 패널 (글자는 넣지 않는다).
//   node scripts/make-icons.mjs  →  public/icon-192.png, public/icon-512.png, public/apple-touch-icon.png
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const NAVY = [12, 35, 64];
const WHITE = [255, 255, 255];
const STRIPE = [60, 80, 110];

function crc32(buf) {
  let c;
  const table = crc32.table ?? (crc32.table = Array.from({ length: 256 }, (_, n) => {
    c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  }));
  let crc = 0xffffffff;
  for (const b of buf) crc = table[(crc ^ b) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function png(size, pixelAt) {
  const raw = Buffer.alloc((size * 3 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0; // 필터 없음
    for (let x = 0; x < size; x++) {
      const [r, g, b] = pixelAt(x, y);
      const o = y * (size * 3 + 1) + 1 + x * 3;
      raw[o] = r;
      raw[o + 1] = g;
      raw[o + 2] = b;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // 비트 깊이
  ihdr[9] = 2; // RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function icon(size) {
  const stripeEvery = Math.max(6, Math.round(size / 24));
  const panel = Math.round(size * 0.22); // 가운데 흰 패널의 여백
  return png(size, (x, y) => {
    const inPanel = x >= panel && x < size - panel && y >= panel && y < size - panel;
    if (inPanel) return WHITE;
    return x % stripeEvery === 0 ? STRIPE : NAVY;
  });
}

const out = path.join("public");
fs.mkdirSync(out, { recursive: true });
for (const [name, size] of [
  ["icon-192.png", 192],
  ["icon-512.png", 512],
  ["apple-touch-icon.png", 180],
]) {
  fs.writeFileSync(path.join(out, name), icon(size));
  console.log("wrote", path.join(out, name));
}
