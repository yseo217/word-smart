"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { answerCurrent, completedToday, currentWord, googleSearchUrl, ROUNDS_PER_DAY, startRound } from "@/lib/quiz";
import type { Answer, Word } from "@/lib/store";
import { useStore } from "@/lib/use-store";
import ExampleCard from "./example-card";
import SpeakButton from "./speak-button";
import { clearExamples, exampleKindOf, getExampleState, getServerVersion, getVersion, requestExample, subscribe } from "./example-cache";

type HardNotes = { added: string[]; removed: string[] };
const NO_NOTES: HardNotes = { added: [], removed: [] };
// 회차 요약: 어려운 단어 변동과, 이 회차가 오늘 횟수에 더해졌는지(자정을 넘긴 회차는 어제로 센다).
type Finished = HardNotes & { countedToday: boolean };

// 'Look it up'을 누른 뒤의 상태: 응답은 이미 기록됐지만, 'Next'를 누를 때까지 그 단어와 예문을 계속 보여준다 (PRD 5번 ②).
type LookedUp = { word: Word; index: number; total: number; finished: Finished | null };

export default function ReviewPage() {
  const { ready, store, update } = useStore();
  // 회차를 막 끝낸 직후에는 결과를 보여주고, 'One more round'를 누를 때까지 새 회차를 시작하지 않는다.
  const [finished, setFinished] = useState<Finished | null>(null);
  const [notes, setNotes] = useState<HardNotes>(NO_NOTES);
  const [lookedUp, setLookedUp] = useState<LookedUp | null>(null);
  // 예문은 외부 캐시(example-cache)에 있고, 바뀔 때마다 다시 그린다.
  useSyncExternalStore(subscribe, getVersion, getServerVersion);

  const current = store.progress.current;
  const word = currentWord(store);
  // 오늘 날짜는 브라우저에서 저장소가 준비된 뒤에만 읽는다 (미리 그리는 단계에서는 현재 시각을 쓸 수 없다).
  const completed = ready ? Math.min(completedToday(store), ROUNDS_PER_DAY) : 0;
  const noWords = store.words.length === 0;
  const doneForToday = !word && !lookedUp && completed >= ROUNDS_PER_DAY;

  useEffect(() => {
    if (!ready || finished || lookedUp || word) return;
    update((s) => startRound(s));
  }, [ready, finished, lookedUp, word, update]);

  // 회차의 단어들 중 아직 예문을 요청하지 않은 것을 한꺼번에 요청한다 (6.5).
  useEffect(() => {
    if (!current) return;
    for (const id of current.wordIds) {
      if (getExampleState(id)) continue;
      const w = store.words.find((x) => x.id === id);
      if (w) void requestExample(id, w.text, []);
    }
  }, [current, store.words]);

  // 화면에 보이는 단어: 'Look it up' 직후에는 방금 답한 단어, 아니면 지금 답할 차례인 단어.
  const shown = lookedUp?.word ?? word;
  const position = lookedUp
    ? { index: lookedUp.index, total: lookedUp.total }
    : current
      ? { index: current.answered + 1, total: current.wordIds.length }
      : null;

  function anotherExample() {
    if (!shown) return;
    const state = getExampleState(shown.id);
    const seen = state?.status === "done" ? state.seen : [];
    void requestExample(shown.id, shown.text, seen);
  }

  function answer(kind: Answer) {
    if (!word || !current) return;
    if (kind === "unknown") {
      // 뜻은 앱이 만들지 않고 구글 검색을 새 탭으로 연다. 클릭 안에서 열어야 팝업 차단에 덜 걸린다.
      // 차단되어 안 열려도 응답은 그대로 기록되고, 화면의 'Open Google' 링크로 다시 열 수 있다.
      window.open(googleSearchUrl(word.text), "_blank", "noopener,noreferrer");
    }
    const index = current.answered + 1;
    const total = current.wordIds.length;
    const exampleKind = exampleKindOf(getExampleState(word.id));
    const { result } = update((s) => answerCurrent(s, kind, new Date(), exampleKind));
    if (!result.ok) return;
    const next: HardNotes = {
      added: result.addedToHard ? [...notes.added, result.word.text] : notes.added,
      removed: result.removedFromHard ? [...notes.removed, result.word.text] : notes.removed,
    };
    const summary: Finished = { ...next, countedToday: result.countedToday };
    if (kind === "unknown") {
      // 같은 단어에 머문다. 회차가 끝났더라도 요약은 'Next'를 누른 뒤에 보여준다.
      setLookedUp({ word, index, total, finished: result.roundFinished ? summary : null });
      setNotes(result.roundFinished ? NO_NOTES : next);
      return;
    }
    if (result.roundFinished) {
      setFinished(summary);
      setNotes(NO_NOTES);
      clearExamples();
    } else {
      setNotes(next);
    }
  }

  function goNext() {
    const pending = lookedUp;
    setLookedUp(null);
    if (pending?.finished) {
      setFinished(pending.finished);
      clearExamples();
    }
  }

  const primary = "flex min-h-12 items-center justify-center rounded-lg bg-foreground px-4 text-base font-medium text-background";
  const secondary = "flex min-h-12 items-center justify-center rounded-lg border border-zinc-300 px-4 text-base dark:border-zinc-700";

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Review</h1>
        <span className="text-sm text-zinc-600 dark:text-zinc-400">
          Today{" "}
          <span className="font-score text-xl font-semibold text-foreground">
            {completed}
            <span className="text-zinc-400">/{ROUNDS_PER_DAY}</span>
          </span>
        </span>
      </header>

      {!ready && <p className="text-zinc-600 dark:text-zinc-400">Loading…</p>}

      {ready && finished && (
        <section className="flex flex-col gap-4 rounded-lg border border-zinc-200 p-5 dark:border-zinc-800">
          <h2 className="font-display text-2xl font-bold">Round complete!</h2>
          <p className="text-zinc-600 dark:text-zinc-400">
            You&apos;ve done{" "}
            <span className="font-score text-xl font-semibold text-foreground">
              {completed}/{ROUNDS_PER_DAY}
            </span>{" "}
            today.
          </p>
          {!finished.countedToday && (
            <p className="rounded-lg bg-zinc-100 p-3 text-sm dark:bg-zinc-900">
              This round started before midnight, so it counts toward yesterday, not today.
            </p>
          )}
          {finished.added.length > 0 && (
            <p className="text-sm">
              Added to Still Learning: <span className="font-medium">{finished.added.join(", ")}</span>
            </p>
          )}
          {finished.removed.length > 0 && (
            <p className="text-sm">
              Learned (out of Still Learning): <span className="font-medium">{finished.removed.join(", ")}</span>
            </p>
          )}
          <div className="flex flex-col gap-2">
            {completed < ROUNDS_PER_DAY ? (
              <button type="button" onClick={() => setFinished(null)} className={primary}>
                One more round
              </button>
            ) : (
              <p className="rounded-lg bg-zinc-100 p-3 text-center text-sm dark:bg-zinc-900">All done for today.</p>
            )}
            <Link href="/" className={secondary}>
              Home
            </Link>
          </div>
        </section>
      )}

      {ready && !finished && !lookedUp && noWords && (
        <section className="flex flex-col gap-3 rounded-lg border border-dashed border-zinc-300 p-5 text-center dark:border-zinc-700">
          <p>Add some words first.</p>
          <Link href="/words" className={primary}>
            Go to word list
          </Link>
        </section>
      )}

      {ready && !finished && !noWords && doneForToday && (
        <section className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-5 text-center dark:border-zinc-800">
          <p className="text-lg font-medium">Done for today</p>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">You&apos;ve finished all {ROUNDS_PER_DAY} rounds. See you tomorrow.</p>
          <Link href="/" className={secondary}>
            Home
          </Link>
        </section>
      )}

      {ready && !finished && shown && position && (
        <section className="flex flex-col gap-6" aria-live="polite">
          <p className="font-score text-xl font-medium text-zinc-600 dark:text-zinc-400">
            {position.index}
            <span className="text-zinc-400"> / {position.total}</span>
          </p>
          <div className="flex items-center justify-between gap-3">
            <p lang="en" className="min-w-0 break-words text-4xl font-semibold tracking-tight">
              {shown.text}
            </p>
            <SpeakButton text={shown.text} />
          </div>
          <ExampleCard state={getExampleState(shown.id)} onAnother={anotherExample} />

          {lookedUp ? (
            <>
              <p className="text-base text-zinc-700 dark:text-zinc-300">Looked it up. Read the example once more, then move on.</p>
              <div className="grid grid-cols-2 gap-3">
                <a href={googleSearchUrl(shown.text)} target="_blank" rel="noopener noreferrer" className={secondary}>
                  Open Google
                </a>
                <button type="button" onClick={goNext} className={primary}>
                  Next
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="text-base text-zinc-700 dark:text-zinc-300">Does it ring a bell?</p>
              <div className="grid grid-cols-2 gap-3">
                <button type="button" onClick={() => answer("known")} className="min-h-14 rounded-lg bg-foreground text-lg font-medium text-background">
                  I remember
                </button>
                <button type="button" onClick={() => answer("unknown")} className="min-h-14 rounded-lg border border-zinc-300 text-lg font-medium dark:border-zinc-700">
                  Look it up
                </button>
              </div>
              <p className="text-xs text-zinc-600 dark:text-zinc-400">
                &lsquo;Look it up&rsquo; opens a Google search for the meaning and pronunciation in a new tab. You stay on this word until you press Next.
                <br />
                Tip: on iPhone, press and hold the word and choose &lsquo;Look Up&rsquo; for the built-in dictionary.
              </p>
            </>
          )}
        </section>
      )}
    </main>
  );
}
