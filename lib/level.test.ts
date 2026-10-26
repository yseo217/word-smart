import { test } from "node:test";
import assert from "node:assert/strict";
import { levelAllows, sentenceLevel, wordLevel, type FrequencyMap } from "./level.ts";

// 작은 가짜 빈도 목록 (순위). 경계는 4000 / 8000 / 13000 / 20000.
const FREQ: FrequencyMap = {
  the: 1,
  a: 2,
  is: 3,
  in: 4,
  do: 5,
  it: 6,
  we: 7,
  not: 8,
  cat: 400,
  dog: 500,
  walk: 1500,
  park: 1800,
  every: 900,
  day: 100,
  teacher: 1000,
  theory: 3000,
  challenge: 5000,
  reluctant: 7000,
  plausible: 9000,
  ubiquitous: 15000,
  ostensibly: 30000,
};

test("without frequency data levels are unknown and nothing is filtered", () => {
  assert.equal(wordLevel("cat", {}), null);
  assert.equal(sentenceLevel("A cat.", "cat", {}), null);
  assert.equal(levelAllows("Any sentence at all.", "cat", {}), true);
});

test("word level follows rank bounds", () => {
  assert.equal(wordLevel("cat", FREQ), 1);
  assert.equal(wordLevel("theory", FREQ), 1); // 3000위 ≤ 4000
  assert.equal(wordLevel("challenge", FREQ), 2);
  assert.equal(wordLevel("reluctant", FREQ), 2);
  assert.equal(wordLevel("plausible", FREQ), 3);
  assert.equal(wordLevel("ubiquitous", FREQ), 4);
  assert.equal(wordLevel("ostensibly", FREQ), 5);
  assert.equal(wordLevel("notinlist", FREQ), 5);
});

test("sentence level ignores the target word and proper nouns", () => {
  // 'ubiquitous'는 묻는 단어라 빼고, 'Seoul'은 고유명사라 뺀다 → 남은 단어는 모두 수준 1
  assert.equal(sentenceLevel("The cat is ubiquitous in Seoul.", "ubiquitous", FREQ), 1);
});

test("a capitalized first word is a proper noun only when it is not in the list", () => {
  // Philo는 목록에 없음 → 이름으로 보고 뺀다. 보통 단어(5)로 셌다면 [5,3,1,1,1]에서 1개를 빼 3이 됐을 것
  assert.equal(sentenceLevel("Philo is a plausible dog.", "cat", FREQ), 1);
  // ostensibly는 목록에 있음 → 보통 단어로 센다. [5,3,1,1]에서 1개를 빼면 3
  assert.equal(sentenceLevel("Ostensibly plausible dogs walk.", "cat", FREQ), 3);
});

test("unknown ordinary words make the sentence level 5", () => {
  // 한 개는 '어려운 쪽 10%'로 빠지고, 두 개부터 수준에 반영된다
  assert.equal(sentenceLevel("The zorblax is a dog.", "cat", FREQ), 1);
  assert.equal(sentenceLevel("The zorblax quux is a dog.", "cat", FREQ), 5);
});

test("the hardest 10% of words are ignored, at least one word", () => {
  // 10단어: 9개는 수준 1, 1개는 수준 5 → 상위 1개(10%)를 빼면 1
  const text = "The dog is a dog the cat the park zorblax day.";
  assert.equal(sentenceLevel(text, "walk", FREQ), 1);
  // 4단어 중 1개가 수준 3 → 10%는 0.4개지만 올림이라 1개를 뺀다
  assert.equal(sentenceLevel("The plausible dog walks.", "cat", FREQ), 1);
  // 15단어 중 2개가 수준 5 → 올림 2개를 빼면 1, 3개면 5
  const two = "The dog is a dog the cat the park day zorblax quux the dog day.";
  assert.equal(sentenceLevel(two, "walk", FREQ), 1);
  const three = "The dog is a dog the cat the park day zorblax quux blarg dog day.";
  assert.equal(sentenceLevel(three, "walk", FREQ), 5);
});

test("sentences over 40 words go up one level", () => {
  const forty = Array.from({ length: 40 }, (_, i) => (i % 2 ? "cat" : "dog")).join(" ");
  assert.equal(sentenceLevel(`${forty}.`, "walk", FREQ), 1);
  assert.equal(sentenceLevel(`${forty} dog.`, "walk", FREQ), 2);
});

test("levelAllows: sentence must not be harder than the word", () => {
  assert.equal(levelAllows("The cat is reluctant.", "reluctant", FREQ), true);
  assert.equal(levelAllows("The plausible dog walks ostensibly.", "cat", FREQ), false); // 5를 빼면 3 > 단어 1
  assert.equal(levelAllows("The plausible dog walks ostensibly.", "ubiquitous", FREQ), true); // 3 ≤ 단어 4
});

test("inflected tokens are looked up by their base form", () => {
  assert.equal(sentenceLevel("The cats walked every day.", "dog", FREQ), 1);
});

test("curly apostrophes and contractions are not unknown words", () => {
  // 바꾸기 전에는 don’t → don + t 로 쪼개져 t가 '목록에 없음(5)'이 됐다
  assert.equal(sentenceLevel("The teacher’s dog doesn’t walk; we’re in the park.", "cat", FREQ), 1);
  assert.equal(sentenceLevel("It's the dog's day, isn't it?", "cat", FREQ), 1);
});
