// 홈 화면 추가용 아이콘과 알림 배지를 만든다 (PRD 4번 사용 환경, DESIGN.md 2장·13장). 외부 라이브러리 없이 PNG를 직접 쓴다.
// 그림 (2026-10-26 사용자 결정): 홈 유니폼처럼 흰 바탕에 가는 네이비 핀 스트라이프, 가운데 네이비 "W" 한 글자.
// 구단 로고·이름 같은 상표는 쓰지 않는다 — 글자는 우리 앱 이름의 W일 뿐이다.
//   node scripts/make-icons.mjs  →  public/icon-192.png, icon-512.png, apple-touch-icon.png (불투명), badge-96.png (투명 배경, W만)
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const NAVY = [12, 35, 64];
const WHITE = [252, 252, 249];
const STRIPE = [12, 35, 64];

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

// pixelAt(x, y) → [r, g, b] 또는 [r, g, b, a]. alpha가 true면 RGBA(투명 가능) PNG를 쓴다.
function png(size, pixelAt, alpha = false) {
  const channels = alpha ? 4 : 3;
  const rowLen = size * channels + 1;
  const raw = Buffer.alloc(rowLen * size);
  for (let y = 0; y < size; y++) {
    raw[y * rowLen] = 0; // 필터 없음
    for (let x = 0; x < size; x++) {
      const px = pixelAt(x, y);
      const o = y * rowLen + 1 + x * channels;
      raw[o] = px[0];
      raw[o + 1] = px[1];
      raw[o + 2] = px[2];
      if (alpha) raw[o + 3] = px[3] ?? 255;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // 비트 깊이
  ihdr[9] = alpha ? 6 : 2; // 6 = RGBA, 2 = RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---- "W" 글자: 굵은 선분 4개 (끝은 둥글게) ----
// 아이콘 한 변을 1로 본 좌표. 글자 폭 0.60, 높이 0.40, 가운데 꼭짓점은 조금 낮게.
const W_POINTS = [
  [0.2, 0.3],
  [0.35, 0.7],
  [0.5, 0.42],
  [0.65, 0.7],
  [0.8, 0.3],
];
const W_THICKNESS = 0.085; // 선 굵기 (한 변 기준)

function distToSegment(px, py, ax, ay, bx, by) {
  const vx = bx - ax;
  const vy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * vx + (py - ay) * vy) / (vx * vx + vy * vy)));
  const dx = px - (ax + t * vx);
  const dy = py - (ay + t * vy);
  return Math.hypot(dx, dy);
}

// 이 점(한 변 기준 좌표)이 W 안에 있나
function inW(u, v) {
  const half = W_THICKNESS / 2;
  for (let i = 0; i < W_POINTS.length - 1; i++) {
    const [ax, ay] = W_POINTS[i];
    const [bx, by] = W_POINTS[i + 1];
    if (distToSegment(u, v, ax, ay, bx, by) <= half) return true;
  }
  return false;
}

// 픽셀 하나를 4×4로 쪼개 W가 덮는 비율(0~1)을 구한다 (가장자리를 부드럽게)
function wCoverage(x, y, size) {
  const n = 4;
  let hit = 0;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (inW((x + (i + 0.5) / n) / size, (y + (j + 0.5) / n) / size)) hit++;
    }
  }
  return hit / (n * n);
}

function mix(a, b, t) {
  return [Math.round(a[0] + (b[0] - a[0]) * t), Math.round(a[1] + (b[1] - a[1]) * t), Math.round(a[2] + (b[2] - a[2]) * t)];
}

// 홈 화면 아이콘: 흰 바탕 + 핀 스트라이프 + W
function icon(size) {
  const stripeEvery = Math.max(8, Math.round(size / 14)); // 줄 간격
  const stripeWidth = Math.max(1, Math.round(size / 160)); // 줄 굵기 (192px에서 1px, 512px에서 3px)
  const offset = Math.round(stripeEvery / 2);
  return png(size, (x, y) => {
    const isStripe = (x + offset) % stripeEvery < stripeWidth;
    const base = isStripe ? mix(WHITE, STRIPE, 0.75) : WHITE;
    const cover = wCoverage(x, y, size);
    return cover === 0 ? base : mix(base, NAVY, cover);
  });
}

// 알림 배지 (안드로이드 상태 표시줄의 작은 단색 그림): 투명 배경에 W만. 아이폰은 쓰지 않는다.
function badge(size) {
  return png(
    size,
    (x, y) => {
      const cover = wCoverage(x, y, size);
      return [NAVY[0], NAVY[1], NAVY[2], Math.round(cover * 255)];
    },
    true,
  );
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
fs.writeFileSync(path.join(out, "badge-96.png"), badge(96));
console.log("wrote", path.join(out, "badge-96.png"));
