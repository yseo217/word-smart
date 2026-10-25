"use client";

import Link from "next/link";
import { useState } from "react";
import { KNOWN_STREAK_TO_CLEAR, MISS_LIMIT, removeFromHard } from "@/lib/quiz";
import { useStore } from "@/lib/use-store";

// 어려운 단어 목록(화면 이름은 "Still Learning"): "Look it up"을 누적 3번 누른 단어.
// 연속 3번 "I remember"면 저절로 빠지고, 여기서 직접 뺄 수도 있다.
export default function StillLearningPage() {
  const { ready, store, update } = useStore();

  const items = store.hard
    .map((h) => ({ ...h, word: store.words.find((w) => w.id === h.wordId) }))
    .filter((h) => h.word !== undefined)
    .sort((a, b) => b.savedAt.localeCompare(a.savedAt));

  // 단어장과 같은 검색 칸: 적은 글자가 들어 있는 단어만 남긴다.
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();
  const visible = needle ? items.filter((h) => h.word!.text.includes(needle)) : items;

  function handleRemove(wordId: string, text: string) {
    const sure = window.confirm(`Remove '${text}' from Still Learning?\nIts look-up count goes back to 0.`);
    if (!sure) return;
    update((current) => ({ store: removeFromHard(current, wordId), result: null }));
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-4 py-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Still Learning</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Words you looked up {MISS_LIMIT} times. They leave the list after {KNOWN_STREAK_TO_CLEAR} remembers in a row, or when you remove them here.
        </p>
      </header>

      {!ready && <p className="text-zinc-600 dark:text-zinc-400">Loading…</p>}

      {ready && items.length === 0 && (
        <section className="flex flex-col gap-3 rounded-lg border border-dashed border-zinc-300 p-5 text-center dark:border-zinc-700">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Nothing here yet. Words you keep looking up will show up here.</p>
          <Link href="/review" className="flex min-h-12 items-center justify-center rounded-lg bg-foreground px-4 text-base font-medium text-background">
            Start review
          </Link>
        </section>
      )}

      {ready && items.length > 0 && (
        <section aria-labelledby="hard-title" className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-3">
            <h2 id="hard-title" className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
              Still learning <span className="font-score text-lg font-medium text-foreground">{items.length}</span>
            </h2>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search"
              aria-label="Search still-learning words"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className="min-h-10 w-36 rounded-lg border border-zinc-300 bg-transparent px-3 text-sm dark:border-zinc-700"
            />
          </div>
          {visible.length === 0 && (
            <p className="rounded-lg border border-dashed border-zinc-300 p-4 text-center text-sm text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
              No words match &lsquo;{query.trim()}&rsquo;.
            </p>
          )}
          <ul className="flex flex-col divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
            {visible.map(({ word, savedAt }) => (
              <li key={word!.id} className="flex items-center justify-between gap-3 px-3 py-2">
                <div className="min-w-0">
                  <p lang="en" className="break-words text-xl font-semibold">
                    {word!.text}
                  </p>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400">
                    Looked up <span className="font-score text-sm">{word!.missTotal}</span> times · remembered{" "}
                    <span className="font-score text-sm">{word!.knownStreak}</span> in a row · since {savedAt.slice(0, 10)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemove(word!.id, word!.text)}
                  aria-label={`Remove ${word!.text} from Still Learning`}
                  className="min-h-11 shrink-0 rounded-lg px-3 text-sm text-red-600 dark:text-red-400"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
