"use client";

import { ROUNDS_PER_DAY } from "@/lib/quiz";
import { activeDaysLast4Weeks, daysSinceFirstUse, EXAMPLE_MIN_SAMPLE, exampleRate, retention, roundsThisWeek } from "@/lib/stats";
import { useStore } from "@/lib/use-store";

// 통계 화면 (PRD 5번 nice): 이번 주 복습 횟수, 최근 4주 복습한 날 수, 기억률, 예문 제공률
export default function StatsPage() {
  const { ready, store } = useStore();
  // 현재 시각은 브라우저에서 저장소가 준비된 뒤에만 읽는다 (미리 그리는 단계에서는 쓸 수 없다).
  const now = ready ? new Date() : null;
  const weekRounds = now ? roundsThisWeek(store, now) : 0;
  const activeDays = now ? activeDaysLast4Weeks(store, now) : 0;
  const memory = retention(store);
  const examples = exampleRate(store);
  const day = now ? daysSinceFirstUse(store, now) : null;

  const pct = (rate: number) => `${Math.round(rate * 100)}%`;

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-4 py-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Stats</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {ready ? (day ? `Day ${day} of Word Smart.` : "Nothing recorded yet.") : "Loading…"} Goals are set for the first four weeks.
        </p>
      </header>

      {ready && (
        <section className="grid grid-cols-2 gap-3" aria-label="Statistics">
          <Stat
            label="Rounds this week"
            value={String(weekRounds)}
            detail={`Goal: ${4 * 5} per week (4 of ${ROUNDS_PER_DAY} a day, 5 days). Mon–Sun.`}
          />
          <Stat label="Active days" value={`${activeDays}`} unit="/ 28" detail="Days with at least one finished round in the last four weeks. Goal: 20." />
          <Stat
            label="Remembered"
            value={memory.rate === null ? "–" : pct(memory.rate)}
            detail={
              memory.total === 0
                ? "Words you first looked up, later remembered. None looked up yet."
                : `${memory.known} of ${memory.total} words you first looked up are remembered now. Goal: 70% after four weeks.`
            }
          />
          <Stat
            label="Examples shown"
            value={examples.rate === null ? "–" : pct(examples.rate)}
            detail={
              examples.rate === null
                ? `Not enough data yet (${examples.sample} of ${EXAMPLE_MIN_SAMPLE} answers).`
                : `${examples.withExample} of the last ${examples.sample} answers had an example. Goal: 60%.`
            }
          />
        </section>
      )}
    </main>
  );
}

function Stat({ label, value, unit, detail }: { label: string; value: string; unit?: string; detail: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-600 dark:text-zinc-400">{label}</p>
      <p className="font-score text-4xl font-semibold leading-none">
        {value}
        {unit && <span className="ml-1 text-lg text-zinc-400">{unit}</span>}
      </p>
      <p className="text-xs text-zinc-600 dark:text-zinc-400">{detail}</p>
    </div>
  );
}
