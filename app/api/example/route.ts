import type { NextRequest } from "next/server";
import { getExample } from "@/lib/examples";
import { validateWord } from "@/lib/words";

// GET /api/example?word=<단어>&skip=<이미 본 예문 id들, 쉼표로 구분>
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  // 단어장과 같은 규칙으로 검사해서, 아무 문자열이나 바깥 서비스로 넘기지 않는다.
  const check = validateWord(params.get("word") ?? "", []);
  if (!check.ok) return Response.json({ ok: false, error: "invalid_word" }, { status: 400 });

  const skip = (params.get("skip") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 50);

  const result = await getExample(check.text, skip);
  return Response.json(result, { headers: { "Cache-Control": "no-store" } });
}
