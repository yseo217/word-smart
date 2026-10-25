// 저장 데이터의 모양과 순수 함수들 (DESIGN.md 4장). 브라우저 API는 쓰지 않는다.
import { splitInput, validateWord, type WordCheckFailure } from "./words.ts";

export const STORAGE_KEY = "wordsmart:v1";

export type Answer = "known" | "unknown";

export type Word = {
  id: string;
  text: string; // 소문자로 정리한 단어
  addedAt: string; // ISO 시각
  lastAnswer?: Answer;
  firstAnswer?: Answer;
  missTotal: number; // "모른다" 누적 횟수
  knownStreak: number; // 연속 "안다" 횟수
};

// 그때 예문이 있었는지: VOA 문장, 사전 예문, 없음. 예문 제공률 통계에 쓴다 (PRD 3번·5번 ②).
export type ExampleKind = "voa" | "dictionary" | "none";

export type Log = { wordId: string; at: string; answer: Answer; example?: ExampleKind };

export type HardItem = { wordId: string; savedAt: string };

export type Progress = {
  date: string; // 한국 시간 기준 YYYY-MM-DD
  completed: number; // 오늘 끝낸 회차 수 (최대 5)
  current?: {
    startedAt: string;
    wordIds: string[];
    answered: number;
  };
};

export type Store = {
  version: 1;
  words: Word[];
  logs: Log[];
  hard: HardItem[];
  progress: Progress;
  firstUsedAt?: string; // 앱을 처음 쓴 날(첫 저장 시각). 기억률의 "4주 뒤" 기준 (PRD 5번 ②)
};

export function emptyStore(): Store {
  return { version: 1, words: [], logs: [], hard: [], progress: { date: "", completed: 0 } };
}

// 처음 저장할 때 첫 사용 시각을 남긴다. 이미 있으면 그대로.
export function withFirstUse(store: Store, now: Date = new Date()): Store {
  return store.firstUsedAt ? store : { ...store, firstUsedAt: now.toISOString() };
}

// 보안 연결(https)이 아닌 곳(예: 같은 와이파이의 http 주소)에서는 crypto.randomUUID가 없을 수 있다.
export function newId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function toWord(v: unknown): Word | null {
  if (!isRecord(v) || typeof v.id !== "string" || typeof v.text !== "string") return null;
  const word: Word = {
    id: v.id,
    text: v.text,
    addedAt: typeof v.addedAt === "string" ? v.addedAt : new Date(0).toISOString(),
    missTotal: typeof v.missTotal === "number" ? v.missTotal : 0,
    knownStreak: typeof v.knownStreak === "number" ? v.knownStreak : 0,
  };
  if (v.lastAnswer === "known" || v.lastAnswer === "unknown") word.lastAnswer = v.lastAnswer;
  if (v.firstAnswer === "known" || v.firstAnswer === "unknown") word.firstAnswer = v.firstAnswer;
  return word;
}

// 저장된 글자를 읽는다. 비어 있으면 빈 단어장, 읽을 수 없으면 빈 단어장 + corrupt 표시.
export function parseStore(raw: string): { store: Store; corrupt: boolean } {
  if (!raw) return { store: emptyStore(), corrupt: false };
  try {
    const data: unknown = JSON.parse(raw);
    if (!isRecord(data) || data.version !== 1 || !Array.isArray(data.words)) {
      return { store: emptyStore(), corrupt: true };
    }
    const base = emptyStore();
    const progress = isRecord(data.progress) ? (data.progress as Progress) : base.progress;
    const store: Store = {
      version: 1,
      words: data.words.map(toWord).filter((w): w is Word => w !== null),
      logs: Array.isArray(data.logs) ? (data.logs as Log[]) : [],
      hard: Array.isArray(data.hard) ? (data.hard as HardItem[]) : [],
      progress,
    };
    if (typeof data.firstUsedAt === "string") store.firstUsedAt = data.firstUsedAt;
    return { store, corrupt: false };
  } catch {
    return { store: emptyStore(), corrupt: true };
  }
}

export type AddResult = { ok: true; word: Word } | WordCheckFailure;

// 검사를 통과하면 목록 맨 위에 추가한다. 실패하면 store를 그대로(같은 객체로) 돌려준다.
export function addWord(
  store: Store,
  input: string,
  now: Date = new Date(),
): { store: Store; result: AddResult } {
  const check = validateWord(
    input,
    store.words.map((w) => w.text),
  );
  if (!check.ok) return { store, result: check };

  const word: Word = {
    id: newId(),
    text: check.text,
    addedAt: now.toISOString(),
    missTotal: 0,
    knownStreak: 0,
  };
  return { store: { ...store, words: [word, ...store.words] }, result: { ok: true, word } };
}

export type SkippedItem = { input: string; reason: WordCheckFailure["reason"]; message: string };
export type AddManyResult = { added: Word[]; skipped: SkippedItem[] };

// 줄바꿈, 쉼표, 세미콜론으로 나눈 단어를 차례로 검사해서 통과한 것만 추가한다.
// 같은 입력 안에서 겹치는 단어도 걸러낸다. 입력한 순서대로 목록 맨 위에 들어간다.
// 하나도 추가하지 못하면 store를 그대로(같은 객체로) 돌려준다.
export function addWords(
  store: Store,
  input: string,
  now: Date = new Date(),
): { store: Store; result: AddManyResult } {
  const pieces = splitInput(input);
  if (pieces.length === 0) {
    const failure = validateWord("", []);
    return {
      store,
      result: {
        added: [],
        skipped: [{ input: "", reason: "empty", message: failure.ok ? "" : failure.message }],
      },
    };
  }

  const known = store.words.map((w) => w.text);
  const added: Word[] = [];
  const skipped: SkippedItem[] = [];
  for (const piece of pieces) {
    const check = validateWord(piece, known);
    if (!check.ok) {
      skipped.push({ input: piece, reason: check.reason, message: check.message });
      continue;
    }
    known.push(check.text);
    added.push({
      id: newId(),
      text: check.text,
      addedAt: now.toISOString(),
      missTotal: 0,
      knownStreak: 0,
    });
  }

  if (added.length === 0) return { store, result: { added, skipped } };
  return { store: { ...store, words: [...added, ...store.words] }, result: { added, skipped } };
}

// 단어를 지우면 그 단어의 응답 기록과 어려운 단어 목록 항목도 같이 지운다.
// 진행 중이던 복습 회차에 들어 있던 단어라면 그 회차는 접는다(같은 회차에서 이미 답한 다른 단어의 기록은 남는다).
export function removeWord(store: Store, id: string): Store {
  const inCurrent = store.progress.current?.wordIds.includes(id) ?? false;
  return {
    ...store,
    words: store.words.filter((w) => w.id !== id),
    logs: store.logs.filter((l) => l.wordId !== id),
    hard: store.hard.filter((h) => h.wordId !== id),
    progress: inCurrent ? { ...store.progress, current: undefined } : store.progress,
  };
}
