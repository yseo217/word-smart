"use client";

import { useStore } from "@/lib/use-store";

// 저장이 막힌 브라우저(일부 시크릿 모드, 저장 공간 꽉 참)에서 어떤 화면에서든 같은 경고를 보인다 (DESIGN.md 4장).
// 복습 응답·Still Learning 제거·백업 미루기처럼 화면에 따로 안내가 없는 저장도 여기서 알린다.
export default function SaveWarning() {
  const { saveFailed } = useStore();
  if (!saveFailed) return null;
  return (
    <p role="alert" className="mx-auto w-full max-w-md px-4 pt-3 text-sm text-red-700 dark:text-red-400">
      This browser is blocking storage. Changes are kept only until you close this tab. Export a backup if you want to keep them.
    </p>
  );
}
