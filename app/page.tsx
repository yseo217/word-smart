import Link from "next/link";
import TodayProgress from "./today-progress";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-10">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold">Today</h1>
        <p className="text-zinc-600 dark:text-zinc-400">Review the words in your list five times a day.</p>
      </header>

      <TodayProgress />

      {/* 통계 화면은 탭 대신 여기 링크로 간다 (PRD 4번 홈). 백업은 Word List 화면에 있다. */}
      <nav aria-label="More" className="flex flex-col gap-2">
        <Link href="/stats" className="flex min-h-12 items-center justify-between rounded-lg border border-zinc-300 px-4 text-base dark:border-zinc-700">
          <span>Stats</span>
          <span aria-hidden="true" className="text-zinc-400">
            →
          </span>
        </Link>
      </nav>
    </main>
  );
}
