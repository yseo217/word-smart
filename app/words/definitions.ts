"use client";

import { useEffect, useRef } from "react";
import { setDefinitions, type Store } from "@/lib/store";

// 단어장에 보여줄 사전 뜻 채우기 (2026-10-30, DESIGN.md 3장): 뜻이 아직 없는 단어(definition === undefined)를 10개씩
// /api/define에 물어 저장본에 붙인다. 한 번 받은 뜻은 저장되므로 다시 묻지 않는다(사전에 없으면 null로 적어 두어 역시 다시 묻지 않는다).
// 새로 추가한 단어, 백업으로 들어온 단어도 뜻이 없으면 같은 길로 채워진다(words가 바뀔 때마다 다시 본다).
// 실패(오프라인, 서버 오류)하면 1분 쉬었다가 다시 시도한다 — 영영 멈추면 그 사이 추가한 단어의 뜻이 안 붙는다 (2026-10-30 사용자 요청).
const BATCH = 10;
const RETRY_AFTER_MS = 60_000;

type Update = <T>(fn: (current: Store) => { store: Store; result: T }) => { result: T; saved: boolean };

export function useFillDefinitions(ready: boolean, words: readonly { text: string; definition?: string | null }[], update: Update): void {
  const inFlight = useRef<Set<string>>(new Set());
  const pausedUntil = useRef(0);

  useEffect(() => {
    if (!ready || Date.now() < pausedUntil.current) return;
    const missing = words.filter((w) => w.definition === undefined && !inFlight.current.has(w.text)).map((w) => w.text);
    if (missing.length === 0) return;
    const batch = [...new Set(missing)].slice(0, BATCH);
    batch.forEach((w) => inFlight.current.add(w));

    // 받은 뜻은 효과가 다시 돌았거나 화면을 떠났어도 저장한다(저장본은 화면과 무관한 전역 상태라 버릴 이유가 없고, 버리면 같은 단어를 또 묻게 된다).
    (async () => {
      try {
        const res = await fetch(`/api/define?words=${encodeURIComponent(batch.join(","))}`);
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as { ok: boolean; definitions?: Record<string, string | null> };
        if (!data.ok || !data.definitions) throw new Error("bad response");
        update((current) => ({ store: setDefinitions(current, data.definitions!), result: null })); // 저장되면 words가 바뀌어 다음 묶음으로 이어진다
      } catch {
        pausedUntil.current = Date.now() + RETRY_AFTER_MS; // 오프라인·서버 오류: 1분 뒤 words가 바뀌거나 화면을 다시 열면 재시도
      } finally {
        batch.forEach((w) => inFlight.current.delete(w));
      }
    })();
  }, [ready, words, update]);
}
