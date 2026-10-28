import type { NextRequest } from "next/server";
import { pushConfigured, sendReminder } from "@/lib/push-send";
import { readSubscriptions, writeSubscriptions } from "@/lib/push-store";

// 이 기기에만 시험 알림을 보낸다 (Today 화면의 "Send a test"). 등록된 endpoint를 정확히 알아야 하므로 다른 사람이 쓸 수 없다.
// POST /api/push/test  본문: { endpoint: string }
export async function POST(request: NextRequest) {
  if (!pushConfigured()) return Response.json({ ok: false, error: "push_not_configured" }, { status: 503 });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }
  const endpoint = (body as { endpoint?: unknown } | null)?.endpoint;
  if (typeof endpoint !== "string") return Response.json({ ok: false, error: "invalid_endpoint" }, { status: 400 });

  const list = await readSubscriptions();
  const sub = list.find((s) => s.endpoint === endpoint);
  if (!sub) return Response.json({ ok: false, error: "not_subscribed" }, { status: 404 });

  const outcome = await sendReminder(sub);
  const headers = { "Cache-Control": "no-store" };
  if (outcome.gone) {
    // 푸시 서비스가 "이 기기는 더 이상 없다"(404·410)고 했으므로 목록에서 지우고 410으로 알린다. 화면은 이걸 보고 꺼진 상태로 돌아간다.
    await writeSubscriptions(list.filter((s) => s.endpoint !== endpoint));
    return Response.json({ ok: false, error: "gone" }, { status: 410, headers });
  }
  if (!outcome.ok) {
    // 서명 키·subject 오류(403 등)처럼 서버 쪽 문제. 200으로 숨기지 않고 502로 돌려줘야 화면이 "보냈다"고 잘못 말하지 않는다.
    // 푸시 서비스의 상태 코드는 응답에 넣지 않는다 (바깥에서 상태를 캐내는 데 쓰이지 않게, 2026-10-28).
    return Response.json({ ok: false, error: "send_failed" }, { status: 502, headers });
  }
  return Response.json({ ok: true }, { headers });
}
