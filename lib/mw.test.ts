import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanMwText, mwExamples, mwShortDefinition, pickMwExample } from "./mw.ts";

const first = () => 0;
const NO_FREQ = {}; // 빈도 목록이 비어 있으면 수준 규칙은 꺼진다

// MW 응답 모양을 흉내 낸 작은 항목. 실제 응답은 def → sseq → sense → dt 안에 ["vis", [{t: "…"}]]가 들어 있다.
function entry(id: string, texts: string[]) {
  return { meta: { id }, fl: "verb", def: [{ sseq: [[["sense", { dt: [["text", "{bc}to make slow"], ["vis", texts.map((t) => ({ t }))] ] }]]] }] };
}

test("cleanMwText turns MW markup into plain text", () => {
  assert.equal(cleanMwText("Their journey was {it}hindered{/it} [={it}impeded, slowed{/it}] by snow."), "Their journey was hindered by snow.");
  assert.equal(cleanMwText("a {wi}ubiquitous{/wi} fashion"), "a ubiquitous fashion");
  assert.equal(cleanMwText("{ldquo}Stop,{rdquo} she said {bc} loudly"), "“Stop,” she said: loudly");
  assert.equal(cleanMwText("see {sx|hamper||} and {d_link|impede|impede}"), "see hamper and impede");
  assert.equal(cleanMwText("the {it}cat{/it}{dx}compare {dxt|kitten||}{/dx} slept"), "the cat slept");
});

test("mwExamples prefers entries whose headword is the word, and ids are stable", () => {
  const entries = [entry("cat burglar", ["The {it}cat burglar{/it} fled."]), entry("cat:1", ["I have a {it}cat{/it}.", "{it}cat{/it} food"])];
  const got = mwExamples(entries, "learners", "cat");
  assert.deepEqual(
    got.map((x) => [x.id, x.text]),
    [
      ["mwl:1:0", "I have a cat."],
      ["mwl:1:1", "cat food"],
    ],
  );
  // 표제어 항목이 없으면 복합어 항목도 본다
  assert.equal(mwExamples([entry("cat burglar", ["a {it}cat burglar{/it}"])], "collegiate", "cat")[0].id, "mwc:0:0");
  // 모르는 단어면 MW는 철자 제안(문자열 배열)을 준다 → 예문 없음
  assert.deepEqual(mwExamples(["cot", "cut"], "learners", "cxt"), []);
  assert.deepEqual(mwExamples(null, "learners", "cat"), []);
});

test("pickMwExample prefers full sentences, skips seen ids and quote fragments, and labels the source", () => {
  const entries = [entry("hinder", ["{it}hinder{/it} progress", "Snow {it}hindered{/it} the trip.", "… a {it}hindered{/it} … march"])];
  const r = pickMwExample(entries, "learners", "hinder", [], NO_FREQ, first);
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.sentence, "Snow hindered the trip."); // 구(句)보다 완전한 문장, 인용 조각(…)은 제외
    assert.equal(r.id, "mwl:0:1");
    assert.equal(r.kind, "dictionary");
    assert.equal(r.source.name, "Merriam-Webster Learner's Dictionary");
    assert.equal(r.source.url, "https://www.britannica.com/dictionary/hinder");
    assert.equal(r.source.license, "© Merriam-Webster");
  }
  // 문장을 다 봤으면 구(句)라도 준다: 첫 글자 대문자, 끝에 마침표
  const r2 = pickMwExample(entries, "learners", "hinder", ["mwl:0:1"], NO_FREQ, first);
  assert.equal(r2.ok && r2.sentence, "Hinder progress.");
  // 전부 봤으면 없음
  assert.equal(pickMwExample(entries, "learners", "hinder", ["mwl:0:0", "mwl:0:1"], NO_FREQ, first).ok, false);
  // 단어가 안 든 예문(동의어 설명 예문)은 쓰지 않는다
  assert.equal(pickMwExample([entry("perspicacious", ["a {it}shrewd{/it} judge of character"])], "collegiate", "perspicacious", [], NO_FREQ, first).ok, false);
  // Collegiate 출처는 merriam-webster.com 단어 페이지
  const r3 = pickMwExample([entry("vex", ["It {it}vexed{/it} her."])], "collegiate", "vex", [], NO_FREQ, first);
  assert.equal(r3.ok && r3.source.url, "https://www.merriam-webster.com/dictionary/vex");
});

test("mwShortDefinition takes the headword entry's first short definition and drops usage notes", () => {
  const entries = [
    { meta: { id: "cat burglar" }, shortdef: ["a thief who climbs in through a window"] },
    { meta: { id: "cat:1" }, shortdef: ["a small animal that is often kept as a pet —often used before another noun", "a lion or tiger"] },
  ];
  assert.equal(mwShortDefinition(entries, "cat"), "a small animal that is often kept as a pet");
  // 표제어 항목이 없으면 다른 항목의 뜻이라도 쓴다
  assert.equal(mwShortDefinition([{ meta: { id: "cat burglar" }, shortdef: ["a thief"] }], "cat"), "a thief");
  // 철자 제안(문자열 배열)이나 뜻이 빈 항목은 null
  assert.equal(mwShortDefinition(["cot", "cut"], "cxt"), null);
  assert.equal(mwShortDefinition([{ meta: { id: "x" }, shortdef: [] }], "x"), null);
  assert.equal(mwShortDefinition(null, "x"), null);
});
