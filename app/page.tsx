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

      <nav className="flex flex-col gap-3" aria-label="Menu">
        <Link href="/words" className="flex min-h-12 items-center justify-center rounded-lg border border-zinc-300 px-4 text-base dark:border-zinc-700">
          Word list
        </Link>
      </nav>
    </main>
  );
}
