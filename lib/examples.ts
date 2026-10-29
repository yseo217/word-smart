// 예문 가져오기 (서버에서만 쓴다): VOA 문장 모음 → Merriam-Webster(Learner's → Collegiate) → Free Dictionary API → 예문 없음 (DESIGN.md 6.1)
// 2026-10-29: Merriam-Webster 사전 두 개를 더했다. VOA Learning English는 쉬운 영어라 어려운 단어의 예문이 거의 없었기 때문이다.
import corpus from "@/data/voa-sentences.json";
import freq from "@/data/word-freq.json";
import { NO_EXAMPLE, pickDictionaryExample, pickVoaExample, type ExampleResult, type VoaCorpus } from "./examples-core.ts";
import type { FrequencyMap } from "./level.ts";
import { pickMwExample, type MwReference } from "./mw.ts";

const MW_API = "https://www.dictionaryapi.com/api/v3/references/";
const DICTIONARY_API = "https://api.dictionaryapi.dev/api/v2/entries/en/";
// 사전마다 최대 4초. MW 두 사전은 동시에 묻는다. (Vercel 함수 제한 10초 안에 VOA → MW 4초 → Free Dictionary 4초가 들어가야 한다)
const DICTIONARY_TIMEOUT_MS = 4000;
const USER_AGENT = "WordSmart example/0.1 (personal learning project)"; // 식별용 이름만, 개인 정보는 넣지 않는다 (CLAUDE.md)

// Merriam-Webster 키는 .env와 Vercel 환경 변수에만 있다. 없으면 그 사전은 건너뛴다. 키는 주소에 들어가므로 절대 로그에 남기지 않는다.
function mwKey(ref: MwReference): string | undefined {
  return ref === "learners" ? process.env.MW_LEARNERS_KEY : process.env.MW_COLLEGIATE_KEY;
}

async function fetchMw(ref: MwReference, word: string): Promise<unknown> {
  const key = mwKey(ref);
  if (!key) return null;
  try {
    const res = await fetch(`${MW_API}${ref}/json/${encodeURIComponent(word)}?key=${encodeURIComponent(key)}`, {
      signal: AbortSignal.timeout(DICTIONARY_TIMEOUT_MS),
      headers: { Accept: "application/json", "User-Agent": USER_AGENT },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null; // 시간 초과, 네트워크 오류, 잘못된 응답
  }
}

async function fetchFreeDictionary(word: string): Promise<unknown> {
  try {
    const res = await fetch(DICTIONARY_API + encodeURIComponent(word), {
      signal: AbortSignal.timeout(DICTIONARY_TIMEOUT_MS),
      headers: { Accept: "application/json", "User-Agent": USER_AGENT },
    });
    if (!res.ok) return null; // 404(단어 없음)와 530(서버 오류) 모두 "예문 없음"으로 처리
    return await res.json();
  } catch {
    return null;
  }
}

export async function getExample(word: string, skip: readonly string[]): Promise<ExampleResult> {
  const fromVoa = pickVoaExample(corpus as VoaCorpus, word, skip, freq as FrequencyMap);
  if (fromVoa.ok) return fromVoa;

  const [learners, collegiate] = await Promise.all([fetchMw("learners", word), fetchMw("collegiate", word)]);
  const fromLearners = pickMwExample(learners, "learners", word, skip, freq as FrequencyMap);
  if (fromLearners.ok) return fromLearners;
  const fromCollegiate = pickMwExample(collegiate, "collegiate", word, skip, freq as FrequencyMap);
  if (fromCollegiate.ok) return fromCollegiate;

  const entries = await fetchFreeDictionary(word);
  if (entries === null) return NO_EXAMPLE;
  return pickDictionaryExample(entries, word, skip, freq as FrequencyMap);
}
