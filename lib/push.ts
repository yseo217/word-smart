// 푸시 알림의 순수 규칙 (PRD 5번 nice "정해진 시각 알림", DESIGN.md 13장). 네트워크·저장은 push-store.ts와 push-send.ts가 맡는다.

// 알림 시각 (한국 시간). PRD 3번의 권장 시각 그대로이며 앱에서는 켜기/끄기만 한다.
export const REMINDER_HOURS_KST = [9, 11, 13, 17, 19] as const;

// 알림 하나의 내용. 학습 기록은 넣지 않는다 (서버는 단어장·기록을 모르고, 알아서도 안 된다 — PRD 7번).
// "몇 번째 회차"는 기록이 아니라 시각으로 정한다: 9시 → 1st, 11시 → 2nd, 13시 → 3rd, 17시 → 4th, 19시 → 5th.
export type ReminderPayload = { title: string; body: string; url: string; tag: string };

export function reminderPayload(now: Date = new Date()): ReminderPayload {
  const n = roundNumberAt(now);
  return {
    title: "Word Smart",
    body: n === null ? "Time for a round" : `Time for ${ordinal(n)} round`,
    url: "/review",
    tag: "wordsmart-round", // 같은 tag면 먼저 온 알림을 덮어써서 알림이 쌓이지 않는다
  };
}

// 지금이 알림 시각인가 (한국 시간의 '시'가 목록에 있는가). 스케줄러가 잘못 설정돼 다른 시각에 불러도 보내지 않기 위한 보호.
export function kstHour(now: Date): number {
  return (now.getUTCHours() + 9) % 24;
}

export function isReminderHour(now: Date): boolean {
  return roundNumberAt(now) !== null;
}

// 이 시각이 하루 중 몇 번째 알림인가 (1~5). 알림 시각이 아니면 null (시험 알림 등).
export function roundNumberAt(now: Date): number | null {
  const i = (REMINDER_HOURS_KST as readonly number[]).indexOf(kstHour(now));
  return i < 0 ? null : i + 1;
}

export function ordinal(n: number): string {
  const suffix = n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th";
  return `${n}${suffix}`;
}

// 브라우저가 준 구독 정보 중 서버가 보관하는 부분. endpoint는 이 기기로 알림을 보내는 주소다.
export type PushSubscriptionRecord = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  addedAt: string; // ISO
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

// 아무 JSON이나 저장하지 않도록 모양을 검사한다. 맞지 않으면 null.
export function parseSubscription(v: unknown, now: Date = new Date()): PushSubscriptionRecord | null {
  if (!isRecord(v) || typeof v.endpoint !== "string" || !isRecord(v.keys)) return null;
  const { endpoint, keys } = v;
  if (!/^https:\/\/[^\s]+$/.test(endpoint) || endpoint.length > 2048) return null;
  if (typeof keys.p256dh !== "string" || typeof keys.auth !== "string") return null;
  if (!/^[A-Za-z0-9_-]{1,512}$/.test(keys.p256dh) || !/^[A-Za-z0-9_-]{1,512}$/.test(keys.auth)) return null;
  return { endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth }, addedAt: now.toISOString() };
}

// 같은 기기(endpoint)는 하나만 둔다. 다시 구독하면 새 정보로 바꾼다.
export function addSubscription(list: readonly PushSubscriptionRecord[], sub: PushSubscriptionRecord): PushSubscriptionRecord[] {
  return [...list.filter((s) => s.endpoint !== sub.endpoint), sub];
}

export function removeSubscription(list: readonly PushSubscriptionRecord[], endpoint: string): PushSubscriptionRecord[] {
  return list.filter((s) => s.endpoint !== endpoint);
}

// 저장 파일(JSON)에서 목록을 읽는다. 깨진 항목은 버린다.
export function parseSubscriptionList(raw: string): PushSubscriptionRecord[] {
  try {
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data
      .map((item) => {
        const parsed = parseSubscription(item);
        if (!parsed) return null;
        const addedAt = isRecord(item) && typeof item.addedAt === "string" ? item.addedAt : parsed.addedAt;
        return { ...parsed, addedAt };
      })
      .filter((s): s is PushSubscriptionRecord => s !== null);
  } catch {
    return [];
  }
}
