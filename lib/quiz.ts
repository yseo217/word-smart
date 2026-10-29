// 복습 회차: 단어 뽑기, 응답 처리, 어려운 단어 규칙 (DESIGN.md 5장). 브라우저 API는 쓰지 않는다.
import { kstDate } from "./kst.ts";
import type { Answer, ExampleKind, HardItem, Log, Progress, Store, Word } from "./store.ts";

export const ROUNDS_PER_DAY = 5;
export const WORDS_PER_ROUND = 5; // 2026-10-30: 3 → 5 (사용자 결정, PRD 3번·5번 ② 확정)
export const MISS_LIMIT = 3; // "모른다" 누적 3번이면 어려운 단어 목록에 넣는다
export const KNOWN_STREAK_TO_CLEAR = 3; // 목록에 있는 단어를 연속 3번 "안다"면 뺀다

// 날짜가 바뀌었으면 오늘 횟수를 0으로 되돌린다. 진행 중인 회차는 그대로 둔다.
export function normalizeProgress(progress: Progress, now: Date): Progress {
  const today = kstDate(now);
  if (progress.date === today) return progress;
  return { ...progress, date: today, completed: 0 };
}

function withProgress(store: Store, progress: Progress): Store {
  return progress === store.progress ? store : { ...store, progress };
}

// 가장 최근 응답이 "모른다"이거나 어려운 단어 목록(Still Learning)에 있으면 2배, 아니면 1배 (둘 다여도 2배).
export function weightOf(word: Word, hardIds: ReadonlySet<string> = new Set()): number {
  return word.lastAnswer === "unknown" || hardIds.has(word.id) ? 2 : 1;
}

// 가중치에 따라 무작위로 n개를 뽑는다. 뽑힌 단어는 빼고 다시 뽑으므로 같은 단어가 두 번 나오지 않는다.
export function pickWords(
  words: readonly Word[],
  n: number,
  rng: () => number = Math.random,
  hardIds: ReadonlySet<string> = new Set(),
): Word[] {
  const pool = [...words];
  const picked: Word[] = [];
  while (picked.length < n && pool.length > 0) {
    const total = pool.reduce((sum, w) => sum + weightOf(w, hardIds), 0);
    let r = rng() * total;
    let index = pool.length - 1;
    for (let i = 0; i < pool.length; i++) {
      r -= weightOf(pool[i], hardIds);
      if (r < 0) {
        index = i;
        break;
      }
    }
    picked.push(pool.splice(index, 1)[0]);
  }
  return picked;
}

export type StartOutcome = "started" | "continued" | "no_words" | "done_for_today";

// '복습 시작'. 진행 중인 회차가 있으면 이어서 하고, 없으면 새로 뽑는다.
export function startRound(
  store: Store,
  now: Date = new Date(),
  rng: () => number = Math.random,
): { store: Store; result: StartOutcome } {
  const progress = normalizeProgress(store.progress, now);
  const ids = new Set(store.words.map((w) => w.id));

  const current = progress.current;
  if (current && current.wordIds.every((id) => ids.has(id))) {
    return { store: withProgress(store, progress), result: "continued" };
  }
  // 회차에 있던 단어가 지워졌으면 그 회차는 버리고 새로 시작한다.
  const cleared: Progress = current ? { ...progress, current: undefined } : progress;

  if (store.words.length === 0) return { store: withProgress(store, cleared), result: "no_words" };
  if (cleared.completed >= ROUNDS_PER_DAY) {
    return { store: withProgress(store, cleared), result: "done_for_today" };
  }

  const hardIds = new Set(store.hard.map((h) => h.wordId));
  const wordIds = pickWords(store.words, WORDS_PER_ROUND, rng, hardIds).map((w) => w.id);
  return {
    store: {
      ...store,
      progress: { ...cleared, current: { startedAt: now.toISOString(), wordIds, answered: 0 } },
    },
    result: "started",
  };
}

// 지금 답할 차례인 단어. 회차가 없거나 다 끝났으면 null.
export function currentWord(store: Store): Word | null {
  const current = store.progress.current;
  if (!current || current.answered >= current.wordIds.length) return null;
  const id = current.wordIds[current.answered];
  return store.words.find((w) => w.id === id) ?? null;
}

export type AnswerOutcome =
  | {
      ok: true;
      word: Word;
      roundFinished: boolean;
      countedToday: boolean; // 회차가 끝났을 때, 오늘 횟수에 더해졌는지 (자정을 넘긴 회차는 어제로 센다)
      addedToHard: boolean;
      removedFromHard: boolean;
    }
  | { ok: false };

// example: 답할 때 화면에 예문이 있었는지. 모르면(아직 불러오는 중) 생략한다.
export function answerCurrent(
  store: Store,
  answer: Answer,
  now: Date = new Date(),
  example?: ExampleKind,
): { store: Store; result: AnswerOutcome } {
  const progress = normalizeProgress(store.progress, now);
  const current = progress.current;
  const word = currentWord(store);
  if (!current || !word) return { store, result: { ok: false } };

  const inHard = store.hard.some((h) => h.wordId === word.id);
  let hard: HardItem[] = store.hard;
  let addedToHard = false;
  let removedFromHard = false;
  let missTotal = word.missTotal;
  let knownStreak = word.knownStreak;

  if (answer === "known") {
    knownStreak += 1;
    if (inHard && knownStreak >= KNOWN_STREAK_TO_CLEAR) {
      hard = hard.filter((h) => h.wordId !== word.id);
      missTotal = 0;
      knownStreak = 0;
      removedFromHard = true;
    }
  } else {
    missTotal += 1;
    knownStreak = 0;
    if (!inHard && missTotal >= MISS_LIMIT) {
      hard = [...hard, { wordId: word.id, savedAt: now.toISOString() }];
      addedToHard = true;
    }
  }

  const updated: Word = {
    ...word,
    missTotal,
    knownStreak,
    lastAnswer: answer,
    firstAnswer: word.firstAnswer ?? answer,
  };

  const answered = current.answered + 1;
  const roundFinished = answered >= current.wordIds.length;
  // 자정을 넘겨 끝난 회차는 시작한 날로 센다. 오늘 시작한 회차만 오늘 횟수에 더한다.
  const startedDate = kstDate(new Date(current.startedAt));
  const countsToday = startedDate === progress.date;
  const nextProgress: Progress = roundFinished
    ? { ...progress, completed: progress.completed + (countsToday ? 1 : 0), current: undefined }
    : { ...progress, current: { ...current, answered } };
  // 끝낸 회차는 시작한 날짜로 기록해 둔다 (통계용)
  const rounds = roundFinished ? [...(store.rounds ?? []), { at: now.toISOString(), date: startedDate }] : store.rounds;

  return {
    store: {
      ...store,
      words: store.words.map((w) => (w.id === word.id ? updated : w)),
      logs: [...store.logs, { wordId: word.id, at: now.toISOString(), answer, ...(example ? { example } : {}) } satisfies Log],
      hard,
      progress: nextProgress,
      ...(rounds ? { rounds } : {}),
    },
    result: { ok: true, word: updated, roundFinished, countedToday: countsToday, addedToHard, removedFromHard },
  };
}

// 어려운 단어 목록 화면에서 직접 뺀다. 목록에서 빠진 단어는 "모른다" 누적 횟수를 0으로 되돌린다 (PRD 5번 ②).
export function removeFromHard(store: Store, wordId: string): Store {
  if (!store.hard.some((h) => h.wordId === wordId)) return store;
  return {
    ...store,
    hard: store.hard.filter((h) => h.wordId !== wordId),
    words: store.words.map((w) => (w.id === wordId ? { ...w, missTotal: 0, knownStreak: 0 } : w)),
  };
}

// 홈 화면용: 오늘 끝낸 횟수 (날짜가 바뀌었으면 0).
export function completedToday(store: Store, now: Date = new Date()): number {
  return normalizeProgress(store.progress, now).completed;
}

export function googleSearchUrl(word: string): string {
  return `https://www.google.com/search?q=${encodeURIComponent(`${word} meaning pronunciation`)}`;
}

// 배열을 무작위 순서로 섞은 새 배열 (Fisher–Yates). 단어장의 Random 단추에 쓴다 (2026-10-30). 원본은 바꾸지 않는다.
export function shuffled<T>(items: readonly T[], rng: () => number = Math.random): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
