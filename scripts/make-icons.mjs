// 홈 화면 추가용 아이콘과 알림 배지를 만든다 (PRD 4번 사용 환경, DESIGN.md 2장·13장). PNG는 직접 쓴다.
// 그림 (2026-10-26 사용자 결정): 홈 유니폼처럼 흰 바탕에 가는 네이비 핀 스트라이프, 가운데 네이비 "W" 한 글자.
// W는 앱 상단 띠의 "WORD SMART"와 같은 글꼴(Playfair Display, 굵기 900)의 글자 모양을 scripts/fonts/의 글꼴 파일에서 읽어 그린다.
// 구단 로고·이름 같은 상표는 쓰지 않는다 — 글자는 우리 앱 이름의 W일 뿐이다.
//   node scripts/make-icons.mjs  →  public/icon-192.png, icon-512.png, apple-touch-icon.png (불투명), badge-96.png (투명 배경, W만)
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import opentype from "opentype.js";

const NAVY = [12, 35, 64];
const WHITE = [252, 252, 249];
const STRIPE = [12, 35, 64];

// 글꼴: Playfair Display Black (SIL Open Font License 1.1, scripts/fonts/OFL.txt). 앱의 next/font/google 설정과 같은 글꼴이다.
const FONT_FILE = path.join("scripts", "fonts", "PlayfairDisplay-Black.ttf");
const GLYPH_HEIGHT = 0.46; // 글자 높이 (아이콘 한 변 기준)
const GLYPH_CENTER_Y = 0.5; // 글자 세로 중심

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

// ---- 글꼴에서 W의 윤곽선을 읽어 다각형(한 변을 1로 본 좌표)으로 만든다 ----
function loadGlyphPolygons(char) {
  const buffer = fs.readFileSync(FONT_FILE);
  const font = opentype.parse(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength));
  const glyph = font.charToGlyph(char);
  const unitsPerEm = font.unitsPerEm;
  // 글자 크기 1em = 1 단위로 경로를 얻고(y는 아래로 증가), 나중에 아이콘 크기에 맞춘다.
  const commands = glyph.getPath(0, 0, 1).commands;

  // 곡선(Q·C)은 짧은 직선 여러 개로 나눈다.
  const contours = [];
  let current = [];
  let last = [0, 0];
  const STEPS = 24;
  for (const c of commands) {
    if (c.type === "M") {
      if (current.length) contours.push(current);
      current = [[c.x, c.y]];
      last = [c.x, c.y];
    } else if (c.type === "L") {
      current.push([c.x, c.y]);
      last = [c.x, c.y];
    } else if (c.type === "Q") {
      for (let i = 1; i <= STEPS; i++) {
        const t = i / STEPS;
        const x = (1 - t) ** 2 * last[0] + 2 * (1 - t) * t * c.x1 + t ** 2 * c.x;
        const y = (1 - t) ** 2 * last[1] + 2 * (1 - t) * t * c.y1 + t ** 2 * c.y;
        current.push([x, y]);
      }
      last = [c.x, c.y];
    } else if (c.type === "C") {
      for (let i = 1; i <= STEPS; i++) {
        const t = i / STEPS;
        const x = (1 - t) ** 3 * last[0] + 3 * (1 - t) ** 2 * t * c.x1 + 3 * (1 - t) * t ** 2 * c.x2 + t ** 3 * c.x;
        const y = (1 - t) ** 3 * last[1] + 3 * (1 - t) ** 2 * t * c.y1 + 3 * (1 - t) * t ** 2 * c.y2 + t ** 3 * c.y;
        current.push([x, y]);
      }
      last = [c.x, c.y];
    } else if (c.type === "Z") {
      if (current.length) contours.push(current);
      current = [];
    }
  }
  if (current.length) contours.push(current);

  // 글자의 실제 상자를 재서 아이콘 가운데에 맞춘다.
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const poly of contours) {
    for (const [x, y] of poly) {
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
  }
  const scale = GLYPH_HEIGHT / (maxY - minY);
  const offsetX = 0.5 - ((minX + maxX) / 2) * scale;
  const offsetY = GLYPH_CENTER_Y - ((minY + maxY) / 2) * scale;
  const polygons = contours.map((poly) => poly.map(([x, y]) => [x * scale + offsetX, y * scale + offsetY]));
  return { polygons, bbox: [minX * scale + offsetX, minY * scale + offsetY, maxX * scale + offsetX, maxY * scale + offsetY], unitsPerEm };
}

// 점이 글자 안에 있나: 윤곽선들에 대한 감김 수(non-zero winding)
function insideGlyph(u, v, polygons) {
  let winding = 0;
  for (const poly of polygons) {
    for (let i = 0, n = poly.length; i < n; i++) {
      const [x1, y1] = poly[i];
      const [x2, y2] = poly[(i + 1) % n];
      if (y1 <= v) {
        if (y2 > v && (x2 - x1) * (v - y1) - (u - x1) * (y2 - y1) > 0) winding++;
      } else if (y2 <= v && (x2 - x1) * (v - y1) - (u - x1) * (y2 - y1) < 0) {
        winding--;
      }
    }
  }
  return winding !== 0;
}

// 픽셀 하나를 4×4로 쪼개 글자가 덮는 비율(0~1)을 구한다 (가장자리를 부드럽게)
function makeCoverage(size, glyphShape) {
  const { polygons, bbox } = glyphShape;
  const n = 4;
  return (x, y) => {
    const u0 = x / size;
    const v0 = y / size;
    if (u0 + 1 / size < bbox[0] || u0 > bbox[2] || v0 + 1 / size < bbox[1] || v0 > bbox[3]) return 0;
    let hit = 0;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (insideGlyph((x + (i + 0.5) / n) / size, (y + (j + 0.5) / n) / size, polygons)) hit++;
      }
    }
    return hit / (n * n);
  };
}

function mix(a, b, t) {
  return [Math.round(a[0] + (b[0] - a[0]) * t), Math.round(a[1] + (b[1] - a[1]) * t), Math.round(a[2] + (b[2] - a[2]) * t)];
}

// 홈 화면 아이콘: 흰 바탕 + 핀 스트라이프 + W
function icon(size, glyphShape) {
  const coverage = makeCoverage(size, glyphShape);
  const stripeEvery = Math.max(8, Math.round(size / 14)); // 줄 간격
  const stripeWidth = Math.max(1, Math.round(size / 160)); // 줄 굵기 (192px에서 1px, 512px에서 3px)
  const offset = Math.round(stripeEvery / 2);
  return png(size, (x, y) => {
    const isStripe = (x + offset) % stripeEvery < stripeWidth;
    const base = isStripe ? mix(WHITE, STRIPE, 0.75) : WHITE;
    const cover = coverage(x, y);
    return cover === 0 ? base : mix(base, NAVY, cover);
  });
}

// 알림 배지 (안드로이드 상태 표시줄의 작은 단색 그림): 투명 배경에 W만. 아이폰은 쓰지 않는다.
function badge(size, glyphShape) {
  const coverage = makeCoverage(size, glyphShape);
  return png(size, (x, y) => [NAVY[0], NAVY[1], NAVY[2], Math.round(coverage(x, y) * 255)], true);
}

const glyphShape = loadGlyphPolygons("W");
const out = path.join("public");
fs.mkdirSync(out, { recursive: true });
for (const [name, size] of [
  ["icon-192.png", 192],
  ["icon-512.png", 512],
  ["apple-touch-icon.png", 180],
]) {
  fs.writeFileSync(path.join(out, name), icon(size, glyphShape));
  console.log("wrote", path.join(out, name));
}
fs.writeFileSync(path.join(out, "badge-96.png"), badge(96, glyphShape));
console.log("wrote", path.join(out, "badge-96.png"));
