import type { NextRequest } from "next/server";
import { addSubscription, canAddSubscription, parseSubscription, removeSubscription } from "@/lib/push";
import { readSubscriptions, writeSubscriptions } from "@/lib/push-store";

// 푸시 구독 등록·해제 (DESIGN.md 13장). 브라우저가 준 구독 정보(기기의 알림 주소와 키)만 저장하고, 학습 기록은 받지 않는다.
// 서버는 받은 내용을 로그에 쓰지 않는다 (PRD 7번).

// POST /api/push/subscribe  본문: { subscription: PushSubscriptionJSON }
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }
  const sub = parseSubscription((body as { subscription?: unknown } | null)?.subscription);
  if (!sub) return Response.json({ ok: false, error: "invalid_subscription" }, { status: 400 });

  const list = await readSubscriptions();
  if (!canAddSubscription(list, sub)) return Response.json({ ok: false, error: "too_many" }, { status: 409 }); // 상한 10개 (DESIGN 13.6)
  await writeSubscriptions(addSubscription(list, sub));
  return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}

// DELETE /api/push/subscribe  본문: { endpoint: string }
export async function DELETE(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }
  const endpoint = (body as { endpoint?: unknown } | null)?.endpoint;
  if (typeof endpoint !== "string" || !endpoint.startsWith("https://")) {
    return Response.json({ ok: false, error: "invalid_endpoint" }, { status: 400 });
  }
  const list = await readSubscriptions();
  const next = removeSubscription(list, endpoint);
  if (next.length !== list.length) await writeSubscriptions(next); // 지운 게 없으면 저장도 하지 않는다 (호출 폭주로 Blob 쓰기 한도를 쓰지 않게)
  return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
