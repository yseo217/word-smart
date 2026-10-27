import { test } from "node:test";
import assert from "node:assert/strict";
import { containsForm, containsFormAsCommonWord, formsRegExp, wordForms } from "./forms.ts";

const has = (base: string, ...forms: string[]) => {
  const all = wordForms(base);
  for (const f of forms) assert.ok(all.includes(f), `${base} should include ${f}`);
};

test("curly apostrophes in VOA text match a word typed with a straight one", () => {
  // VOA 본문은 ’를 쓴다. o'clock으로 등록한 단어가 "o’clock"이 든 문장에서 후보로 잡히고 강조된다.
  assert.equal(containsForm("We met at eight o’clock sharp.", "o'clock"), true);
  assert.equal(containsFormAsCommonWord("We met at eight o’clock sharp.", "o'clock"), true);
  assert.equal(containsForm("We met at eight o'clock sharp.", "o'clock"), true);
  assert.deepEqual([..."It’s eight o’clock now.".matchAll(formsRegExp("o'clock"))].map((m) => m[0]), ["o’clock"]);
  // 소유격은 곧은 것과 같은 규칙으로 잡힌다: "cat’s"에서 cat
  assert.equal(containsForm("The cat’s tail.", "cat"), true);
  // 둥근 아포스트로피 바로 뒤에 붙은 글자는 단어 시작이 아니다: "o’clock" 안의 "clock"은 단어 clock이 아니다
  assert.equal(containsForm("It is eight o’clock.", "clock"), false);
});

test("regular inflections", () => {
  has("walk", "walk", "walks", "walked", "walking");
  has("watch", "watches", "watched", "watching");
  has("box", "boxes");
  has("go", "goes");
});

test("-es is not added blindly (run must not match 'runes')", () => {
  assert.ok(!wordForms("run").includes("runes"));
  assert.ok(!containsForm("Ancient runes were carved here.", "run"));
});

test("e-drop and -d", () => {
  has("make", "makes", "making");
  has("hinder", "hindered", "hindering");
  has("reconcile", "reconciled", "reconciling");
});

test("y to ies/ied, but not after a vowel", () => {
  has("rectify", "rectifies", "rectified", "rectifying");
  assert.ok(!wordForms("play").includes("plaies"));
});

test("consonant doubling for CVC words", () => {
  has("run", "running");
  has("fidget", "fidgeted", "fidgeting"); // 규칙형도 함께 들어 있다
  assert.ok(!wordForms("show").includes("showwing"));
});

test("irregular verbs and nouns", () => {
  has("run", "ran");
  has("go", "went", "gone");
  has("child", "children");
  has("thwart", "thwarted"); // 불규칙 표에 없어도 규칙형은 나온다
});

test("matching is case-insensitive and respects word boundaries", () => {
  assert.ok(containsForm("She Ran to the station.", "run"));
  assert.ok(containsForm("The runs were long.", "run"));
  assert.ok(!containsForm("The trunk was heavy.", "run"));
  assert.ok(!containsForm("A runner passed by.", "run"));
  assert.ok(containsForm("Don't fidget!", "fidget"));
});

test("regexp prefers the longest form so highlighting covers the whole word", () => {
  const m = "They were running late.".match(formsRegExp("run"));
  assert.deepEqual(m, ["running"]);
});

test("a capitalised match mid-sentence is treated as a proper noun", () => {
  assert.equal(containsFormAsCommonWord("She asked Mark to wait.", "mark"), false);
  assert.equal(containsFormAsCommonWord("Mark the date on the calendar.", "mark"), true); // 문장 첫머리
  assert.equal(containsFormAsCommonWord("“Mark it,” she said.", "mark"), true); // 따옴표 뒤 첫머리
  assert.equal(containsFormAsCommonWord("She asked Mark to mark the box.", "mark"), true); // 소문자 형태도 있음
  assert.equal(containsFormAsCommonWord("Apple released a new phone.", "apple"), true); // 첫머리는 인정 (한계)
});

test("apostrophes and hyphens in the base word are handled", () => {
  assert.ok(containsForm("It was a well-meaning gesture.", "well-meaning"));
  assert.ok(containsForm("His sang-froid impressed them.", "sang-froid"));
});
