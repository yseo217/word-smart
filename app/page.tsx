import TodayProgress from "./today-progress";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-10">
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-5xl font-black tracking-tight">Word Smart</h1>
        <h2 className="text-2xl font-semibold">Today</h2>
        <p className="text-zinc-600 dark:text-zinc-400">Review the words in your list five times a day.</p>
      </header>

      <TodayProgress />

      {/* 백업은 Word List 화면에, 통계는 Still Learning 화면에 링크가 있다 (PRD 4번). */}
    </main>
  );
}
