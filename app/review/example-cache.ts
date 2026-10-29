// 복습 화면의 예문 캐시. 컴포넌트 밖(외부 저장소)에 두어서, 화면은 구독만 하고 요청은 여기서 한다.
// 회차의 단어(WORDS_PER_ROUND개)를 한꺼번에 요청해 두고 도착하는 대로 보여준다 (DESIGN.md 6.5).
import type { ExampleResult } from "@/lib/examples-core";

export type ExampleState =
  | { status: "loading"; previous?: DoneState } // '다른 예문 보기' 중에는 직전 예문을 그대로 보여주고 기록한다
  | DoneState;

export type DoneState =
  | {
      status: "done";
      result: ExampleResult;
      seen: string[];
      offline?: boolean; // 인터넷이 없어서 못 가져옴
      exhausted?: boolean; // '다른 예문 보기'로 더 찾았지만 없음. 마지막 예문은 그대로 보여준다 (PRD 5번 ②)
    };

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

// 한 단어당 '다른 예문 보기'는 5번까지 (외부 사전 API를 연타하지 않기 위해, PRD 5번 ②).
export const MAX_ANOTHER = 5;

// seen: '다른 예문 보기'로 이미 본 예문 id들. 서버가 그것들을 빼고 고른다.
export async function requestExample(wordId: string, text: string, seen: string[]) {
  const previous = states.get(wordId);
  if (previous?.status === "loading") return;
  if (previous?.status === "done" && previous.result.ok && seen.length > MAX_ANOTHER) {
    // 처음 예문 1개 + 다른 예문 5개를 봤으면 더 요청하지 않는다.
    states.set(wordId, { ...previous, exhausted: true });
    emit();
    return;
  }
  const keep = previous?.status === "done" && previous.result.ok ? previous : undefined;
  states.set(wordId, { status: "loading", previous: keep });
  emit();
  let next: ExampleState;
  try {
    const params = new URLSearchParams({ word: text });
    if (seen.length) params.set("skip", seen.join(","));
    const res = await fetch(`/api/example?${params}`);
    const result: ExampleResult = res.ok ? await res.json() : { ok: false };
    if (!result.ok && keep) {
      // 더 찾았지만 없다: 마지막 예문은 그대로 두고 "더 없음"만 표시한다.
      next = { ...keep, exhausted: true };
    } else {
      next = { status: "done", result, seen: result.ok ? [...seen, result.id] : seen };
    }
  } catch {
    // 요청 자체가 실패했고 브라우저가 오프라인이라고 하면, 그 이유를 화면에 알려준다 ('다른 예문 보기' 때도).
    const offline = typeof navigator !== "undefined" && navigator.onLine === false;
    next = keep ? { ...keep, exhausted: true, offline } : { status: "done", result: { ok: false }, seen, offline };
  }
  states.set(wordId, next);
  emit();
}

// 답할 때 기록할 예문 종류. 처음 예문을 아직 불러오는 중이면 undefined, '다른 예문 보기' 중이면 보고 있던 직전 예문의 종류.
export function exampleKindOf(state: ExampleState | undefined): "voa" | "dictionary" | "none" | undefined {
  if (!state) return undefined;
  const shown = state.status === "done" ? state : state.previous;
  if (!shown) return undefined;
  return shown.result.ok ? shown.result.kind : "none";
}
