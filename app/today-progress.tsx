"use client";

import Link from "next/link";
import { completedToday, ROUNDS_PER_DAY } from "@/lib/quiz";
import { useStore } from "@/lib/use-store";

// 홈 화면의 'Today N/5'와 'Start review' 버튼. 저장소를 읽어야 해서 클라이언트 컴포넌트다.
export default function TodayProgress() {
  const { ready, store } = useStore();
  // 오늘 날짜는 브라우저에서 저장소가 준비된 뒤에만 읽는다 (미리 그리는 단계에서는 현재 시각을 쓸 수 없다).
  const completed = ready ? Math.min(completedToday(store), ROUNDS_PER_DAY) : 0;
  const hasWords = store.words.length > 0;
  const inProgress = Boolean(store.progress.current);
  const done = completed >= ROUNDS_PER_DAY && !inProgress;

  const primary = "flex min-h-12 items-center justify-center rounded-lg bg-foreground px-4 text-base font-medium text-background";
  const secondary = "flex min-h-12 items-center justify-center rounded-lg border border-zinc-300 px-4 text-base dark:border-zinc-700";

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <p className="text-sm text-zinc-600 dark:text-zinc-400">{ready ? `Today's reviews ${completed}/${ROUNDS_PER_DAY}` : "Loading…"}</p>
      {!ready && <span className={`${primary} opacity-50`}>Start review</span>}
      {ready && !hasWords && (
        <Link href="/words" className={primary}>
          Add words first
        </Link>
      )}
      {ready && hasWords && done && <span className={`${secondary} opacity-70`}>Done for today</span>}
      {ready && hasWords && !done && (
        <Link href="/review" className={primary}>
          {inProgress ? "Continue review" : "Start review"}
        </Link>
      )}
    </section>
  );
}
