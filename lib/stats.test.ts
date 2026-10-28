import { test } from "node:test";
import assert from "node:assert/strict";
import { kstWeekStart } from "./kst.ts";
import { answerCurrent, startRound } from "./quiz.ts";
import { activeDaysLast4Weeks, daysSinceFirstUse, exampleRate, retention, roundsThisWeek, streakDays, todayAnswers } from "./stats.ts";
import { addWords, emptyStore, type Store } from "./store.ts";

// 2026-10-25은 일요일 (KST). 주의 시작은 10-19 월요일.
const SUNDAY = new Date("2026-10-25T03:00:00.000Z");
const first = () => 0;

function withWords(...inputs: string[]): Store {
  return addWords(emptyStore(), inputs.join("\n"), SUNDAY).store;
}

test("kstWeekStart returns the Monday of that KST week", () => {
  assert.equal(kstWeekStart(SUNDAY), "2026-10-19");
  assert.equal(kstWeekStart(new Date("2026-10-19T00:30:00.000Z")), "2026-10-19"); // 월요일 KST 09:30
  assert.equal(kstWeekStart(new Date("2026-10-18T15:30:00.000Z")), "2026-10-19"); // 월요일 KST 00:30
  assert.equal(kstWeekStart(new Date("2026-10-18T14:30:00.000Z")), "2026-10-12"); // 일요일 KST 23:30
});

test("finished rounds are recorded with their start date", () => {
  let store = startRound(withWords("a"), SUNDAY, first).store;
  store = answerCurrent(store, "known", SUNDAY).store;
  assert.deepEqual(store.rounds?.map((r) => r.date), ["2026-10-25"]);
});

test("roundsThisWeek and activeDaysLast4Weeks count recorded rounds by KST date", () => {
  const store: Store = {
    ...withWords("a"),
    rounds: [
      { at: "", date: "2026-10-25" },
      { at: "", date: "2026-10-25" },
      { at: "", date: "2026-10-19" }, // 이번 주 월요일
      { at: "", date: "2026-10-18" }, // 지난주 일요일
      { at: "", date: "2026-09-27" }, // 29일 전: 4주 창 밖
      { at: "", date: "2026-09-28" }, // 28일 창의 첫날
    ],
  };
  assert.equal(roundsThisWeek(store, SUNDAY), 3);
  assert.equal(activeDaysLast4Weeks(store, SUNDAY), 4); // 10-25, 10-19, 10-18, 09-28
});

test("today's count falls back to progress.completed when rounds were not recorded", () => {
  const store: Store = { ...withWords("a"), progress: { date: "2026-10-25", completed: 4 } };
  assert.equal(roundsThisWeek(store, SUNDAY), 4);
  assert.equal(activeDaysLast4Weeks(store, SUNDAY), 1);
  // 기록과 progress가 겹치면 큰 쪽만 쓴다
  const both: Store = { ...store, rounds: [{ at: "", date: "2026-10-25" }] };
  assert.equal(roundsThisWeek(both, SUNDAY), 4);
});

test("retention counts words first answered unknown and now known", () => {
  const base = withWords("a", "b", "c");
  const [a, b, c] = base.words;
  const store: Store = {
    ...base,
    words: [
      { ...a, firstAnswer: "unknown", lastAnswer: "known" },
      { ...b, firstAnswer: "unknown", lastAnswer: "unknown" },
      { ...c, firstAnswer: "known", lastAnswer: "known" }, // 대상 아님
    ],
  };
  assert.deepEqual(retention(store), { known: 1, total: 2, rate: 0.5 });
  assert.equal(retention(withWords("x")).rate, null);
});

test("exampleRate ignores logs without example info and needs 20 samples", () => {
  const base = withWords("a");
  const id = base.words[0].id;
  const logs = [
    ...Array.from({ length: 5 }, () => ({ wordId: id, at: "", answer: "known" as const })), // 정보 없음: 제외
    ...Array.from({ length: 15 }, () => ({ wordId: id, at: "", answer: "known" as const, example: "voa" as const })),
    ...Array.from({ length: 4 }, () => ({ wordId: id, at: "", answer: "known" as const, example: "none" as const })),
  ];
  assert.equal(exampleRate({ ...base, logs: logs.slice(0, 15) }).rate, null); // 10건뿐
  const r = exampleRate({ ...base, logs });
  assert.equal(r.sample, 19 + 0); // 15 + 4
  assert.equal(r.rate, null); // 19건 < 20
  const enough = exampleRate({ ...base, logs: [...logs, { wordId: id, at: "", answer: "known", example: "dictionary" }] });
  assert.equal(enough.sample, 20);
  assert.equal(enough.withExample, 16);
  assert.equal(enough.rate, 0.8);
});

test("daysSinceFirstUse counts the first day as day 1", () => {
  assert.equal(daysSinceFirstUse(emptyStore(), SUNDAY), null);
  assert.equal(daysSinceFirstUse({ ...emptyStore(), firstUsedAt: SUNDAY.toISOString() }, SUNDAY), 1);
  assert.equal(daysSinceFirstUse({ ...emptyStore(), firstUsedAt: "2026-10-18T00:00:00.000Z" }, SUNDAY), 8);
});

test("todayAnswers counts only today's answers by KST date", () => {
  const base = withWords("a", "b");
  const [a, b] = base.words;
  const store: Store = {
    ...base,
    logs: [
      { wordId: a.id, at: "2026-10-25T02:00:00.000Z", answer: "known" }, // KST 10-25 11:00 → 오늘
      { wordId: b.id, at: "2026-10-25T13:30:00.000Z", answer: "unknown" }, // KST 10-25 22:30 → 오늘
      { wordId: a.id, at: "2026-10-24T14:30:00.000Z", answer: "known" }, // KST 10-24 23:30 → 어제
      { wordId: b.id, at: "2026-10-25T15:30:00.000Z", answer: "known" }, // KST 10-26 00:30 → 내일
    ],
  };
  assert.deepEqual(todayAnswers(store, SUNDAY), { known: 1, unknown: 1 });
  assert.deepEqual(todayAnswers(emptyStore(), SUNDAY), { known: 0, unknown: 0 });
});

test("streakDays counts consecutive KST days with a finished round, ending today or yesterday", () => {
  const rounds = (...dates: string[]) => ({ ...withWords("a"), rounds: dates.map((date) => ({ at: "", date })) });
  assert.equal(streakDays(rounds("2026-10-25", "2026-10-24", "2026-10-23"), SUNDAY), 3); // 오늘 포함 3일
  assert.equal(streakDays(rounds("2026-10-24", "2026-10-23"), SUNDAY), 2); // 오늘은 아직, 어제까지 2일
  assert.equal(streakDays(rounds("2026-10-25", "2026-10-23"), SUNDAY), 1); // 어제가 비어 오늘부터 새로
  assert.equal(streakDays(rounds("2026-10-23", "2026-10-22"), SUNDAY), 0); // 어제도 없음
  assert.equal(streakDays(withWords("a"), SUNDAY), 0);
  // 오늘 횟수는 회차 기록이 없어도 progress.completed로 센다
  const onlyProgress: Store = { ...rounds("2026-10-24"), progress: { date: "2026-10-25", completed: 1 } };
  assert.equal(streakDays(onlyProgress, SUNDAY), 2);
});
