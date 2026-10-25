// 복습 화면의 예문 캐시. 컴포넌트 밖(외부 저장소)에 두어서, 화면은 구독만 하고 요청은 여기서 한다.
// 회차의 3단어를 한꺼번에 요청해 두고 도착하는 대로 보여준다 (DESIGN.md 6.5).
import type { ExampleResult } from "@/lib/examples-core";

export type ExampleState = { status: "loading" } | { status: "done"; result: ExampleResult; seen: string[] };

const states = new Map<string, ExampleState>();
const listeners = new Set<() => void>();
let version = 0;

function emit() {
  version += 1;
  listeners.forEach((l) => l());
}

export function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export const getVersion = () => version;
export const getServerVersion = () => 0;

export function getExampleState(wordId: string): ExampleState | undefined {
  return states.get(wordId);
}

export function clearExamples() {
  states.clear();
  emit();
}

// seen: '다른 예문 보기'로 이미 본 예문 id들. 서버가 그것들을 빼고 고른다.
export async function requestExample(wordId: string, text: string, seen: string[]) {
  if (states.get(wordId)?.status === "loading") return;
  states.set(wordId, { status: "loading" });
  emit();
  let next: ExampleState;
  try {
    const params = new URLSearchParams({ word: text });
    if (seen.length) params.set("skip", seen.join(","));
    const res = await fetch(`/api/example?${params}`);
    const result: ExampleResult = res.ok ? await res.json() : { ok: false };
    next = { status: "done", result, seen: result.ok ? [...seen, result.id] : seen };
  } catch {
    next = { status: "done", result: { ok: false }, seen };
  }
  states.set(wordId, next);
  emit();
}
