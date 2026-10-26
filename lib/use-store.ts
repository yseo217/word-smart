"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { emptyStore, parseStore, STORAGE_KEY, withFirstUse, type Store } from "./store.ts";

// 브라우저의 localStorage에 저장한다. 학습 기록은 서버로 보내지 않는다 (PRD 7번).
// 저장이 막힌 브라우저(예: 일부 시크릿 모드)에서는 이 탭이 열려 있는 동안만 메모리에 둔다.

const listeners = new Set<() => void>();
let memoryRaw: string | null = null;

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
        emit();
        return { result, saved: true };
      } catch {
        memoryRaw = serialized;
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
    emit();
  }, []);

  return {
    ready: parsed !== null,
    store: parsed?.store ?? emptyStore(),
    corrupt: parsed?.corrupt ?? false,
    update,
    replace,
    reset,
  };
}
