import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeWord, validateWord } from "./words.ts";

function ok(input: string, existing: string[] = []) {
  const r = validateWord(input, existing);
  assert.equal(r.ok, true, `"${input}" should be accepted`);
  return r.ok ? r.text : "";
}

function fail(input: string, reason: string, existing: string[] = []) {
  const r = validateWord(input, existing);
  assert.equal(r.ok, false, `"${input}" should be rejected`);
  if (!r.ok) assert.equal(r.reason, reason, `"${input}" reason`);
}

test("accepts plain words and lowercases them", () => {
  assert.equal(ok("Apple"), "apple");
  assert.equal(ok("UBIQUITOUS"), "ubiquitous");
  assert.equal(ok("a"), "a");
});

test("trims surrounding whitespace", () => {
  assert.equal(ok("  apple \n"), "apple");
});

test("allows hyphen and apostrophe", () => {
  assert.equal(ok("ice-cream"), "ice-cream");
  assert.equal(ok("don't"), "don't");
});

test("turns a curly apostrophe from a phone keyboard into a straight one", () => {
  assert.equal(normalizeWord("Don’t"), "don't");
  assert.equal(ok("don’t"), "don't");
});

test("rejects empty input", () => {
  fail("", "empty");
  fail("   ", "empty");
});

test("rejects digits, inner spaces and other characters", () => {
  fail("abc1", "invalid");
  fail("two words", "invalid");
  fail("café", "invalid");
  fail("한글", "invalid");
  fail("a_b", "invalid");
  fail("hello!", "invalid");
});

test("rejects input with no letters", () => {
  fail("-", "invalid");
  fail("'", "invalid");
  fail("--", "invalid");
});

test("length limit is 30", () => {
  ok("a".repeat(30));
  fail("a".repeat(31), "too_long");
});

test("rejects duplicates ignoring case and surrounding spaces", () => {
  fail("apple", "duplicate", ["apple"]);
  fail("Apple", "duplicate", ["apple"]);
  fail("  APPLE ", "duplicate", ["apple"]);
});

test("duplicate check also works if saved data was not lowercase", () => {
  fail("apple", "duplicate", ["Apple"]);
});

test("a different word is not a duplicate", () => {
  assert.equal(ok("apples", ["apple"]), "apples");
});

test("character check runs before the duplicate check", () => {
  fail("apple1", "invalid", ["apple1"]);
});
