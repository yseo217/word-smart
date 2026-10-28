import { test } from "node:test";
import assert from "node:assert/strict";
import {
  addSubscription,
  canAddSubscription,
  isReminderHour,
  MAX_SUBSCRIPTIONS,
  kstHour,
  ordinal,
  parseSubscription,
  parseSubscriptionList,
  REMINDER_HOURS_KST,
  reminderPayload,
  removeSubscription,
  roundNumberAt,
} from "./push.ts";

const NOW = new Date("2026-10-26T00:00:00.000Z"); // 한국 시간 09:00

const SUB = {
  endpoint: "https://web.push.apple.com/abc123",
  keys: { p256dh: "BPzK0_example-key_-", auth: "authkey_01" },
};

test("reminder payload names the round by the hour and opens the review screen", () => {
  const p = reminderPayload(NOW); // 09:00 KST
  assert.equal(p.title, "Word Smart");
  assert.equal(p.body, "Time for 1st round");
  assert.equal(p.url, "/review");
  assert.equal(p.tag, "wordsmart-round");
  assert.equal(reminderPayload(new Date("2026-10-26T02:00:00.000Z")).body, "Time for 2nd round"); // 11시
  assert.equal(reminderPayload(new Date("2026-10-26T04:00:00.000Z")).body, "Time for 3rd round"); // 13시
  assert.equal(reminderPayload(new Date("2026-10-26T08:30:00.000Z")).body, "Time for 4th round"); // 17시 30분
  assert.equal(reminderPayload(new Date("2026-10-26T10:00:00.000Z")).body, "Time for 5th round"); // 19시
  assert.equal(reminderPayload(new Date("2026-10-26T06:00:00.000Z")).body, "Time for a round"); // 15시: 시험 알림
  assert.doesNotMatch(p.body, /\/5|remembered|knew|%/); // 횟수·기억률 같은 기록은 넣지 않는다 (회차 번호는 시각에서 나온다)
});

test("roundNumberAt and ordinal", () => {
  assert.equal(roundNumberAt(NOW), 1);
  assert.equal(roundNumberAt(new Date("2026-10-26T01:00:00.000Z")), null);
  assert.deepEqual([1, 2, 3, 4, 5].map(ordinal), ["1st", "2nd", "3rd", "4th", "5th"]);
});

test("reminder hours are 9, 11, 13, 17, 19 in Korean time", () => {
  assert.deepEqual([...REMINDER_HOURS_KST], [9, 11, 13, 17, 19]);
  assert.equal(kstHour(NOW), 9);
  assert.equal(isReminderHour(NOW), true);
  assert.equal(isReminderHour(new Date("2026-10-26T01:00:00.000Z")), false); // 10시
  assert.equal(isReminderHour(new Date("2026-10-26T10:00:00.000Z")), true); // 19시
  assert.equal(isReminderHour(new Date("2026-10-26T15:00:00.000Z")), false); // 0시 (날짜 넘김)
});

test("parseSubscription accepts a browser subscription and rejects junk", () => {
  const parsed = parseSubscription(SUB, NOW);
  assert.deepEqual(parsed, { ...SUB, addedAt: NOW.toISOString() });
  assert.equal(parseSubscription(null), null);
  assert.equal(parseSubscription({ endpoint: "http://insecure.example/x", keys: SUB.keys }), null); // https만
  // 실제 푸시 서비스 도메인만 받는다 (남의 서버로 요청을 보내는 중계기가 되지 않게)
  assert.equal(parseSubscription({ endpoint: "https://evil.example/collect", keys: SUB.keys }), null);
  assert.equal(parseSubscription({ endpoint: "https://web.push.apple.com:8443/abc", keys: SUB.keys }), null); // 포트 지정 금지
  assert.equal(parseSubscription({ endpoint: "https://notpush.apple.com.evil.example/x", keys: SUB.keys }), null);
  assert.notEqual(parseSubscription({ endpoint: "https://updates.push.services.mozilla.com/wpush/v2/abc", keys: SUB.keys }), null);
  assert.notEqual(parseSubscription({ endpoint: "https://wns2-bl2p.notify.windows.com/w/?token=abc", keys: SUB.keys }), null);
  assert.equal(parseSubscription({ endpoint: SUB.endpoint, keys: { p256dh: "a b", auth: "x" } }), null); // 키에 공백
  assert.equal(parseSubscription({ endpoint: SUB.endpoint }), null);
  // 브라우저 구독 객체에 있는 다른 필드(expirationTime 등)는 버린다
  const extra = parseSubscription({ ...SUB, expirationTime: null, something: 1 }, NOW);
  assert.deepEqual(Object.keys(extra ?? {}).sort(), ["addedAt", "endpoint", "keys"]);
});

test("addSubscription keeps one record per endpoint; removeSubscription drops it", () => {
  const a = parseSubscription(SUB, NOW)!;
  const b = parseSubscription({ ...SUB, endpoint: "https://fcm.googleapis.com/fcm/send/xyz" }, NOW)!;
  const renewed = parseSubscription({ ...SUB, keys: { p256dh: "newkey", auth: "newauth" } }, NOW)!;
  let list = addSubscription([], a);
  list = addSubscription(list, b);
  list = addSubscription(list, renewed);
  assert.equal(list.length, 2);
  assert.equal(list.find((s) => s.endpoint === SUB.endpoint)?.keys.p256dh, "newkey");
  assert.deepEqual(removeSubscription(list, SUB.endpoint), [b]);
});

test("canAddSubscription caps the list at 10 devices but always allows re-registering a known one", () => {
  const make = (i: number) => parseSubscription({ ...SUB, endpoint: `https://fcm.googleapis.com/fcm/send/device-${i}` }, NOW)!;
  const full = Array.from({ length: MAX_SUBSCRIPTIONS }, (_, i) => make(i));
  assert.equal(MAX_SUBSCRIPTIONS, 10);
  assert.equal(canAddSubscription(full.slice(0, 9), make(99)), true);
  assert.equal(canAddSubscription(full, make(99)), false);
  assert.equal(canAddSubscription(full, make(3)), true); // 이미 있는 기기의 재등록
});

test("parseSubscriptionList reads the stored file and skips broken entries", () => {
  const stored = JSON.stringify([{ ...SUB, addedAt: "2026-10-20T00:00:00.000Z" }, { endpoint: "nope" }, 42]);
  const list = parseSubscriptionList(stored);
  assert.equal(list.length, 1);
  assert.equal(list[0].addedAt, "2026-10-20T00:00:00.000Z");
  assert.deepEqual(parseSubscriptionList("{broken"), []);
  assert.deepEqual(parseSubscriptionList("{}"), []);
});
