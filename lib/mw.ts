// Merriam-Webster 사전 API 응답에서 예문 고르기 (순수 로직, DESIGN.md 6.3). 실제 호출은 examples.ts가 맡는다.
// 2026-10-29 추가: VOA Learning English는 쉬운 영어라 어려운 단어의 예문이 거의 없어 "예문 없음"이 잦았다.
import { MAX_EXAMPLE_CHARS, NO_EXAMPLE, type ExampleResult } from "./examples-core.ts";
import { containsFormAsCommonWord, formsPattern } from "./forms.ts";
import { levelAllows, type FrequencyMap } from "./level.ts";

export type MwReference = "learners" | "collegiate";

// 화면에 적는 출처. Learner's 사전은 britannica.com으로 옮겨 갔다. 라이선스 칸에는 저작권 표시를 둔다 (API 약관의 출처 표시 조건).
export const MW_SOURCE: Record<MwReference, { name: string; site: (word: string) => string; license: string }> = {
  learners: { name: "Merriam-Webster Learner's Dictionary", site: (w) => `https://www.britannica.com/dictionary/${encodeURIComponent(w)}`, license: "© Merriam-Webster" },
  collegiate: { name: "Merriam-Webster Dictionary", site: (w) => `https://www.merriam-webster.com/dictionary/${encodeURIComponent(w)}`, license: "© Merriam-Webster" },
};

// MW 본문 표기를 보통 글자로 바꾼다: {it}…{/it}·{wi}…{/wi}(강조), [={it}impeded{/it}](동의어 풀이), {bc}(콜론), {ldquo}{rdquo}(따옴표),
// {sx|word||}·{d_link|word|…} 꼴(링크, 첫 칸이 글자), {dx}…{/dx}(참조). 모르는 표식은 지운다.
export function cleanMwText(raw: string): string {
  return raw
    .replace(/\[=[^\]]*\]/g, "")
    .replace(/\{dx[^}]*\}[\s\S]*?\{\/dx[^}]*\}/g, "")
    .replace(/\{ldquo\}/g, "“")
    .replace(/\{rdquo\}/g, "”")
    .replace(/\{bc\}/g, ": ")
    .replace(/\{(?:sx|dxt|d_link|a_link|i_link|et_link|mat|ma)\|([^|}]*)[^}]*\}/g, "$1")
    .replace(/\{[^}]*\}/g, "")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .trim();
}

type MwEntry = { meta?: { id?: string }; [k: string]: unknown };

// 한 응답에서 예문(vis)을 모두 꺼낸다. 표제어가 그 단어인 항목(cat)을 먼저 보고, 없으면 복합어 항목(cat burglar 등)까지 본다.
// 단어를 모르면 MW는 비슷한 철자 목록(문자열 배열)을 주는데, 그때는 예문이 없다.
export function mwExamples(entries: unknown, ref: MwReference, word: string): { id: string; text: string }[] {
  if (!Array.isArray(entries)) return [];
  const list = entries as unknown[];
  const headword = word.toLowerCase();
  const isObj = (e: unknown): e is MwEntry => typeof e === "object" && e !== null;
  const own = list.map((e, i) => ({ e, i })).filter(({ e }) => isObj(e) && (e.meta?.id ?? "").split(":")[0].toLowerCase() === headword);
  const chosen = own.length > 0 ? own : list.map((e, i) => ({ e, i })).filter(({ e }) => isObj(e));
  const out: { id: string; text: string }[] = [];
  for (const { e, i } of chosen) {
    let n = 0;
    const walk = (x: unknown): void => {
      if (Array.isArray(x)) {
        if (x[0] === "vis" && Array.isArray(x[1])) {
          for (const v of x[1] as { t?: unknown }[]) {
            if (typeof v?.t === "string") out.push({ id: `mw${ref[0]}:${i}:${n++}`, text: cleanMwText(v.t) });
          }
        } else x.forEach(walk);
      } else if (typeof x === "object" && x !== null) Object.values(x).forEach(walk);
    };
    walk(e);
  }
  return out;
}

// 단어장에 보여줄 짧은 뜻 하나 (2026-10-30): 응답의 shortdef 첫 항목. 표제어가 그 단어인 항목을 먼저, 없으면 아무 항목이나.
// 여러 품사가 있으면 첫 항목(MW가 가장 흔한 쓰임을 앞에 둔다). 뜻이 없으면 null.
export function mwShortDefinition(entries: unknown, word: string): string | null {
  if (!Array.isArray(entries)) return null;
  const headword = word.toLowerCase();
  const objs = (entries as unknown[]).filter((e): e is MwEntry & { shortdef?: unknown } => typeof e === "object" && e !== null);
  const own = objs.filter((e) => (e.meta?.id ?? "").split(":")[0].toLowerCase() === headword);
  for (const e of [...own, ...objs]) {
    const defs = Array.isArray(e.shortdef) ? (e.shortdef as unknown[]).filter((d): d is string => typeof d === "string" && d.trim().length > 0) : [];
    // "… —often used before another noun" 같은 용법 메모는 긴 줄표 앞에서 잘라 뜻만 남긴다
    if (defs.length > 0) return cleanMwText(defs[0].split(/\s*—/)[0]).trim() || null;
  }
  return null;
}

const isSentence = (t: string) => /^[A-Z“"]/.test(t) && /[.!?]["”’)]?$/.test(t);

// 쓸 수 있는 예문 하나를 무작위로 고른다. 완전한 문장을 먼저 보고, 없으면 "ubiquitous celebrities" 같은 구(句)도 받는다.
// 인용문 조각("… some young … cat …")은 뺀다. 단어(변화형)가 보통 단어로 들어 있고 300자 이하이며 수준이 맞아야 한다 (Free Dictionary와 같은 규칙).
export function pickMwExample(
  entries: unknown,
  ref: MwReference,
  word: string,
  skip: readonly string[],
  freq: FrequencyMap,
  rng: () => number = Math.random,
): ExampleResult {
  const usable = mwExamples(entries, ref, word).filter(
    (x) =>
      !skip.includes(x.id) &&
      x.text.length > 0 &&
      !x.text.includes("…") &&
      x.text.length <= MAX_EXAMPLE_CHARS &&
      containsFormAsCommonWord(x.text, word) &&
      levelAllows(x.text, word, freq),
  );
  if (usable.length === 0) return NO_EXAMPLE;
  const sentences = usable.filter((x) => isSentence(x.text));
  const pool = sentences.length > 0 ? sentences : usable;
  const x = pool[Math.floor(rng() * pool.length)];
  const sentence = /[.!?]["”’)]?$/.test(x.text) ? x.text : `${x.text}.`;
  const src = MW_SOURCE[ref];
  return {
    ok: true,
    kind: "dictionary",
    id: x.id,
    sentence: sentence[0].toUpperCase() + sentence.slice(1),
    pattern: formsPattern(word),
    source: { name: src.name, url: src.site(word), license: src.license },
  };
}
