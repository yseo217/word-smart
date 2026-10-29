import type { NextRequest } from "next/server";
import { mwShortDefinition } from "@/lib/mw";
import { fetchMw, mwConfigured } from "@/lib/mw-fetch";
import { validateWord } from "@/lib/words";

// GET /api/define?words=<단어,단어,…>  (최대 10개)
// 단어장에 보여줄 짧은 뜻을 Merriam-Webster에서 받아 온다: Learner's → 없으면 Collegiate → 없으면 null (DESIGN.md 3장, 2026-10-30).
// 응답: { ok: true, definitions: { 단어: "뜻" | null } }. 바깥으로 나가는 것은 영어 단어뿐이고, 단어와 키를 로그에 남기지 않는다.
const MAX_WORDS = 10;

export async function GET(request: NextRequest) {
  const raw = (request.nextUrl.searchParams.get("words") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (raw.length === 0 || raw.length > MAX_WORDS) return Response.json({ ok: false, error: "bad_words" }, { status: 400 });
  // 단어장과 같은 규칙으로 검사해서, 아무 문자열이나 바깥 서비스로 넘기지 않는다.
  const words: string[] = [];
  for (const w of raw) {
    const check = validateWord(w, []);
    if (!check.ok) return Response.json({ ok: false, error: "invalid_word" }, { status: 400 });
    if (!words.includes(check.text)) words.push(check.text);
  }
  if (!mwConfigured()) return Response.json({ ok: false, error: "not_configured" }, { status: 503 });

  const definitions: Record<string, string | null> = {};
  await Promise.all(
    words.map(async (word) => {
      let def = mwShortDefinition(await fetchMw("learners", word), word);
      if (def === null) def = mwShortDefinition(await fetchMw("collegiate", word), word);
      definitions[word] = def;
    }),
  );
  return Response.json({ ok: true, definitions }, { headers: { "Cache-Control": "no-store" } });
}
