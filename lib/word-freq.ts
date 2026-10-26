// 단어 빈도 목록 변환 (PLAN 21번, DESIGN.md 6.6): 받은 목록의 "단어 횟수" 줄을 읽어 { 단어: 순위 } 지도를 만든다.
// 이 지도가 비어 있지 않으면 lib/level.ts의 예문 수준 규칙이 켜진다.
// - 알파벳 소문자만으로 된 단어만 남긴다. 's, 't, mr., i-i 같은 토큰은 뺀다. 한 글자 단어는 a·i만 둔다.
// - 순위는 남은 단어 순서대로 1부터 다시 매긴다 (입력이 많이 쓰인 순서로 정렬돼 있다는 전제).
// - 수준 경계(LEVEL_BOUNDS)의 끝이 20,000이므로 기본 상한도 20,000개다. 그 뒤 단어는 "목록에 없음" = 수준 5로 본다.
import type { FrequencyMap } from "./level.ts";

export const DEFAULT_LIMIT = 20000;
const SINGLE_LETTER_WORDS = new Set(["a", "i"]);

// 목록에 넣을 단어인가: 알파벳 소문자만, 한 글자는 a·i만
export function isListWord(token: string): boolean {
  if (!/^[a-z]+$/.test(token)) return false;
  return token.length > 1 || SINGLE_LETTER_WORDS.has(token);
}

// "단어 횟수" 줄 묶음 → { 단어: 순위 }. 횟수가 숫자가 아닌 줄과 중복 단어는 건너뛴다.
export function buildFrequencyMap(text: string, limit = DEFAULT_LIMIT): FrequencyMap {
  const map: Record<string, number> = {};
  let rank = 0;
  for (const line of text.split(/\r?\n/)) {
    const [raw, count] = line.trim().split(/\s+/);
    if (!raw || !/^\d+$/.test(count ?? "")) continue;
    const word = raw.toLowerCase();
    if (!isListWord(word) || Object.hasOwn(map, word)) continue;
    map[word] = ++rank;
    if (rank >= limit) break;
  }
  return map;
}
