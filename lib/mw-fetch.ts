// Merriam-Webster 사전 API 호출 (서버에서만). 예문(lib/examples.ts)과 단어 뜻(app/api/define)이 같이 쓴다 (DESIGN.md 6장).
// 키는 .env와 Vercel 환경 변수에만 있다. 없으면 그 사전은 건너뛴다. 키는 주소에 들어가므로 절대 로그에 남기지 않는다.
import type { MwReference } from "./mw.ts";

const MW_API = "https://www.dictionaryapi.com/api/v3/references/";
export const MW_TIMEOUT_MS = 4000; // 사전마다 최대 4초
export const USER_AGENT = "WordSmart example/0.1 (personal learning project)"; // 식별용 이름만, 개인 정보는 넣지 않는다 (CLAUDE.md)

function mwKey(ref: MwReference): string | undefined {
  return ref === "learners" ? process.env.MW_LEARNERS_KEY : process.env.MW_COLLEGIATE_KEY;
}

export function mwConfigured(): boolean {
  return Boolean(mwKey("learners") || mwKey("collegiate"));
}

// 응답 JSON(항목 배열, 모르는 단어면 철자 제안 배열)을 돌려준다. 키 없음·시간 초과·오류는 null.
export async function fetchMw(ref: MwReference, word: string): Promise<unknown> {
  const key = mwKey(ref);
  if (!key) return null;
  try {
    const res = await fetch(`${MW_API}${ref}/json/${encodeURIComponent(word)}?key=${encodeURIComponent(key)}`, {
      signal: AbortSignal.timeout(MW_TIMEOUT_MS),
      headers: { Accept: "application/json", "User-Agent": USER_AGENT },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}
