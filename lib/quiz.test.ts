import { test } from "node:test";
import assert from "node:assert/strict";
import { kstDate } from "./kst.ts";
import {
  answerCurrent,
  completedToday,
  currentWord,
  googleSearchUrl,
  pickWords,
  removeFromHard,
  startRound,
  weightOf,
} from "./quiz.ts";
import { addWords, emptyStore, type Store, type Word } from "./store.ts";

const NOW = new Date("2026-10-25T03:00:00.000Z"); // KST 12:00

function withWords(...inputs: string[]): Store {
  return addWords(emptyStore(), inputs.join("\n"), NOW).store;
}

// 항상 같은 순서로 뽑히는 가짜 난수 (0에 가까우면 첫 단어)
const first = () => 0;

test("kstDate uses Korean time, which is 9 hours ahead of UTC", () => {
  assert.equal(kstDate(new Date("2026-10-25T14:59:59.000Z")), "2026-10-25");
  assert.equal(kstDate(new Date("2026-10-25T15:00:00.000Z")), "2026-10-26");
});

test("pickWords never repeats a word and takes only what exists", () => {
  const { words } = withWords("a", "b", "c", "d");
  const picked = pickWords(words, 3, Math.random);
  assert.equal(new Set(picked.map((w) => w.id)).size, 3);
  assert.equal(pickWords(words.slice(0, 2), 3).length, 2);
  assert.equal(pickWords([], 3).length, 0);
});

test("a word last answered 'unknown' or on the hard list has double weight", () => {
  const w = withWords("a").words[0];
  assert.equal(weightOf(w), 1);
  assert.equal(weightOf({ ...w, lastAnswer: "unknown" }), 2);
  assert.equal(weightOf({ ...w, lastAnswer: "known" }), 1);
  assert.equal(weightOf({ ...w, lastAnswer: "known" }, new Set([w.id])), 2); // Still Learning에 있으면 2배
  assert.equal(weightOf({ ...w, lastAnswer: "unknown" }, new Set([w.id])), 2); // 둘 다여도 2배
});

test("startRound gives hard-list words double weight", () => {
  const base = withWords("a", "b");
  const [a, b] = base.words;
  const store = { ...base, hard: [{ wordId: b.id, savedAt: NOW.toISOString() }] };
  // 가중치 a=1, b=2 → r in [0,1) a, [1,3) b
  assert.equal(startRound(store, NOW, () => 0.5).store.progress.current?.wordIds[0], b.id);
  assert.equal(startRound(store, NOW, () => 0.1).store.progress.current?.wordIds[0], a.id);
});

test("weights shift the random pick toward 'unknown' words", () => {
  const base = withWords("a", "b").words; // order: a, b
  const words: Word[] = [base[0], { ...base[1], lastAnswer: "unknown" }];
  // total weight 3: r in [0,1) -> a, r in [1,3) -> b
  assert.equal(pickWords(words, 1, () => 0.2)[0].text, "a");
  assert.equal(pickWords(words, 1, () => 0.5)[0].text, "b");
  assert.equal(pickWords(words, 1, () => 0.9)[0].text, "b");
});

test("startRound with no words", () => {
  const { store, result } = startRound(emptyStore(), NOW);
  assert.equal(result, "no_words");
  assert.equal(store.progress.current, undefined);
});

test("startRound picks WORDS_PER_ROUND (5) words and records today's date", () => {
  const { store, result } = startRound(withWords("a", "b", "c", "d", "e", "f"), NOW, first);
  assert.equal(result, "started");
  assert.equal(store.progress.date, "2026-10-25");
  assert.equal(store.progress.current?.wordIds.length, 5);
  assert.equal(store.progress.current?.answered, 0);
  assert.equal(currentWord(store)?.text, "a"); // list order: a, b, c, d, e, f
});

test("startRound continues an unfinished round instead of starting a new one", () => {
  const started = startRound(withWords("a", "b", "c"), NOW, first).store;
  const again = startRound(started, NOW, first);
  assert.equal(again.result, "continued");
  assert.equal(again.store, started);
});

test("startRound refuses after 5 rounds today", () => {
  let store = withWords("a", "b", "c");
  store = { ...store, progress: { date: "2026-10-25", completed: 5 } };
  assert.equal(startRound(store, NOW).result, "done_for_today");
});

test("a new day resets the count so rounds can start again", () => {
  let store = withWords("a", "b", "c");
  store = { ...store, progress: { date: "2026-10-24", completed: 5 } };
  const { store: next, result } = startRound(store, NOW, first);
  assert.equal(result, "started");
  assert.equal(next.progress.completed, 0);
  assert.equal(completedToday(store, NOW), 0);
});

test("startRound drops a round whose word was deleted and starts fresh", () => {
  let store = startRound(withWords("a", "b", "c"), NOW, first).store;
  store = { ...store, words: store.words.slice(1) }; // 뽑힌 단어 하나를 지운 셈
  const { store: next, result } = startRound(store, NOW, first);
  assert.equal(result, "started");
  assert.equal(next.progress.current?.wordIds.length, 2);
});

test("answering advances the round and finishes after the last word", () => {
  let store = startRound(withWords("a", "b", "c"), NOW, first).store;
  const r1 = answerCurrent(store, "known", NOW);
  assert.equal(r1.result.ok && r1.result.roundFinished, false);
  store = r1.store;
  assert.equal(store.progress.current?.answered, 1);
  store = answerCurrent(store, "unknown", NOW).store;
  const r3 = answerCurrent(store, "known", NOW);
  assert.equal(r3.result.ok && r3.result.roundFinished, true);
  assert.equal(r3.result.ok && r3.result.countedToday, true);
  assert.equal(r3.store.progress.current, undefined);
  assert.equal(r3.store.progress.completed, 1);
  assert.equal(r3.store.logs.length, 3);
  assert.equal(answerCurrent(r3.store, "known", NOW).result.ok, false);
});

test("answers can record which kind of example was shown", () => {
  const store = startRound(withWords("a"), NOW, first).store;
  const withKind = answerCurrent(store, "known", NOW, "voa").store;
  assert.equal(withKind.logs[0].example, "voa");
  const withoutKind = answerCurrent(store, "known", NOW).store;
  assert.equal("example" in withoutKind.logs[0], false);
});

test("answers update the word's counters and first/last answer", () => {
  const store = startRound(withWords("a"), NOW, first).store;
  const { store: next, result } = answerCurrent(store, "unknown", NOW);
  assert.equal(result.ok, true);
  const w = next.words[0];
  assert.equal(w.missTotal, 1);
  assert.equal(w.knownStreak, 0);
  assert.equal(w.firstAnswer, "unknown");
  assert.equal(w.lastAnswer, "unknown");
  const later = answerCurrent(startRound(next, NOW, first).store, "known", NOW).store.words[0];
  assert.equal(later.firstAnswer, "unknown"); // 첫 응답은 그대로
  assert.equal(later.lastAnswer, "known");
  assert.equal(later.knownStreak, 1);
});

// 단어 하나로 회차를 여러 번 돌린다. 하루 5회 제한에 걸리지 않도록 횟수는 매번 0으로 되돌린다.
function answerTimes(store: Store, answer: "known" | "unknown", times: number): Store {
  for (let i = 0; i < times; i++) {
    store = { ...store, progress: { ...store.progress, completed: 0 } };
    store = startRound(store, NOW, first).store;
    store = answerCurrent(store, answer, NOW).store;
  }
  return store;
}

test("three 'unknown' answers put the word on the hard list, once", () => {
  let store = withWords("a");
  store = answerTimes(store, "unknown", 2);
  assert.equal(store.hard.length, 0);
  store = startRound(store, NOW, first).store;
  const third = answerCurrent(store, "unknown", NOW);
  assert.equal(third.result.ok && third.result.addedToHard, true);
  assert.equal(third.store.hard.length, 1);
  const fourth = answerTimes(third.store, "unknown", 1);
  assert.equal(fourth.hard.length, 1);
  assert.equal(fourth.words[0].missTotal, 4);
});

test("three 'known' in a row removes the word from the hard list and resets counters", () => {
  let store = answerTimes(withWords("a"), "unknown", 3);
  store = answerTimes(store, "known", 2);
  assert.equal(store.hard.length, 1);
  assert.equal(store.words[0].knownStreak, 2);
  store = startRound(store, NOW, first).store;
  const third = answerCurrent(store, "known", NOW);
  assert.equal(third.result.ok && third.result.removedFromHard, true);
  assert.equal(third.store.hard.length, 0);
  assert.equal(third.store.words[0].missTotal, 0);
  assert.equal(third.store.words[0].knownStreak, 0);
});

test("removeFromHard drops the entry and resets the word's counters", () => {
  const store = answerTimes(withWords("a"), "unknown", 3);
  assert.equal(store.hard.length, 1);
  const after = removeFromHard(store, store.words[0].id);
  assert.equal(after.hard.length, 0);
  assert.equal(after.words[0].missTotal, 0);
  assert.equal(after.words[0].knownStreak, 0);
  assert.equal(removeFromHard(after, store.words[0].id), after); // 목록에 없으면 그대로
});

test("an 'unknown' answer breaks the known streak", () => {
  let store = answerTimes(withWords("a"), "known", 2);
  store = answerTimes(store, "unknown", 1);
  assert.equal(store.words[0].knownStreak, 0);
});

test("a round started yesterday that finishes today counts for yesterday, not today", () => {
  const yesterdayNight = new Date("2026-10-24T14:50:00.000Z"); // KST 23:50
  const afterMidnight = new Date("2026-10-24T15:10:00.000Z"); // KST 00:10 next day
  let store = startRound(withWords("a"), yesterdayNight, first).store;
  assert.equal(store.progress.date, "2026-10-24");
  const finished = answerCurrent(store, "known", afterMidnight);
  assert.equal(finished.result.ok && finished.result.roundFinished, true);
  assert.equal(finished.result.ok && finished.result.countedToday, false);
  assert.equal(finished.store.progress.date, "2026-10-25");
  assert.equal(finished.store.progress.completed, 0);
  store = finished.store;
  // 오늘 시작해서 오늘 끝낸 회차는 센다
  store = answerCurrent(startRound(store, afterMidnight, first).store, "known", afterMidnight).store;
  assert.equal(store.progress.completed, 1);
});

test("googleSearchUrl encodes the word", () => {
  assert.equal(
    googleSearchUrl("don't"),
    "https://www.google.com/search?q=don't%20meaning%20pronunciation",
  );
});
