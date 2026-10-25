import { test } from "node:test";
import assert from "node:assert/strict";
import { containsForm, formsRegExp, wordForms } from "./forms.ts";

const has = (base: string, ...forms: string[]) => {
  const all = wordForms(base);
  for (const f of forms) assert.ok(all.includes(f), `${base} should include ${f}`);
};

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

test("apostrophes and hyphens in the base word are handled", () => {
  assert.ok(containsForm("It was a well-meaning gesture.", "well-meaning"));
  assert.ok(containsForm("His sang-froid impressed them.", "sang-froid"));
});
