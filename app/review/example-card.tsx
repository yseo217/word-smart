"use client";

import { useMemo } from "react";
import type { ExampleState } from "./example-cache";

// 예문 한 장: 앞뒤 문장은 흐리게, 묻는 단어는 굵게+색으로 (앞뒤 문장은 강조하지 않는다).
export default function ExampleCard({ state, onAnother }: { state: ExampleState | undefined; onAnother: () => void }) {
  const box = "rounded-lg border border-zinc-200 p-4 dark:border-zinc-800";

  // '다른 예문 보기'를 불러오는 중에는 직전 예문을 그대로 두고 버튼만 "Finding…"으로 바꾼다 (카드가 비지 않게)
  const shown = !state || state.status === "done" ? state : state.previous;
  const busy = state?.status === "loading";
  if (!shown) {
    return (
      <div className={`${box} text-sm text-zinc-600 dark:text-zinc-400`} aria-busy="true">
        Finding an example…
      </div>
    );
  }
  const { result } = shown;
  if (!result.ok) {
    return (
      <div className={`${box} border-dashed text-sm text-zinc-600 dark:text-zinc-400`}>
        {shown.offline ? "Offline – examples need an internet connection." : "No example found for this word."}
      </div>
    );
  }
  return (
    <figure className={`${box} flex flex-col gap-3`}>
      <blockquote lang="en" className="text-lg leading-relaxed">
        {result.before && <span className="text-zinc-500 dark:text-zinc-400">{result.before} </span>}
        <Highlighted text={result.sentence} pattern={result.pattern} />
        {result.after && <span className="text-zinc-500 dark:text-zinc-400"> {result.after}</span>}
      </blockquote>
      <figcaption className="flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-600 dark:text-zinc-400">
        <span>
          Source:{" "}
          <a href={result.source.url} target="_blank" rel="noopener noreferrer" className="underline">
            {result.source.name}
          </a>
          {result.source.license && ` · ${result.source.license}`}
        </span>
        {shown.exhausted ? (
          <span className="min-h-9 content-center px-1">{shown.offline ? "Offline – can't look for more" : "No more examples"}</span>
        ) : (
          <button type="button" onClick={onAnother} disabled={busy} aria-busy={busy} className="min-h-9 rounded-md border border-zinc-300 px-3 disabled:opacity-50 dark:border-zinc-700">
            {busy ? "Finding…" : "Another example"}
          </button>
        )}
      </figcaption>
    </figure>
  );
}

function Highlighted({ text, pattern }: { text: string; pattern: string }) {
  const parts = useMemo(() => {
    const re = new RegExp(pattern, "gi");
    const out: { text: string; hit: boolean }[] = [];
    let last = 0;
    for (const m of text.matchAll(re)) {
      if (m.index === undefined) continue;
      if (m.index > last) out.push({ text: text.slice(last, m.index), hit: false });
      out.push({ text: m[0], hit: true });
      last = m.index + m[0].length;
    }
    if (last < text.length) out.push({ text: text.slice(last), hit: false });
    return out;
  }, [text, pattern]);

  return (
    <>
      {parts.map((p, i) =>
        p.hit ? (
          <mark key={i} className="rounded bg-amber-200 px-0.5 font-bold text-amber-950 dark:bg-amber-500/30 dark:text-amber-200">
            {p.text}
          </mark>
        ) : (
          <span key={i}>{p.text}</span>
        ),
      )}
    </>
  );
}
