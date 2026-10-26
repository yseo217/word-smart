import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { isReminderHour, kstHour } from "@/lib/push";
import { pushConfigured, sendReminderToAll } from "@/lib/push-send";
import { readSubscriptions, writeSubscriptions } from "@/lib/push-store";

// 등록된 모든 기기에 복습 알림을 보낸다 (DESIGN.md 13장).
// 바깥 스케줄러(cron-job.org)가 한국 시간 9·11·13·17·19시에 부른다. 비밀 값은 Authorization 헤더로만 받는다(주소에 넣으면 로그에 남는다).
//   GET|POST /api/push/send            헤더: Authorization: Bearer <PUSH_CRON_SECRET>
//   GET|POST /api/push/send?force=1    알림 시각이 아니어도 보낸다 (시험용)

function authorized(request: NextRequest): boolean {
  const secret = process.env.PUSH_CRON_SECRET;
  const header = request.headers.get("authorization") ?? "";
  const given = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!secret || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function handle(request: NextRequest) {
  if (!authorized(request)) return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  if (!pushConfigured()) return Response.json({ ok: false, error: "push_not_configured" }, { status: 503 });

  const now = new Date();
  const force = request.nextUrl.searchParams.get("force") === "1";
  if (!force && !isReminderHour(now)) {
    return Response.json({ ok: true, sent: 0, skipped: "off_hours", kstHour: kstHour(now) }, { headers: { "Cache-Control": "no-store" } });
  }

  const list = await readSubscriptions();
  const outcomes = await sendReminderToAll(list);
  const gone = new Set(outcomes.filter((o) => o.gone).map((o) => o.endpoint));
  if (gone.size > 0) await writeSubscriptions(list.filter((s) => !gone.has(s.endpoint)));

  return Response.json(
    {
      ok: true,
      sent: outcomes.filter((o) => o.ok).length,
      failed: outcomes.filter((o) => !o.ok && !o.gone).length,
      removed: gone.size,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export const GET = handle;
export const POST = handle;
