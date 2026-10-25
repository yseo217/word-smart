import { test } from "node:test";
import assert from "node:assert/strict";
import { addWord, addWords, emptyStore, newId, parseStore, removeWord, type Store } from "./store.ts";

const NOW = new Date("2026-10-25T00:00:00.000Z");

function withWords(...inputs: string[]): Store {
  let store = emptyStore();
  for (const input of inputs) store = addWord(store, input, NOW).store;
  return store;
}

test("addWord puts the new word at the top", () => {
  const store = withWords("apple", "banana");
  assert.deepEqual(
    store.words.map((w) => w.text),
    ["banana", "apple"],
  );
});

test("addWord stores a fresh word with zero counters", () => {
  const { store, result } = addWord(emptyStore(), "Apple", NOW);
  assert.equal(result.ok, true);
  assert.equal(store.words.length, 1);
  const w = store.words[0];
  assert.equal(w.text, "apple");
  assert.equal(w.addedAt, NOW.toISOString());
  assert.equal(w.missTotal, 0);
  assert.equal(w.knownStreak, 0);
  assert.equal(w.lastAnswer, undefined);
});

test("addWord filters duplicates and returns the same store object", () => {
  const before = withWords("apple");
  const { store, result } = addWord(before, "APPLE");
  assert.equal(store, before);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, "duplicate");
  assert.equal(store.words.length, 1);
});

test("addWord rejects invalid input without changing the store", () => {
  const before = withWords("apple");
  const { store, result } = addWord(before, "two words");
  assert.equal(store, before);
  assert.equal(result.ok, false);
});

test("addWords adds several words, first typed ends up on top", () => {
  const { store, result } = addWords(emptyStore(), "apple\nBanana, cherry;date\r\n", NOW);
  assert.deepEqual(
    store.words.map((w) => w.text),
    ["apple", "banana", "cherry", "date"],
  );
  assert.equal(result.added.length, 4);
  assert.equal(result.skipped.length, 0);
});

test("addWords puts the batch above older words", () => {
  const before = withWords("old");
  const { store } = addWords(before, "one, two", NOW);
  assert.deepEqual(
    store.words.map((w) => w.text),
    ["one", "two", "old"],
  );
});

test("addWords filters duplicates of saved words and within the same input", () => {
  const before = withWords("apple");
  const { store, result } = addWords(before, "Apple, banana, BANANA, cherry", NOW);
  assert.deepEqual(
    store.words.map((w) => w.text),
    ["banana", "cherry", "apple"],
  );
  assert.deepEqual(
    result.skipped.map((s) => [s.input, s.reason]),
    [
      ["Apple", "duplicate"],
      ["BANANA", "duplicate"],
    ],
  );
});

test("addWords keeps the good words and reports the bad ones", () => {
  const { store, result } = addWords(emptyStore(), "good\nab12\ntwo words\nfine", NOW);
  assert.deepEqual(
    store.words.map((w) => w.text),
    ["good", "fine"],
  );
  assert.deepEqual(
    result.skipped.map((s) => [s.input, s.reason]),
    [
      ["ab12", "invalid"],
      ["two words", "invalid"],
    ],
  );
});

test("addWords ignores blank pieces and returns the same store when nothing is added", () => {
  const before = withWords("apple");
  const dup = addWords(before, ", ;\n apple ,\n");
  assert.equal(dup.store, before);
  assert.equal(dup.result.added.length, 0);
  assert.equal(dup.result.skipped.length, 1);

  const blank = addWords(before, " ,\n ; ");
  assert.equal(blank.store, before);
  assert.equal(blank.result.skipped[0].reason, "empty");
});

test("removeWord also removes that word's logs and hard-list entry", () => {
  let store = withWords("apple", "banana");
  const [banana, apple] = store.words;
  store = {
    ...store,
    logs: [
      { wordId: apple.id, at: NOW.toISOString(), answer: "unknown" },
      { wordId: banana.id, at: NOW.toISOString(), answer: "known" },
    ],
    hard: [{ wordId: apple.id, savedAt: NOW.toISOString() }],
  };
  const after = removeWord(store, apple.id);
  assert.deepEqual(
    after.words.map((w) => w.text),
    ["banana"],
  );
  assert.equal(after.logs.length, 1);
  assert.equal(after.logs[0].wordId, banana.id);
  assert.equal(after.hard.length, 0);
});

test("removeWord drops the in-progress round if it contained the word", () => {
  let store = withWords("apple", "banana");
  const [banana, apple] = store.words;
  store = {
    ...store,
    progress: {
      date: "2026-10-25",
      completed: 1,
      current: { startedAt: NOW.toISOString(), wordIds: [apple.id, banana.id], answered: 1 },
    },
  };
  assert.equal(removeWord(store, apple.id).progress.current, undefined);
  assert.equal(removeWord(store, apple.id).progress.completed, 1);
});

test("removeWord keeps the in-progress round if it did not contain the word", () => {
  let store = withWords("apple", "banana", "cherry");
  const [cherry, banana, apple] = store.words;
  store = {
    ...store,
    progress: {
      date: "2026-10-25",
      completed: 0,
      current: { startedAt: NOW.toISOString(), wordIds: [apple.id, banana.id], answered: 0 },
    },
  };
  assert.notEqual(removeWord(store, cherry.id).progress.current, undefined);
});

test("parseStore: empty text means an empty store, not corrupt", () => {
  const { store, corrupt } = parseStore("");
  assert.equal(corrupt, false);
  assert.equal(store.words.length, 0);
});

test("parseStore round-trips what addWord saved", () => {
  const saved = JSON.stringify(withWords("apple", "banana"));
  const { store, corrupt } = parseStore(saved);
  assert.equal(corrupt, false);
  assert.deepEqual(
    store.words.map((w) => w.text),
    ["banana", "apple"],
  );
});

test("parseStore flags unreadable or unsupported data", () => {
  assert.equal(parseStore("{not json").corrupt, true);
  assert.equal(parseStore("[]").corrupt, true);
  assert.equal(parseStore(JSON.stringify({ version: 2, words: [] })).corrupt, true);
  assert.equal(parseStore(JSON.stringify({ version: 1 })).corrupt, true);
  assert.equal(parseStore("{not json").store.words.length, 0);
});

test("parseStore skips broken word entries and fills missing numbers", () => {
  const raw = JSON.stringify({
    version: 1,
    words: [{ id: "1", text: "apple" }, { text: "no id" }, null, "x"],
  });
  const { store, corrupt } = parseStore(raw);
  assert.equal(corrupt, false);
  assert.equal(store.words.length, 1);
  assert.equal(store.words[0].missTotal, 0);
  assert.equal(store.words[0].knownStreak, 0);
  assert.deepEqual(store.logs, []);
  assert.equal(store.progress.completed, 0);
});

test("newId gives different ids", () => {
  const ids = new Set(Array.from({ length: 200 }, () => newId()));
  assert.equal(ids.size, 200);
});
