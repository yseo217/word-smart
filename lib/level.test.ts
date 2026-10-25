import { test } from "node:test";
import assert from "node:assert/strict";
import { levelAllows, sentenceLevel, wordLevel, type FrequencyMap } from "./level.ts";

// 작은 가짜 빈도 목록 (순위)
const FREQ: FrequencyMap = {
  the: 1,
  a: 2,
  is: 3,
  in: 4,
  cat: 400,
  dog: 500,
  walk: 1500,
  park: 1800,
  every: 900,
  day: 100,
  reluctant: 7000,
  plausible: 9000,
  ubiquitous: 15000,
  ostensibly: 30000,
  theory: 3000,
};

test("without frequency data levels are unknown and nothing is filtered", () => {
  assert.equal(wordLevel("cat", {}), null);
  assert.equal(sentenceLevel("A cat.", "cat", {}), null);
  assert.equal(levelAllows("Any sentence at all.", "cat", {}), true);
});

test("word level follows rank bounds", () => {
  assert.equal(wordLevel("cat", FREQ), 1);
  assert.equal(wordLevel("theory", FREQ), 2);
  assert.equal(wordLevel("plausible", FREQ), 3);
  assert.equal(wordLevel("ubiquitous", FREQ), 4);
  assert.equal(wordLevel("ostensibly", FREQ), 5);
  assert.equal(wordLevel("notinlist", FREQ), 5);
});

test("sentence level ignores the target word and proper nouns", () => {
  // 'ubiquitous'는 묻는 단어라 빼고, 'Seoul'은 고유명사라 뺀다 → 남은 단어는 모두 수준 1
  assert.equal(sentenceLevel("The cat is ubiquitous in Seoul.", "ubiquitous", FREQ), 1);
});

test("an unknown ordinary word makes the sentence level 5", () => {
  assert.equal(sentenceLevel("The cat is zorblax.", "cat", FREQ), 5);
});

test("the hardest 10% of words are ignored", () => {
  // 10단어: 9개는 수준 1, 1개는 수준 5 → 상위 1개(10%)를 빼면 1
  const text = "The dog is a dog the cat the park zorblax day.";
  assert.equal(sentenceLevel(text, "walk", FREQ), 1);
});

test("long sentences go up one level", () => {
  const words = Array.from({ length: 26 }, (_, i) => (i % 2 ? "cat" : "dog")).join(" ");
  assert.equal(sentenceLevel(`${words}.`, "walk", FREQ), 2);
});

test("levelAllows: sentence must not be harder than the word", () => {
  assert.equal(levelAllows("The cat is reluctant.", "reluctant", FREQ), true);
  assert.equal(levelAllows("The plausible dog walks.", "cat", FREQ), false); // 문장 3 > 단어 1
  assert.equal(levelAllows("The plausible dog walks.", "ubiquitous", FREQ), true); // 문장 3 ≤ 단어 4
});

test("inflected tokens are looked up by their base form", () => {
  assert.equal(sentenceLevel("The cats walked every day.", "dog", FREQ), 1);
});
