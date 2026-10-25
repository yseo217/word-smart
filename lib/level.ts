// 단어와 문장의 수준 (DESIGN.md 6.6). 빈도 순위 목록(단어 → 순위)이 있어야 계산할 수 있다.
// 목록이 비어 있으면 수준을 알 수 없으므로(null) 거르지 않는다.
import { formsRegExp } from "./forms.ts";

export type FrequencyMap = Readonly<Record<string, number>>;

// 수준 경계 (제안값, 예문을 보면서 조정): 1: ~2000위, 2: ~5000위, 3: ~10000위, 4: ~20000위, 5: 그 밖
export const LEVEL_BOUNDS = [2000, 5000, 10000, 20000];
export const LONG_SENTENCE_WORDS = 25;
export const IGNORE_TOP_RATIO = 0.1;

export function hasFrequencyData(freq: FrequencyMap): boolean {
  return Object.keys(freq).length > 0;
}

function rankToLevel(rank: number | undefined): number {
  if (rank === undefined) return 5;
  const i = LEVEL_BOUNDS.findIndex((bound) => rank <= bound);
  return i < 0 ? 5 : i + 1;
}

// 어미를 떼어 내며 목록에서 찾는다. 못 찾으면 undefined.
function lookupRank(token: string, freq: FrequencyMap): number | undefined {
  const t = token.toLowerCase();
  const candidates = [t];
  if (t.endsWith("ies")) candidates.push(`${t.slice(0, -3)}y`);
  if (t.endsWith("ied")) candidates.push(`${t.slice(0, -3)}y`);
  if (t.endsWith("ing")) candidates.push(t.slice(0, -3), `${t.slice(0, -3)}e`, t.slice(0, -4));
  if (t.endsWith("ed")) candidates.push(t.slice(0, -2), t.slice(0, -1), t.slice(0, -3));
  if (t.endsWith("es")) candidates.push(t.slice(0, -2));
  if (t.endsWith("s")) candidates.push(t.slice(0, -1));
  if (t.endsWith("'s")) candidates.push(t.slice(0, -2));
  if (freq[t] !== undefined) return freq[t]; // "a", "I" 같은 한 글자 단어도 그대로 찾는다
  for (const c of candidates.slice(1)) {
    if (c.length >= 2 && freq[c] !== undefined) return freq[c];
  }
  return undefined;
}

export function wordLevel(word: string, freq: FrequencyMap): number | null {
  if (!hasFrequencyData(freq)) return null;
  return rankToLevel(lookupRank(word, freq));
}

// 묻는 단어(와 변화형), 고유명사(문장 중간의 대문자 단어), 숫자를 뺀 나머지 단어로 계산한다.
export function sentenceLevel(text: string, targetWord: string, freq: FrequencyMap): number | null {
  if (!hasFrequencyData(freq)) return null;
  const withoutTarget = text.replace(formsRegExp(targetWord), " ");
  const tokens = withoutTarget.match(/[A-Za-z][A-Za-z'-]*/g) ?? [];
  const levels: number[] = [];
  let first = true;
  for (const raw of tokens) {
    const token = raw.replace(/^'+|'+$/g, "");
    if (!token) continue;
    const capitalized = /^[A-Z]/.test(token);
    const isFirst = first;
    first = false;
    if (capitalized && !isFirst) continue; // 고유명사로 본다
    levels.push(rankToLevel(lookupRank(token, freq)));
  }
  if (levels.length === 0) return 1;
  levels.sort((a, b) => b - a);
  const drop = Math.floor(levels.length * IGNORE_TOP_RATIO);
  let level = levels[drop] ?? levels[levels.length - 1];
  const wordCount = (text.match(/[A-Za-z][A-Za-z'-]*/g) ?? []).length;
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
