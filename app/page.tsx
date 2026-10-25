import TodayProgress from "./today-progress";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-10">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold">Today</h1>
        <p className="text-zinc-600 dark:text-zinc-400">Review the words in your list five times a day.</p>
      </header>

      <TodayProgress />

      {/* 통계(Stats) 링크는 그 화면을 만들 때 여기에 추가한다 (PRD 4번 홈). 백업은 Word List 화면에 있다. */}
    </main>
  );
}
