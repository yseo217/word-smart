"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { kstDate } from "./kst.ts";
import { emptyStore, parseStore, STORAGE_KEY, withFirstUse, type Store } from "./store.ts";

// ---- 한국 시간 자정 알림 (DESIGN.md 5.1) ----
// 앱을 열어 둔 채 자정을 넘기면 Today 카드와 탭 바의 N/5가 어제 값으로 남는다. 자정이 되면(또는 잠들었다 깨어나 날짜가 바뀌어 있으면)
// 구독한 화면을 다시 그리게 한다. 값(tick)은 바뀔 때마다 1씩 오르는 숫자일 뿐이다.
const tickListeners = new Set<() => void>();
let tick = 0;
let tickTimer: ReturnType<typeof setTimeout> | null = null;
let tickDate = "";

function msUntilNextKstMidnight(now: Date): number {
  const [y, m, d] = kstDate(now).split("-").map(Number);
  const nextMidnightUtc = Date.UTC(y, m - 1, d + 1) - 9 * 60 * 60 * 1000; // KST 다음 날 0시 = UTC 전날 15시
  return Math.max(1000, nextMidnightUtc - now.getTime() + 1000);
}

function bumpTickIfDateChanged() {
  const today = kstDate(new Date());
  if (today !== tickDate) {
    tickDate = today;
    tick++;
    tickListeners.forEach((l) => l());
  }
  scheduleTick();
}

function scheduleTick() {
  if (tickTimer !== null) clearTimeout(tickTimer);
  tickTimer = setTimeout(bumpTickIfDateChanged, msUntilNextKstMidnight(new Date()));
}

function subscribeTick(callback: () => void) {
  if (tickListeners.size === 0) {
    tickDate = kstDate(new Date());
    scheduleTick();
    document.addEventListener("visibilitychange", bumpTickIfDateChanged); // 폰이 잠들었다 깨어난 경우
  }
  tickListeners.add(callback);
  return () => {
    tickListeners.delete(callback);
    if (tickListeners.size === 0) {
      if (tickTimer !== null) clearTimeout(tickTimer);
      tickTimer = null;
      document.removeEventListener("visibilitychange", bumpTickIfDateChanged);
    }
  };
}

// 오늘 횟수(N/5)처럼 "오늘"에 묶인 값을 그리는 화면이 부른다. 돌려주는 숫자는 쓰지 않아도 된다. 자정에 다시 그려지는 것이 목적이다.
export function useKstMidnightTick(): number {
  return useSyncExternalStore(
    subscribeTick,
    () => tick,
    () => 0,
  );
}

// 브라우저의 localStorage에 저장한다. 학습 기록은 서버로 보내지 않는다 (PRD 7번).
// 저장이 막힌 브라우저(예: 일부 시크릿 모드)에서는 이 탭이 열려 있는 동안만 메모리에 둔다.

const listeners = new Set<() => void>();
let memoryRaw: string | null = null;
let saveFailed = false; // 마지막 저장이 막혔는가 (이 탭의 메모리에만 남아 있음)

function emit() {
  listeners.forEach((l) => l());
}

function subscribe(callback: () => void) {
  listeners.add(callback);
  window.addEventListener("storage", callback); // 다른 탭에서 바뀐 경우
  return () => {
    listeners.delete(callback);
    window.removeEventListener("storage", callback);
  };
}

function readRaw(): string {
  if (memoryRaw !== null) return memoryRaw;
  try {
    return localStorage.getItem(STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

// 서버에서 미리 그려 볼 때는 읽을 수 없으니 null (준비 안 됨).
function readServer(): string | null {
  return null;
}

export type UpdateOutcome<T> = { result: T; saved: boolean };

export function useStore() {
  const raw = useSyncExternalStore<string | null>(subscribe, readRaw, readServer);
  const failed = useSyncExternalStore(
    subscribe,
    () => saveFailed,
    () => false,
  );

  const parsed = useMemo(() => (raw === null ? null : parseStore(raw)), [raw]);

  // fn은 최신 저장본을 받아 {store, result}를 돌려준다. store가 그대로(같은 객체)면 저장하지 않는다.
  const update = useCallback(
    <T,>(fn: (current: Store) => { store: Store; result: T }): UpdateOutcome<T> => {
      const currentRaw = readRaw();
      const { store: current, corrupt } = parseStore(currentRaw);
      const { store: changed, result } = fn(current);
      if (changed === current) return { result, saved: true };
      const next = withFirstUse(changed);

      // 읽을 수 없던 옛 데이터는 덮어쓰기 전에 다른 이름으로 남겨 둔다.
      if (corrupt && currentRaw) {
        try {
          localStorage.setItem(`${STORAGE_KEY}:corrupt:${Date.now()}`, currentRaw);
        } catch {
          // 보관하지 못해도 계속한다.
        }
      }

      const serialized = JSON.stringify(next);
      try {
        localStorage.setItem(STORAGE_KEY, serialized);
        memoryRaw = null;
        saveFailed = false;
        emit();
        return { result, saved: true };
      } catch {
        memoryRaw = serialized;
        saveFailed = true; // 모든 화면이 같은 경고를 보이도록 여기서 기억한다 (app/save-warning.tsx)
        emit();
        return { result, saved: false };
      }
    },
    [],
  );

  // 백업 가져오기: 저장본 전체를 파일의 것으로 바꾼다 (PRD 5번 nice).
  const replace = useCallback((next: Store): boolean => update(() => ({ store: next, result: null })).saved, [update]);

  // 전체 데이터 초기화: 저장된 것을 모두 지운다 (첫 사용일, 백업 시각, 읽을 수 없어 따로 보관한 사본 포함).
  const reset = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
      for (const key of Object.keys(localStorage)) {
        if (key.startsWith(`${STORAGE_KEY}:corrupt:`)) localStorage.removeItem(key);
      }
    } catch {
      // 저장소에 손댈 수 없으면 메모리만 비운다.
    }
    memoryRaw = null;
    saveFailed = false; // 초기화했으니 "메모리에만 남아 있다"는 경고도 거둔다
    emit();
  }, []);

  return {
    ready: parsed !== null,
    saveFailed: failed,
    store: parsed?.store ?? emptyStore(),
    corrupt: parsed?.corrupt ?? false,
    update,
    replace,
    reset,
  };
}
