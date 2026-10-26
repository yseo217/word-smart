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
  if (outcome.gone) await writeSubscriptions(list.filter((s) => s.endpoint !== endpoint));
  return Response.json({ ok: outcome.ok, status: outcome.status ?? null }, { headers: { "Cache-Control": "no-store" } });
}
