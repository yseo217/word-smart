"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { addWords, removeWord, type SkippedItem } from "@/lib/store";
import { useStore } from "@/lib/use-store";
import BackupNotice from "../backup-notice";

type Notice = { kind: "ok" | "error"; text: string } | null;

// 건너뛴 단어가 많을 때 화면에 보여주는 개수 (나머지는 "… and N more"로 접는다, PRD 5번 ①)
const MAX_SKIPPED_SHOWN = 10;

export default function WordsPage() {
  const { ready, store, corrupt, update } = useStore();
  const [value, setValue] = useState("");
  const [notice, setNotice] = useState<Notice>(null);
  const [skipped, setSkipped] = useState<SkippedItem[]>([]);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // 목록은 알파벳 순으로 보여주고, 검색 칸에 적은 글자가 들어 있는 단어만 남긴다 (저장 순서는 입력 순서 그대로).
  const [query, setQuery] = useState("");
  const sortedWords = useMemo(() => [...store.words].sort((a, b) => a.text.localeCompare(b.text, "en")), [store.words]);
  const needle = query.trim().toLowerCase();
  const visibleWords = needle ? sortedWords.filter((w) => w.text.includes(needle)) : sortedWords;

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const { result } = update((current) => addWords(current, value)); // 저장 실패는 모든 화면 공통 경고(app/save-warning.tsx)가 알린다
    const { added, skipped: failed } = result;

    if (added.length === 0) {
      // 아무것도 추가하지 못했다. 입력은 그대로 두어서 고칠 수 있게 한다.
      const only = failed.length === 1 ? failed[0].message : `Nothing was added. Check the ${failed.length} entries below.`;
      setNotice({ kind: "error", text: only });
      setSkipped(failed.length > 1 ? failed : []);
    } else {
      const names = added.length <= 3 ? `: ${added.map((w) => w.text).join(", ")}` : "";
      const extra = failed.length > 0 ? ` Skipped ${failed.length}.` : "";
      setNotice({ kind: "ok", text: `Added ${added.length}${names}.${extra}` });
      setSkipped(failed);
      // 건너뛴 것만 입력칸에 남겨서 바로 고칠 수 있게 한다.
      setValue(failed.map((f) => f.input).join("\n"));
    }
    inputRef.current?.focus();
  }

  function handleRemove(id: string, text: string) {
    const sure = window.confirm(`Delete '${text}'?\nIts review history will be removed too.`);
    if (!sure) return;
    update((current) => ({ store: removeWord(current, id), result: null }));
    setNotice({ kind: "ok", text: `Deleted '${text}'.` });
    setSkipped([]);
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-4 py-6">
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Word list</h1>
        <Link href="/backup" className="min-h-11 content-center rounded-lg border border-zinc-300 px-3 text-sm dark:border-zinc-700">
          Backup
        </Link>
      </header>

      <BackupNotice />

      {corrupt && (
        <p role="alert" className="rounded-lg border border-amber-500 bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100">
          Saved data could not be read. When you add a word, the old data is kept under a separate name.
        </p>
      )}

      <form onSubmit={handleAdd} className="flex flex-col gap-2" noValidate>
        <label htmlFor="word" className="text-sm font-medium">
          Add English words
        </label>
        <textarea
          ref={inputRef}
          id="word"
          rows={3}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            // 컴퓨터에서는 Ctrl+Enter(맥은 ⌘+Enter)로도 추가할 수 있다.
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) e.currentTarget.form?.requestSubmit();
          }}
          autoCapitalize="none"
          autoCorrect="off"
          autoComplete="off"
          spellCheck={false}
          placeholder={"One per line, or separated by commas\ne.g. ubiquitous, hinder"}
          aria-describedby="word-help word-notice"
          className="min-w-0 resize-y rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-base dark:border-zinc-700"
        />
        <p id="word-help" className="text-xs text-zinc-600 dark:text-zinc-400">
          Separate words with a new line or a comma to add several at once.
        </p>
        <button type="submit" disabled={!ready} className="min-h-11 rounded-lg bg-foreground px-4 text-base font-medium text-background disabled:opacity-50">
          Add
        </button>
        <p
          id="word-notice"
          aria-live="polite"
          className={`min-h-5 text-sm ${notice?.kind === "error" ? "text-red-600 dark:text-red-400" : "text-green-700 dark:text-green-400"}`}
        >
          {notice?.text}
        </p>
        {skipped.length > 0 && (
          <ul className="flex flex-col gap-1 text-sm text-red-600 dark:text-red-400">
            {skipped.slice(0, MAX_SKIPPED_SHOWN).map((s, i) => (
              <li key={`${s.input}-${i}`}>
                <span className="font-medium break-all">{s.input || "(empty)"}</span> — {s.message}
              </li>
            ))}
            {skipped.length > MAX_SKIPPED_SHOWN && (
              <li className="text-zinc-600 dark:text-zinc-400">… and {skipped.length - MAX_SKIPPED_SHOWN} more (all of them are still in the box above)</li>
            )}
          </ul>
        )}
      </form>

      <section aria-labelledby="list-title" className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <h2 id="list-title" className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
            {ready ? (
              <>
                Your words <span className="font-score text-lg font-medium text-foreground">{store.words.length}</span>
              </>
            ) : (
              "Loading…"
            )}
          </h2>
          {ready && store.words.length > 0 && (
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search"
              aria-label="Search your words"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className="min-h-10 w-36 rounded-lg border border-zinc-300 bg-transparent px-3 text-sm dark:border-zinc-700"
            />
          )}
        </div>

        {ready && store.words.length === 0 && (
          <p className="rounded-lg border border-dashed border-zinc-300 p-4 text-center text-sm text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
            No words yet. Add your first English word above.
          </p>
        )}

        {ready && store.words.length > 0 && visibleWords.length === 0 && (
          <p className="rounded-lg border border-dashed border-zinc-300 p-4 text-center text-sm text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
            No words match &lsquo;{query.trim()}&rsquo;.
          </p>
        )}

        <ul className="flex flex-col divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {visibleWords.map((word) => (
            <li key={word.id} className="flex items-center justify-between gap-3 px-3">
              <span lang="en" className="min-w-0 break-words py-3 text-lg">
                {word.text}
              </span>
              <button
                type="button"
                onClick={() => handleRemove(word.id, word.text)}
                aria-label={`Delete ${word.text}`}
                className="min-h-11 shrink-0 rounded-lg px-3 text-sm text-red-600 dark:text-red-400"
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
