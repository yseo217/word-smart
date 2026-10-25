// 예문 가져오기 (서버에서만 쓴다): VOA 문장 모음 → Free Dictionary API → 예문 없음 (DESIGN.md 6.1)
import corpus from "@/data/voa-sentences.json";
import freq from "@/data/word-freq.json";
import { NO_EXAMPLE, pickDictionaryExample, pickVoaExample, type ExampleResult, type VoaCorpus } from "./examples-core.ts";
import type { FrequencyMap } from "./level.ts";

const DICTIONARY_API = "https://api.dictionaryapi.dev/api/v2/entries/en/";
const DICTIONARY_TIMEOUT_MS = 6000;

export async function getExample(word: string, skip: readonly string[]): Promise<ExampleResult> {
  const fromVoa = pickVoaExample(corpus as VoaCorpus, word, skip, freq as FrequencyMap);
  if (fromVoa.ok) return fromVoa;

  try {
    const res = await fetch(DICTIONARY_API + encodeURIComponent(word), {
      signal: AbortSignal.timeout(DICTIONARY_TIMEOUT_MS),
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return NO_EXAMPLE; // 404(단어 없음)와 530(서버 오류) 모두 "예문 없음"으로 처리
    return pickDictionaryExample(await res.json(), word, skip, freq as FrequencyMap);
  } catch {
    return NO_EXAMPLE; // 시간 초과, 네트워크 오류
  }
}
