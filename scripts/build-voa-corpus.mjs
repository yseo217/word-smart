// VOA Learning English 기사를 문장 단위로 모아 data/voa-sentences.json을 만든다 (DESIGN.md 6.4).
// 개발 컴퓨터에서 직접 실행한다:  node scripts/build-voa-corpus.mjs --limit 300
//
// 지키는 것
// - 사이트 검색(/s?k=)은 robots.txt가 막으므로 쓰지 않고, 공개된 sitemap.xml로 기사 주소를 얻는다.
// - 요청은 1초 넘게 간격을 두고, 식별 가능한 이름만 붙인다. 개인 연락처(이메일 등)는 절대 넣지 않는다.
// - 통신사(AP, Reuters, AFP) 기사와 기사가 아닌 페이지는 뺀다.
// - 본문 문단만 뽑는다. 사진 설명, 단어 풀이(Words in This Story), 공유 버튼 글자는 뽑지 않는다.
// - VOA Learning English 텍스트는 퍼블릭 도메인이라 보관 기간 제한이 없다. 출처는 기사 링크로 남긴다.

import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { pathToFileURL } from "node:url";

const SITE = "https://learningenglish.voanews.com";
const USER_AGENT = "WordSmart corpus builder/0.1 (personal learning project)";
const GAP_MS = 1100;

const args = process.argv.slice(2);
const limit = Number(argValue("--limit") ?? 300);
const outPath = argValue("--out") ?? path.join("data", "voa-sentences.json");

function argValue(name) {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(url) {
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const isGzip = buf.length > 2 && buf[0] === 0x1f && buf[1] === 0x8b;
  return (isGzip ? zlib.gunzipSync(buf) : buf).toString("utf8");
}

const locs = (xml) => [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());

// ---- 1. 기사 주소 모으기 (최신순) ----
async function listArticleUrls() {
  const index = await get(`${SITE}/sitemap.xml`);
  const sitemaps = locs(index).filter((u) => !/sections|videos/.test(u));
  const urls = new Set();
  for (const sm of sitemaps) {
    await sleep(GAP_MS);
    try {
      // 글 기사는 /a/<제목-슬러그>/<번호>.html 꼴이다. 슬러그가 없는 /a/<번호>.html은 생방송·영상 페이지라 본문이 없고,
      // learning-english-podcast 슬러그는 팟캐스트 안내 페이지라 뺀다. (2026-10-25 확인)
      for (const u of locs(await get(sm))) {
        if (/\/a\/[^/]+\/\d+\.html$/.test(u) && !/\/a\/[^/]*learning-english-podcast[^/]*\//.test(u)) urls.add(u);
      }
    } catch (e) {
      console.warn(`sitemap skipped: ${sm} (${e.message})`);
    }
  }
  // 주소 끝의 숫자가 기사 번호이고 시간이 지날수록 커지므로, 큰 번호가 최근 기사다.
  const idOf = (u) => Number(u.match(/(\d+)\.html$/)[1]);
  return [...urls].sort((a, b) => idOf(b) - idOf(a));
}

// ---- 2. 기사 한 개 처리 ----
const decode = (s) =>
  s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;|&apos;/g, "'")
    .replace(/&#xA0;|&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&[a-z]+;/gi, " ");

const WIRE = [
  /\b(reported|wrote)\b[^.]*\bfor (The )?(Associated Press|Reuters|AFP|Agence France[- ]Presse)\b/i,
  /\badapted (it|this( story)?) for VOA\b/i,
  /\bAdditional reporting (came )?from\b[^.]*\b(Associated Press|Reuters|AFP)\b/i,
  // 2026-10-27 추가 (PLAN 24 점검): "… adapted this story based on an AFP report." / "… wrote this story, based on reports from …, The Associated Press and Reuters." 꼴이 빠져 있었다.
  /\b(adapted|wrote)\b[^.]*\bbased on\b[^.]*\b(Associated Press|AP|Reuters|AFP|Agence France[- ]Presse)\b/i,
];
const CREDIT_END = /\b(wrote|reported|adapted|produced)\b[^.]*\b(for|by) (VOA )?Learning English\b/i;
const SIGN_OFF = /^I['’]m [A-Z][A-Za-z.'-]+( [A-Z][A-Za-z.'-]+){0,2}\.$/;

export function extractArticle(html, url) {
  const title = decode((html.match(/<title>([^<]*)<\/title>/) || [, ""])[1]).replace(/\s+/g, " ").trim();
  if (/Learning English Podcast/i.test(title)) return { skip: "podcast" };
  if (/^Quiz\b/i.test(title)) return { skip: "quiz" };

  const start = html.indexOf('<div class="wsw">');
  if (start < 0) return { skip: "no_body" };
  let body = html.slice(start);
  // 단어 풀이와 공유 영역 앞에서 자른다.
  for (const marker of [/<h2[^>]*>\s*Words in This Story/i, /<div class="[^"]*article-share/i, /<section[^>]*comments/i]) {
    const m = body.match(marker);
    if (m) body = body.slice(0, m.index);
  }

  const paragraphs = [];
  let wire = false;
  for (const m of body.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g)) {
    const text = decode(m[1].replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim();
    if (!text) continue;
    if (/^_{5,}$/.test(text)) break; // 단어 풀이 앞의 구분선
    if (text.length <= 260 && WIRE.some((re) => re.test(text))) {
      wire = true;
      break;
    }
    if (text.length <= 260 && CREDIT_END.test(text)) break; // VOA 자체 기사의 크레디트: 여기서 본문이 끝난다
    if (SIGN_OFF.test(text)) continue;
    if (/^No media source/i.test(text)) continue;
    if (text.length < 40) continue;
    paragraphs.push(text);
  }
  if (wire) return { skip: "wire" };
  if (paragraphs.length <= 2) return { skip: "too_short" };

  const sentences = [];
  for (const p of paragraphs) for (const s of splitSentences(p)) if (isGoodSentence(s)) sentences.push(s);
  if (sentences.length < 3) return { skip: "too_short" };
  return { article: { url, title, sentences } };
}

// 마침표 뒤에서 나누되, Mr. / U.S. 같은 약어 뒤에서는 나누지 않는다.
function splitSentences(paragraph) {
  return paragraph
    .split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|No|vs|U\.S|U\.N|U\.K|E\.U)\.)(?<=[.!?]["”’)]?)\s+(?=["“(]?[A-Z0-9])/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function isGoodSentence(s) {
  if (s.length < 20 || s.length > 300) return false;
  if (s.split(/\s+/).length < 4) return false;
  if (!/[.!?]["”’)]?$/.test(s)) return false;
  if (/_{3,}/.test(s)) return false;
  if (s === s.toUpperCase()) return false;
  if (/VOA Learning English|Words and Their Stories|^And now\b/.test(s)) return false; // 프로그램 인사말
  return true;
}

// ---- 3. 실행 ----
async function main() {
  console.log(`listing articles from sitemaps…`);
  const urls = await listArticleUrls();
  console.log(`found ${urls.length} article urls; fetching the ${limit} most recent`);

  const articles = [];
  const skipped = {};
  const picked = urls.slice(0, limit);
  for (let i = 0; i < picked.length; i++) {
    const url = picked[i];
    await sleep(GAP_MS);
    try {
      const html = await get(url);
      const r = extractArticle(html, url);
      if (r.article) articles.push(r.article);
      else skipped[r.skip] = (skipped[r.skip] ?? 0) + 1;
    } catch (e) {
      skipped.fetch_error = (skipped.fetch_error ?? 0) + 1;
      console.warn(`  ! ${url}: ${e.message}`);
    }
    if ((i + 1) % 25 === 0 || i + 1 === picked.length) {
      console.log(`  ${i + 1}/${picked.length} fetched, ${articles.length} kept`);
    }
  }

  const out = {
    builtAt: new Date().toISOString(),
    source: "VOA Learning English (learningenglish.voanews.com)",
    license: "Public domain. Credit: learningenglish.voanews.com. Wire-service (AP, Reuters, AFP) stories excluded.",
    requested: picked.length,
    articles,
  };
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(out));
  const sentenceCount = articles.reduce((n, a) => n + a.sentences.length, 0);
  console.log(`\nwrote ${outPath}`);
  console.log(`articles kept: ${articles.length} / ${picked.length}; sentences: ${sentenceCount}`);
  console.log(`skipped:`, skipped);
}

// 직접 실행했을 때만 돌린다 (테스트에서 extractArticle만 불러 쓸 수 있게).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
