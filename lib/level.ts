// 단어와 문장의 수준 (DESIGN.md 6.6). 빈도 순위 목록(단어 → 순위)이 있어야 계산할 수 있다.
// 목록이 비어 있으면 수준을 알 수 없으므로(null) 거르지 않는다.
import { formsRegExp } from "./forms.ts";

export type FrequencyMap = Readonly<Record<string, number>>;

// 수준 경계 (2026-10-26 확정, PLAN 22번): 1: ~4000위, 2: ~8000위, 3: ~13000위, 4: ~20000위, 5: 그 밖.
// 빈도 목록이 영화 자막 기준이라 뉴스에 흔한 단어(officials, countries, scientists)가 3,000~7,000위에 몰린다.
// 처음 제안값 [2000, 5000, 10000, 20000]으로는 수준 1 단어의 VOA 후보 문장이 15%만 통과했다.
export const LEVEL_BOUNDS = [4000, 8000, 13000, 20000];
// 이보다 긴 문장(앞뒤 문장을 붙인 전체)은 수준을 1 올린다. 25였을 때는 앞뒤 문장을 붙이면 거의 항상 걸렸다.
export const LONG_SENTENCE_WORDS = 40;
// 어려운 쪽에서 빼는 비율. 올림이라 짧은 문장에서도 최소 한 단어는 뺀다 (드문 단어 하나 섞인 것은 막지 않는다).
export const IGNORE_TOP_RATIO = 0.1;

// VOA 본문의 둥근 아포스트로피(’ ‘)를 곧은 것으로 바꾼다. 안 바꾸면 don’t가 don + t 두 토큰으로 쪼개진다.
function normalizeApostrophes(text: string): string {
  return text.replace(/[‘’]/g, "'");
}

export function hasFrequencyData(freq: FrequencyMap): boolean {
  return Object.keys(freq).length > 0;
}

function rankToLevel(rank: number | undefined): number {
  if (rank === undefined) return 5;
  const i = LEVEL_BOUNDS.findIndex((bound) => rank <= bound);
  return i < 0 ? 5 : i + 1;
}

// 어미를 떼어 내며 목록에서 찾는다. 못 찾으면 undefined.
// 목록에는 글자만으로 된 단어만 있으므로 축약형(don't, it's, we're)은 앞부분(do, it, we)으로 찾는다.
function lookupRank(token: string, freq: FrequencyMap): number | undefined {
  const t = token.toLowerCase();
  if (freq[t] !== undefined) return freq[t]; // "a", "I" 같은 한 글자 단어도 그대로 찾는다
  const contraction = /^(.+?)'(s|t|re|ve|ll|d|m)$/.exec(t);
  if (contraction) {
    const [, stem, suffix] = contraction;
    const stems = [stem];
    if (suffix === "t" && stem.endsWith("n")) stems.push(stem.slice(0, -1)); // don't → do, isn't → is
    for (const s of stems) {
      const rank = lookupRank(s, freq);
      if (rank !== undefined) return rank;
    }
    return undefined;
  }
  const candidates: string[] = [];
  if (t.endsWith("ies")) candidates.push(`${t.slice(0, -3)}y`);
  if (t.endsWith("ied")) candidates.push(`${t.slice(0, -3)}y`);
  if (t.endsWith("ing")) candidates.push(t.slice(0, -3), `${t.slice(0, -3)}e`, t.slice(0, -4));
  if (t.endsWith("ed")) candidates.push(t.slice(0, -2), t.slice(0, -1), t.slice(0, -3));
  if (t.endsWith("es")) candidates.push(t.slice(0, -2));
  if (t.endsWith("s")) candidates.push(t.slice(0, -1));
  for (const c of candidates) {
    if (c.length >= 2 && freq[c] !== undefined) return freq[c];
  }
  return undefined;
}

export function wordLevel(word: string, freq: FrequencyMap): number | null {
  if (!hasFrequencyData(freq)) return null;
  return rankToLevel(lookupRank(word, freq));
}

// 묻는 단어(와 변화형), 고유명사, 숫자를 뺀 나머지 단어로 계산한다.
// 고유명사: 문장 중간의 대문자 단어. 문장 첫 단어는 보통 단어일 수 있으므로, 소문자로 목록에 없을 때만 고유명사로 본다.
export function sentenceLevel(text: string, targetWord: string, freq: FrequencyMap): number | null {
  if (!hasFrequencyData(freq)) return null;
  const normalized = normalizeApostrophes(text);
  const withoutTarget = normalized.replace(formsRegExp(targetWord), " ");
  const tokens = withoutTarget.match(/[A-Za-z][A-Za-z'-]*/g) ?? [];
  const levels: number[] = [];
  let first = true;
  for (const raw of tokens) {
    const token = raw.replace(/^'+|'+$/g, "");
    if (!token) continue;
    const capitalized = /^[A-Z]/.test(token);
    const isFirst = first;
    first = false;
    const rank = lookupRank(token, freq);
    if (capitalized && (!isFirst || rank === undefined)) continue; // 고유명사로 본다
    levels.push(rankToLevel(rank));
  }
  if (levels.length === 0) return 1;
  levels.sort((a, b) => b - a);
  const drop = Math.ceil(levels.length * IGNORE_TOP_RATIO);
  let level = levels[drop] ?? levels[levels.length - 1];
  const wordCount = (normalized.match(/[A-Za-z][A-Za-z'-]*/g) ?? []).length;
  if (wordCount > LONG_SENTENCE_WORDS) level = Math.min(5, level + 1);
  return level;
}

// 통과 조건: 문장 수준 ≤ 단어 수준. 수준을 알 수 없으면(목록 없음) 통과.
export function levelAllows(text: string, targetWord: string, freq: FrequencyMap): boolean {
  const w = wordLevel(targetWord, freq);
  const s = sentenceLevel(text, targetWord, freq);
  if (w === null || s === null) return true;
  return s <= w;
}
