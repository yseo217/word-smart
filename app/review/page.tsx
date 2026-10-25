"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { answerCurrent, completedToday, currentWord, googleSearchUrl, ROUNDS_PER_DAY, startRound } from "@/lib/quiz";
import type { Answer } from "@/lib/store";
import { useStore } from "@/lib/use-store";
import ExampleCard from "./example-card";
import { clearExamples, getExampleState, getServerVersion, getVersion, requestExample, subscribe } from "./example-cache";

type HardNotes = { added: string[]; removed: string[] };
const NO_NOTES: HardNotes = { added: [], removed: [] };

export default function ReviewPage() {
  const { ready, store, update } = useStore();
  // 회차를 막 끝낸 직후에는 결과를 보여주고, 'One more round'를 누를 때까지 새 회차를 시작하지 않는다.
  const [finished, setFinished] = useState<HardNotes | null>(null);
  const [notes, setNotes] = useState<HardNotes>(NO_NOTES);
  // 예문은 외부 캐시(example-cache)에 있고, 바뀔 때마다 다시 그린다.
  useSyncExternalStore(subscribe, getVersion, getServerVersion);

  const current = store.progress.current;
  const word = currentWord(store);
  // 오늘 날짜는 브라우저에서 저장소가 준비된 뒤에만 읽는다 (미리 그리는 단계에서는 현재 시각을 쓸 수 없다).
  const completed = ready ? Math.min(completedToday(store), ROUNDS_PER_DAY) : 0;
  const noWords = store.words.length === 0;
  const doneForToday = !word && completed >= ROUNDS_PER_DAY;

  useEffect(() => {
    if (!ready || finished || word) return;
    update((s) => startRound(s));
  }, [ready, finished, word, update]);

  // 회차의 단어들 중 아직 예문을 요청하지 않은 것을 한꺼번에 요청한다 (6.5).
  useEffect(() => {
    if (!current) return;
    for (const id of current.wordIds) {
      if (getExampleState(id)) continue;
      const w = store.words.find((x) => x.id === id);
      if (w) void requestExample(id, w.text, []);
    }
  }, [current, store.words]);

  function anotherExample() {
    if (!word) return;
    const state = getExampleState(word.id);
    const seen = state?.status === "done" ? state.seen : [];
    void requestExample(word.id, word.text, seen);
  }

  function answer(kind: Answer) {
    if (!word) return;
    if (kind === "unknown") {
      // 뜻은 앱이 만들지 않고 구글 검색을 새 탭으로 연다. 클릭 안에서 열어야 팝업 차단에 걸리지 않는다.
      window.open(googleSearchUrl(word.text), "_blank", "noopener,noreferrer");
    }
    const { result } = update((s) => answerCurrent(s, kind));
    if (!result.ok) return;
    const next: HardNotes = {
      added: result.addedToHard ? [...notes.added, result.word.text] : notes.added,
      removed: result.removedFromHard ? [...notes.removed, result.word.text] : notes.removed,
    };
    if (result.roundFinished) {
      setFinished(next);
      setNotes(NO_NOTES);
      clearExamples();
    } else {
      setNotes(next);
    }
  }

  const primary = "flex min-h-12 items-center justify-center rounded-lg bg-foreground px-4 text-base font-medium text-background";
  const secondary = "flex min-h-12 items-center justify-center rounded-lg border border-zinc-300 px-4 text-base dark:border-zinc-700";

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Review</h1>
        <span className="text-sm text-zinc-600 dark:text-zinc-400">
          Today {completed}/{ROUNDS_PER_DAY}
        </span>
      </header>

      {!ready && <p className="text-zinc-600 dark:text-zinc-400">Loading…</p>}

      {ready && finished && (
        <section className="flex flex-col gap-4 rounded-lg border border-zinc-200 p-5 dark:border-zinc-800">
          <h2 className="text-xl font-semibold">Round complete!</h2>
          <p className="text-zinc-600 dark:text-zinc-400">
            You&apos;ve done {completed}/{ROUNDS_PER_DAY} today.
          </p>
          {finished.added.length > 0 && (
            <p className="text-sm">
              Added to hard words: <span className="font-medium">{finished.added.join(", ")}</span>
            </p>
          )}
          {finished.removed.length > 0 && (
            <p className="text-sm">
              Removed from hard words: <span className="font-medium">{finished.removed.join(", ")}</span>
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

      {ready && !finished && noWords && (
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

      {ready && !finished && current && word && (
        <section className="flex flex-col gap-6" aria-live="polite">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {current.answered + 1} / {current.wordIds.length}
          </p>
          <p lang="en" className="break-words text-4xl font-semibold tracking-tight">
            {word.text}
          </p>
          <ExampleCard state={getExampleState(word.id)} onAnother={anotherExample} />
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
            &lsquo;Look it up&rsquo; opens a Google search for the meaning and pronunciation in a new tab, then moves on.
          </p>
        </section>
      )}
    </main>
  );
}
