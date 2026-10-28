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

  // 각 단어의 복습 상태 글자와 색. Still Learning 목록에 있으면 황색, 마지막 답이 "안다"면 녹색, "모른다"면 빨간색 (상태색은 Tailwind 기본색, CLAUDE.md).
  const hardIds = useMemo(() => new Set(store.hard.map((h) => h.wordId)), [store.hard]);
  function statusOf(id: string, lastAnswer: "known" | "unknown" | undefined): { label: string; className: string } | null {
    if (hardIds.has(id)) return { label: "Still learning", className: "text-amber-700 dark:text-amber-400" };
    if (lastAnswer === "known") return { label: "Remembered", className: "text-green-700 dark:text-green-400" };
    if (lastAnswer === "unknown") return { label: "Looked up", className: "text-red-600 dark:text-red-400" };
    return null;
  }

  // 상태 필터 (2026-10-29 UX 개선): All / Still learning / Looked up. 검색 칸과 함께 적용된다.
  type Filter = "all" | "Still learning" | "Looked up";
  const [filter, setFilter] = useState<Filter>("all");
  const counts = useMemo(() => {
    const c = { "Still learning": 0, "Looked up": 0 };
    for (const w of store.words) {
      const label = statusOf(w.id, w.lastAnswer)?.label;
      if (label === "Still learning" || label === "Looked up") c[label]++;
    }
    return c;
    // statusOf는 hardIds에만 의존한다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.words, hardIds]);
  const visibleWords = sortedWords.filter((w) => {
    if (needle && !w.text.includes(needle)) return false;
    return filter === "all" || statusOf(w.id, w.lastAnswer)?.label === filter;
  });
  const FILTERS: { key: Filter; label: string; count?: number }[] = [
    { key: "all", label: "All" },
    { key: "Still learning", label: "Still learning", count: counts["Still learning"] },
    { key: "Looked up", label: "Looked up", count: counts["Looked up"] },
  ];

  // 입력칸 내용으로 미리 계산한 결과 (저장은 하지 않는다. addWords는 순수 함수). 빈 입력이면 null.
  const preview = useMemo(() => {
    if (!ready || value.trim() === "") return null;
    const { result } = addWords(store, value);
    return { added: result.added, skipped: result.skipped.filter((s) => s.reason !== "empty") };
  }, [ready, value, store]);

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
          {/* 누르기 전에 결과를 미리 보여준다 (2026-10-29 UX 개선): 몇 개가 더해지고 몇 개가 건너뛰어지는지 */}
          {preview && preview.skipped.length > 0 && (
            <span className="text-amber-700 dark:text-amber-400">
              {" "}
              {preview.skipped.length} will be skipped (duplicate or not a word).
            </span>
          )}
        </p>
        <button type="submit" disabled={!ready} className="min-h-11 rounded-lg bg-foreground px-4 text-base font-medium text-background disabled:opacity-50">
          {preview && preview.added.length > 0 ? `Add ${preview.added.length} word${preview.added.length === 1 ? "" : "s"}` : "Add"}
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

        {/* 상태 필터: 눌린 것은 네이비로 채운다. 개수는 검색과 상관없이 전체 기준 */}
        {ready && store.words.length > 0 && (
          <div role="group" aria-label="Filter by status" className="flex flex-wrap gap-2">
            {FILTERS.map((f) => {
              const on = filter === f.key;
              return (
                <button
                  key={f.key}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setFilter(f.key)}
                  className={`inline-flex min-h-9 items-center gap-1.5 rounded-full px-3.5 text-sm font-medium transition-colors ${
                    on ? "bg-foreground text-background" : "border border-zinc-300 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  }`}
                >
                  {f.label}
                  {f.count !== undefined && <span className={`font-score text-sm ${on ? "text-background/70" : "text-zinc-500 dark:text-zinc-400"}`}>{f.count}</span>}
                </button>
              );
            })}
          </div>
        )}

        {ready && store.words.length > 0 && visibleWords.length === 0 && (
          <p className="rounded-lg border border-dashed border-zinc-300 p-4 text-center text-sm text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
            {needle ? <>No words match &lsquo;{query.trim()}&rsquo;{filter !== "all" && ` in ${filter}`}.</> : `No words in ${filter}.`}
          </p>
        )}

        <ul className="flex flex-col divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {visibleWords.map((word) => (
            <li key={word.id} className="flex items-center justify-between gap-3 px-3">
              <span lang="en" className="min-w-0 break-words py-3 text-lg">
                {word.text}
                {/* 복습 상태는 단어 오른쪽 위 작은 윗첨자로 (2026-10-29: 아래 줄에 두면 자리를 많이 차지해서). 아직 안 물었으면 비움 */}
                {(() => {
                  const status = statusOf(word.id, word.lastAnswer);
                  return status && <sup className={`ml-1 whitespace-nowrap text-[10px] font-medium ${status.className}`}>{status.label}</sup>;
                })()}
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
