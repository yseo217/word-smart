import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { buildFrequencyMap, isListWord } from "./word-freq.ts";
import { hasFrequencyData, levelAllows, wordLevel, type FrequencyMap } from "./level.ts";

// 실제 data/word-freq.json (scripts/build-word-freq.mjs가 만든 것)
const REAL: FrequencyMap = JSON.parse(fs.readFileSync(new URL("../data/word-freq.json", import.meta.url), "utf8"));

test("isListWord keeps lowercase letter words and only a/i among single letters", () => {
  assert.equal(isListWord("cat"), true);
  assert.equal(isListWord("a"), true);
  assert.equal(isListWord("i"), true);
  assert.equal(isListWord("l"), false);
  assert.equal(isListWord("'s"), false);
  assert.equal(isListWord("mr."), false);
  assert.equal(isListWord("i-i"), false);
  assert.equal(isListWord("Cat"), false);
  assert.equal(isListWord(""), false);
});

test("buildFrequencyMap drops non-words and re-ranks from 1", () => {
  const text = ["you 100", "'s 90", "the 80", "mr. 70", "i 60", "l 50", "cat 40", "", "dog 30"].join("\n");
  assert.deepEqual(buildFrequencyMap(text), { you: 1, the: 2, i: 3, cat: 4, dog: 5 });
});

test("buildFrequencyMap stops at the limit and skips duplicates and bad lines", () => {
  const text = "the 5\r\nthe 4\r\nnonumber\r\ncat 3\r\ndog 2\r\nbird 1\r\n";
  assert.deepEqual(buildFrequencyMap(text, 3), { the: 1, cat: 2, dog: 3 });
});

test("real data: 20,000 letter-only words ranked 1..20000 without gaps", () => {
  const entries = Object.entries(REAL);
  assert.equal(entries.length, 20000);
  assert.ok(hasFrequencyData(REAL));
  const ranks = new Set<number>();
  for (const [word, rank] of entries) {
    assert.ok(isListWord(word), `not a list word: ${word}`);
    ranks.add(rank);
  }
  assert.equal(ranks.size, 20000);
  assert.equal(Math.min(...ranks), 1);
  assert.equal(Math.max(...ranks), 20000);
});

test("real data: common words are level 1 and rare words level 5", () => {
  assert.equal(wordLevel("the", REAL), 1);
  assert.equal(wordLevel("house", REAL), 1);
  assert.equal(wordLevel("serendipity", REAL), 5); // 2만 위 밖
  assert.equal(wordLevel("zzzznotaword", REAL), 5);
});

test("real data: the level rule is on and filters hard sentences", () => {
  assert.equal(levelAllows("The cat is in the house.", "cat", REAL), true);
  // 참고: "The cat sat on the mat."은 sat(2,095위)·mat(8,350위) 때문에 수준 1 단어 cat에는 막힌다 → PLAN 22(규칙 조정)에서 볼 것
  assert.equal(levelAllows("The ubiquitous serendipity of eradicating cats.", "cat", REAL), false);
});
