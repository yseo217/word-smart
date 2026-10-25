"use client";

import Link from "next/link";
import { needsBackupReminder, snoozeReminder } from "@/lib/backup";
import { useStore } from "@/lib/use-store";

// Word List 화면의 백업 안내: 단어 50개 초과 + (백업 기록 없음 또는 14일 경과) + 미루지 않음 (PRD 5번 nice)
export default function BackupNotice() {
  const { ready, store, update } = useStore();
  // 현재 시각은 브라우저에서 저장소가 준비된 뒤에만 읽는다 (미리 그리는 단계에서는 쓸 수 없다).
  if (!ready || !needsBackupReminder(store)) return null;

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-amber-400 bg-amber-50 p-4 text-sm text-amber-950 dark:bg-amber-950 dark:text-amber-100" role="status">
      <p>
        You have <span className="font-score text-base">{store.words.length}</span> words and {store.lastBackupAt ? "your last backup is over two weeks old" : "no backup yet"}. A backup
        protects them if the browser clears its data.
      </p>
      <div className="grid grid-cols-2 gap-2">
        <Link href="/backup" className="flex min-h-11 items-center justify-center rounded-lg bg-foreground px-3 font-medium text-background">
          Back up now
        </Link>
        <button
          type="button"
          onClick={() => update((current) => ({ store: snoozeReminder(current), result: null }))}
          className="min-h-11 rounded-lg border border-amber-500 px-3"
        >
          Remind me in 7 days
        </button>
      </div>
    </section>
  );
}
