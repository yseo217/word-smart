// 예문 고르기의 순수 로직 (DESIGN.md 6장). 파일 읽기와 네트워크는 examples.ts가 맡는다.
import { containsFormAsCommonWord, formsPattern } from "./forms.ts";
import { levelAllows, type FrequencyMap } from "./level.ts";

export const MAX_EXAMPLE_CHARS = 300;

export type VoaArticle = { url: string; title: string; sentences: string[] };
export type VoaCorpus = { articles: VoaArticle[] };

export type ExampleSource = { name: string; url: string; license?: string };

export type Example = {
  ok: true;
  kind: "voa" | "dictionary";
  id: string;
  before?: string;
  sentence: string;
  after?: string;
  pattern: string; // 화면에서 단어를 강조할 때 쓰는 정규식 소스 (forms.ts)
  source: ExampleSource;
};

export type ExampleResult = Example | { ok: false };

export const NO_EXAMPLE: ExampleResult = { ok: false };

type Candidate = { id: string; article: VoaArticle; index: number };

// 모음에서 단어(변화형 포함)가 든 문장을 모두 찾는다. 고유명사로만 쓰인 문장은 뺀다 (PRD 5번 ②).
export function findVoaCandidates(corpus: VoaCorpus, word: string): Candidate[] {
  const out: Candidate[] = [];
  corpus.articles.forEach((article, a) => {
    article.sentences.forEach((s, i) => {
      if (containsFormAsCommonWord(s, word)) out.push({ id: `voa:${a}:${i}`, article, index: i });
    });
  });
  return out;
}

// 앞 문장 또는 뒷 문장 중 더 긴 쪽을 붙인다. 합쳐서 300자를 넘으면 다른 쪽, 둘 다 넘으면 문장만.
export function withContext(sentences: readonly string[], index: number): { before?: string; sentence: string; after?: string } {
  const sentence = sentences[index];
  const prev = index > 0 ? sentences[index - 1] : undefined;
  const next = index < sentences.length - 1 ? sentences[index + 1] : undefined;
  const fits = (s?: string) => s !== undefined && sentence.length + 1 + s.length <= MAX_EXAMPLE_CHARS;
  const options = [prev, next].filter((s): s is string => s !== undefined).sort((a, b) => b.length - a.length);
  for (const s of options) {
    if (!fits(s)) continue;
    return s === prev ? { before: prev, sentence } : { sentence, after: next };
  }
  return { sentence };
}

export function exampleText(e: { before?: string; sentence: string; after?: string }): string {
  return [e.before, e.sentence, e.after].filter(Boolean).join(" ");
}

export function pickVoaExample(
  corpus: VoaCorpus,
  word: string,
  skip: readonly string[],
  freq: FrequencyMap,
  rng: () => number = Math.random,
): ExampleResult {
  const candidates = findVoaCandidates(corpus, word)
    .filter((c) => !skip.includes(c.id))
    .map((c) => ({ c, ctx: withContext(c.article.sentences, c.index) }))
    // 앞뒤 문장을 붙인 결과가 수준을 넘으면 붙이지 않고, 문장만으로도 넘으면 쓰지 않는다 (6.6)
    .map(({ c, ctx }) => ({ c, ctx: levelAllows(exampleText(ctx), word, freq) ? ctx : { sentence: ctx.sentence } }))
    .filter(({ ctx }) => levelAllows(ctx.sentence, word, freq));
  if (candidates.length === 0) return NO_EXAMPLE;
  const { c, ctx } = candidates[Math.floor(rng() * candidates.length)];
  return {
    ok: true,
    kind: "voa",
    id: c.id,
    ...ctx,
    pattern: formsPattern(word),
    source: { name: "VOA Learning English", url: c.article.url, license: "Public domain" },
  };
}

// Free Dictionary API 응답에서 예문을 고른다.
type DictionaryEntry = {
  meanings?: { definitions?: { example?: string }[] }[];
  sourceUrls?: string[];
};

export function pickDictionaryExample(
  entries: unknown,
  word: string,
  skip: readonly string[],
  freq: FrequencyMap,
  rng: () => number = Math.random,
): ExampleResult {
  if (!Array.isArray(entries)) return NO_EXAMPLE;
  const examples: { id: string; text: string; url: string }[] = [];
  (entries as DictionaryEntry[]).forEach((entry, e) => {
    // 사전 API가 준 출처 주소는 https일 때만 믿고, 아니면 위키낱말사전 단어 페이지로 (엉뚱한 사이트 링크 방지, 2026-10-28)
    const src = entry.sourceUrls?.[0];
    const url = typeof src === "string" && src.startsWith("https://") ? src : `https://en.wiktionary.org/wiki/${encodeURIComponent(word)}`;
    entry.meanings?.forEach((m, mi) =>
      m.definitions?.forEach((d, di) => {
        const text = d.example?.trim();
        if (text) examples.push({ id: `dict:${e}:${mi}:${di}`, text, url });
      }),
    );
  });
  const usable = examples.filter(
    (x) => !skip.includes(x.id) && containsFormAsCommonWord(x.text, word) && x.text.length <= MAX_EXAMPLE_CHARS && levelAllows(x.text, word, freq),
  );
  if (usable.length === 0) return NO_EXAMPLE;
  const x = usable[Math.floor(rng() * usable.length)];
  const sentence = /[.!?]["”’)]?$/.test(x.text) ? x.text : `${x.text}.`;
  return {
    ok: true,
    kind: "dictionary",
    id: x.id,
    sentence: sentence[0].toUpperCase() + sentence.slice(1),
    pattern: formsPattern(word),
    source: { name: "Wiktionary (Free Dictionary API)", url: x.url, license: "CC BY-SA 3.0" },
  };
}
