// 푸시 알림 보내기 (서버 전용, DESIGN.md 13장). VAPID 키는 .env에서만 읽는다.
import webpush from "web-push";
import { reminderPayload, type PushSubscriptionRecord } from "./push.ts";

export function pushConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_SUBJECT);
}

let configured = false;
function ensureVapid(): void {
  if (configured) return;
  if (!pushConfigured()) throw new Error("push_not_configured");
  // subject는 이 서비스를 식별하는 https 주소. 이메일(mailto:)은 쓰지 않는다 (CLAUDE.md 개인정보 규칙).
  webpush.setVapidDetails(process.env.VAPID_SUBJECT!, process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);
  configured = true;
}

export type SendOutcome = { endpoint: string; ok: boolean; status?: number; gone: boolean };

// 구독 하나에 알림을 보낸다. 404·410은 기기가 구독을 끊은 것이라 gone으로 표시해 목록에서 지울 수 있게 한다.
export async function sendReminder(sub: PushSubscriptionRecord): Promise<SendOutcome> {
  try {
    ensureVapid(); // 키·subject 형식이 틀리면 여기서 예외가 난다 → 500이 아니라 "보내기 실패"(502)로 돌려준다
    const res = await webpush.sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, JSON.stringify(reminderPayload()), {
      TTL: 60 * 60, // 1시간 안에 못 전하면 버린다 (다음 알림 시각이 곧 온다)
      urgency: "normal",
    });
    return { endpoint: sub.endpoint, ok: true, status: res.statusCode, gone: false };
  } catch (e) {
    const status = (e as { statusCode?: number }).statusCode;
    return { endpoint: sub.endpoint, ok: false, status, gone: status === 404 || status === 410 };
  }
}

export async function sendReminderToAll(list: readonly PushSubscriptionRecord[]): Promise<SendOutcome[]> {
  return Promise.all(list.map((sub) => sendReminder(sub)));
}
