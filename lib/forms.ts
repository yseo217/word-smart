// 단어의 변화형 찾기와 강조 (DESIGN.md 7장). 서버(예문 고르기)와 화면(강조)이 같은 함수를 쓴다.

// 자주 쓰는 불규칙 동사와 명사. base → 다른 모양들. 범위는 필요에 따라 늘린다 (DESIGN.md 10번 #2).
const IRREGULAR: Record<string, string[]> = {
  be: ["am", "is", "are", "was", "were", "been", "being"],
  have: ["has", "had", "having"],
  do: ["does", "did", "done", "doing"],
  go: ["goes", "went", "gone", "going"],
  say: ["says", "said", "saying"],
  make: ["made"],
  take: ["took", "taken"],
  come: ["came"],
  see: ["saw", "seen"],
  know: ["knew", "known"],
  get: ["got", "gotten"],
  give: ["gave", "given"],
  find: ["found"],
  think: ["thought"],
  tell: ["told"],
  become: ["became"],
  leave: ["left"],
  feel: ["felt"],
  bring: ["brought"],
  begin: ["began", "begun"],
  keep: ["kept"],
  hold: ["held"],
  write: ["wrote", "written"],
  stand: ["stood"],
  hear: ["heard"],
  let: [],
  mean: ["meant"],
  set: [],
  meet: ["met"],
  run: ["ran"],
  pay: ["paid"],
  sit: ["sat"],
  speak: ["spoke", "spoken"],
  lie: ["lay", "lain"],
  lead: ["led"],
  read: [],
  grow: ["grew", "grown"],
  lose: ["lost"],
  fall: ["fell", "fallen"],
  send: ["sent"],
  build: ["built"],
  understand: ["understood"],
  draw: ["drew", "drawn"],
  break: ["broke", "broken"],
  spend: ["spent"],
  cut: [],
  rise: ["rose", "risen"],
  drive: ["drove", "driven"],
  buy: ["bought"],
  wear: ["wore", "worn"],
  choose: ["chose", "chosen"],
  seek: ["sought"],
  throw: ["threw", "thrown"],
  catch: ["caught"],
  deal: ["dealt"],
  win: ["won"],
  forget: ["forgot", "forgotten"],
  lay: ["laid"],
  teach: ["taught"],
  eat: ["ate", "eaten"],
  sell: ["sold"],
  fight: ["fought"],
  fly: ["flew", "flown"],
  sing: ["sang", "sung"],
  drink: ["drank", "drunk"],
  swim: ["swam", "swum"],
  ring: ["rang", "rung"],
  sleep: ["slept"],
  shake: ["shook", "shaken"],
  strike: ["struck", "stricken"],
  hide: ["hid", "hidden"],
  bite: ["bit", "bitten"],
  ride: ["rode", "ridden"],
  steal: ["stole", "stolen"],
  freeze: ["froze", "frozen"],
  forgive: ["forgave", "forgiven"],
  tear: ["tore", "torn"],
  shoot: ["shot"],
  feed: ["fed"],
  bleed: ["bled"],
  flee: ["fled"],
  light: ["lit"],
  slide: ["slid"],
  stick: ["stuck"],
  sting: ["stung"],
  swing: ["swung"],
  cling: ["clung"],
  dig: ["dug"],
  hang: ["hung"],
  spin: ["spun"],
  spit: ["spat"],
  weep: ["wept"],
  sweep: ["swept"],
  creep: ["crept"],
  kneel: ["knelt"],
  leap: ["leapt"],
  dream: ["dreamt"],
  burn: ["burnt"],
  learn: ["learnt"],
  spell: ["spelt"],
  smell: ["smelt"],
  spill: ["spilt"],
  forbid: ["forbade", "forbidden"],
  withdraw: ["withdrew", "withdrawn"],
  overcome: ["overcame"],
  undergo: ["underwent", "undergone"],
  uphold: ["upheld"],
  withstand: ["withstood"],
  arise: ["arose", "arisen"],
  awake: ["awoke", "awoken"],
  bear: ["bore", "borne"],
  bind: ["bound"],
  grind: ["ground"],
  wind: ["wound"],
  seize: [],
  child: ["children"],
  man: ["men"],
  woman: ["women"],
  person: ["people"],
  foot: ["feet"],
  tooth: ["teeth"],
  mouse: ["mice"],
  goose: ["geese"],
  life: ["lives"],
  leaf: ["leaves"],
  knife: ["knives"],
  wife: ["wives"],
  wolf: ["wolves"],
  half: ["halves"],
  shelf: ["shelves"],
  thief: ["thieves"],
  crisis: ["crises"],
  analysis: ["analyses"],
  phenomenon: ["phenomena"],
  criterion: ["criteria"],
};

const VOWELS = "aeiou";

// 규칙 변화: -s/-es, -ed/-d, -ing, 자음 겹침(run→running), e 탈락(make→making), y→ies/ied
export function wordForms(base: string): string[] {
  const w = base.toLowerCase();
  const forms = new Set<string>([w]);
  const last = w[w.length - 1];
  const prev = w[w.length - 2];
  const stem = w.slice(0, -1);

  forms.add(`${w}s`);
  // -es는 s, x, z, ch, sh, o로 끝날 때만. 아무 데나 붙이면 run→"runes"(룬 문자)처럼 다른 단어와 겹친다.
  if (/(s|x|z|ch|sh|o)$/.test(w)) forms.add(`${w}es`);
  forms.add(`${w}ed`);
  forms.add(`${w}ing`);
  if (last === "e") {
    forms.add(`${w}d`);
    forms.add(`${stem}ing`);
  }
  if (last === "y" && prev && !VOWELS.includes(prev)) {
    forms.add(`${stem}ies`);
    forms.add(`${stem}ied`);
  }
  const isCvc =
    w.length >= 3 && !VOWELS.includes(last) && !"wxy".includes(last) && prev !== undefined && VOWELS.includes(prev) && !VOWELS.includes(w[w.length - 3]);
  if (isCvc) {
    forms.add(`${w}${last}ed`);
    forms.add(`${w}${last}ing`);
  }
  for (const f of IRREGULAR[w] ?? []) forms.add(f);
  return [...forms];
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// 문장 안에서 단어와 변화형을 찾는 정규식의 소스. 긴 것부터 맞춰서 "runs"가 "run"으로 잘리지 않게 한다.
export function formsPattern(base: string): string {
  const alternatives = wordForms(base)
    .sort((a, b) => b.length - a.length)
    .map(escape)
    .join("|");
  return `(?<![A-Za-z'-])(?:${alternatives})(?![A-Za-z-])`;
}

export function formsRegExp(base: string): RegExp {
  return new RegExp(formsPattern(base), "gi");
}

export function containsForm(text: string, base: string): boolean {
  return new RegExp(formsPattern(base), "i").test(text);
}

// 예문 후보 판정: 단어가 들어 있되, 문장 중간에서 대문자로 시작하는 형태(사람 이름 Mark 등)만 있는 문장은 고유명사로 보고 뺀다.
// 문장 첫머리(앞이 따옴표나 공백뿐)의 대문자는 평범한 문장 시작이므로 인정한다.
export function containsFormAsCommonWord(text: string, base: string): boolean {
  for (const m of text.matchAll(formsRegExp(base))) {
    const start = m.index ?? 0;
    const capitalized = /^[A-Z]/.test(m[0]);
    const atSentenceStart = /^["“‘'(\s]*$/.test(text.slice(0, start));
    if (!capitalized || atSentenceStart) return true;
  }
  return false;
}
