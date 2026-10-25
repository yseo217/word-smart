import { test } from "node:test";
import assert from "node:assert/strict";
import { exampleText, findVoaCandidates, pickDictionaryExample, pickVoaExample, withContext, type VoaCorpus } from "./examples-core.ts";

const corpus: VoaCorpus = {
  articles: [
    {
      url: "https://learningenglish.voanews.com/a/1.html",
      title: "One",
      sentences: [
        "The town held a meeting on Monday.",
        "Many people were reluctant to speak at first.",
        "By the end, almost everyone had something to say.",
      ],
    },
    {
      url: "https://learningenglish.voanews.com/a/2.html",
      title: "Two",
      sentences: ["She ran the whole way home.", "Nobody could keep up with her."],
    },
  ],
};

const first = () => 0;

test("findVoaCandidates skips sentences where the word is only a proper noun", () => {
  const c: VoaCorpus = {
    articles: [{ url: "u", title: "t", sentences: ["The team welcomed Mark Lee.", "They mark the spot with a flag."] }],
  };
  assert.deepEqual(
    findVoaCandidates(c, "mark").map((x) => x.index),
    [1],
  );
});

test("findVoaCandidates matches inflected forms across articles", () => {
  assert.equal(findVoaCandidates(corpus, "reluctant").length, 1);
  assert.equal(findVoaCandidates(corpus, "run").length, 1); // "ran"
  assert.equal(findVoaCandidates(corpus, "zebra").length, 0);
});

test("withContext attaches the longer neighbour", () => {
  const ctx = withContext(corpus.articles[0].sentences, 1);
  assert.equal(ctx.sentence, "Many people were reluctant to speak at first.");
  assert.equal(ctx.after, "By the end, almost everyone had something to say."); // 뒷 문장이 더 길다
  assert.equal(ctx.before, undefined);
});

test("withContext uses whichever side exists at the edges", () => {
  assert.equal(withContext(corpus.articles[1].sentences, 0).after, "Nobody could keep up with her.");
  assert.equal(withContext(corpus.articles[1].sentences, 1).before, "She ran the whole way home.");
  assert.deepEqual(withContext(["Only one."], 0), { sentence: "Only one." });
});

test("withContext respects the 300-character limit", () => {
  const long = "x".repeat(290) + ".";
  const short = "Short one.";
  // 긴 쪽(앞)은 300자를 넘기므로 짧은 쪽(뒤)을 붙인다
  assert.deepEqual(withContext([long, "Middle sentence here.", short], 1), { sentence: "Middle sentence here.", after: short });
  // 둘 다 넘으면 문장만
  assert.deepEqual(withContext([long, "Middle sentence here.", long], 1), { sentence: "Middle sentence here." });
});

test("pickVoaExample returns a highlighted-ready example with source", () => {
  const r = pickVoaExample(corpus, "reluctant", [], {}, first);
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.kind, "voa");
  assert.equal(r.id, "voa:0:1");
  assert.equal(r.source.url, "https://learningenglish.voanews.com/a/1.html");
  assert.match(exampleText(r), /reluctant/);
  assert.ok(new RegExp(r.pattern, "i").test("Reluctantly? no; reluctant yes"));
});

test("pickVoaExample skips ids already seen and reports none when exhausted", () => {
  assert.equal(pickVoaExample(corpus, "reluctant", ["voa:0:1"], {}, first).ok, false);
  assert.equal(pickVoaExample(corpus, "zebra", [], {}, first).ok, false);
});

test("pickVoaExample applies the level rule when frequency data exists", () => {
  // 문장에 목록에 없는 단어가 많으면 문장 수준 5 > 단어 수준 1 → 제외
  const freq = { reluctant: 100 };
  assert.equal(pickVoaExample(corpus, "reluctant", [], freq, first).ok, false);
});

const dictionary = [
  {
    word: "hinder",
    sourceUrls: ["https://en.wiktionary.org/wiki/hinder"],
    meanings: [
      {
        definitions: [
          { definition: "To make difficult.", example: "A drought hinders the growth of plants" },
          { definition: "To cause harm." },
          { definition: "To delay.", example: "She hindered a man from committing suicide." },
        ],
      },
    ],
  },
];

test("pickDictionaryExample picks an example containing the word and tidies punctuation", () => {
  const r = pickDictionaryExample(dictionary, "hinder", [], {}, first);
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.kind, "dictionary");
  assert.equal(r.sentence, "A drought hinders the growth of plants.");
  assert.equal(r.source.license, "CC BY-SA 3.0");
  assert.equal(r.source.url, "https://en.wiktionary.org/wiki/hinder");
});

test("pickDictionaryExample honours skip and handles bad input", () => {
  const r = pickDictionaryExample(dictionary, "hinder", ["dict:0:0:0"], {}, first);
  assert.equal(r.ok && r.id, "dict:0:0:2");
  assert.equal(pickDictionaryExample({ title: "No Definitions Found" }, "hinder", [], {}).ok, false);
  assert.equal(pickDictionaryExample(dictionary, "zebra", [], {}).ok, false);
});
