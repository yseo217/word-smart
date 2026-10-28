"use client";

import { useRef, useState } from "react";
import { backupFileName, daysAgoText, daysSinceBackup, makeBackup, markBackedUp, parseBackup } from "@/lib/backup";
import { useStore } from "@/lib/use-store";
import { turnOffPushOnThisDevice } from "../push-client";

type Notice = { kind: "ok" | "error"; text: string } | null;

// 백업 화면: 내보내기(공유 시트 또는 다운로드), 가져오기(검증 → 확인 → 덮어쓰기), 전체 초기화 (PRD 5번 nice)
export default function BackupPage() {
  const { ready, store, update, replace, reset } = useStore();
  const [notice, setNotice] = useState<Notice>(null);
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const lastBackup = store.lastBackupAt ? new Date(store.lastBackupAt) : null;

  async function handleExport() {
    setBusy(true);
    setNotice(null);
    try {
      const now = new Date();
      const json = JSON.stringify(makeBackup(store, now), null, 2);
      const name = backupFileName(now);
      const file = new File([json], name, { type: "application/json" });

      // 아이폰처럼 파일을 공유 시트로 보낼 수 있으면 그쪽을, 아니면 파일 다운로드.
      const canShare = typeof navigator.share === "function" && typeof navigator.canShare === "function" && navigator.canShare({ files: [file] });
      if (canShare) {
        try {
          await navigator.share({ files: [file], title: "Word Smart backup" });
        } catch (e) {
          if ((e as { name?: string }).name === "AbortError") return; // 사용자가 공유를 취소함
          downloadFile(file); // 공유에 실패하면 다운로드로
        }
      } else {
        downloadFile(file);
      }
      update((current) => ({ store: markBackedUp(current, now), result: null }));
      setNotice({ kind: "ok", text: `Backup saved as ${name} (${store.words.length} words).` });
    } finally {
      setBusy(false);
    }
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // 같은 파일을 다시 고를 수 있게
    if (!file) return;
    setNotice(null);
    const parsed = parseBackup(await file.text());
    if (!parsed.ok) {
      setNotice({ kind: "error", text: parsed.message });
      return;
    }
    const words = parsed.store.words.length;
    const when = parsed.exportedAt ? new Date(parsed.exportedAt).toLocaleString("en-US") : "unknown time";
    const sure = window.confirm(
      `Replace everything on this device with the backup?\n\nBackup: ${words} words, exported ${when}.\nYour current ${store.words.length} words and all history will be deleted.`,
    );
    if (!sure) return;
    const saved = replace(parsed.store);
    setNotice({
      kind: saved ? "ok" : "error",
      text: saved
        ? `Imported ${words} words. Today's progress now follows the backup too.`
        : "Imported, but this browser blocks saving: the data will last only while this tab is open.",
    });
  }

  async function handleReset() {
    const first = window.confirm("Delete ALL Word Smart data on this device?\nWords, history, Still Learning, progress and reminders will be gone. Back up first if you want to keep them.");
    if (!first) return;
    const typed = window.prompt("To confirm, type DELETE in capital letters.");
    if (typed !== "DELETE") {
      setNotice({ kind: "error", text: "Not deleted. You did not type DELETE." });
      return;
    }
    // 알림 구독도 "새로 시작한 것과 같은 상태"에 포함한다 (PRD 5번 nice). 서버·브라우저 구독을 지운 뒤 저장소를 비운다.
    let pushOff = true;
    try {
      await turnOffPushOnThisDevice();
    } catch {
      pushOff = false;
    }
    reset();
    setNotice({
      kind: pushOff ? "ok" : "error",
      text: pushOff ? "All data deleted. The app is back to a fresh start." : "Data deleted, but reminders could not be turned off. Turn them off from Today.",
    });
  }

  const primary = "flex min-h-12 items-center justify-center rounded-lg bg-foreground px-4 text-base font-medium text-background disabled:opacity-50";
  const secondary = "flex min-h-12 items-center justify-center rounded-lg border border-zinc-300 px-4 text-base dark:border-zinc-700";
  const card = "flex flex-col gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800";

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-4 py-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Backup</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Your words and history live only in this browser. Export a backup now and then, and use it to move to another device or address.
        </p>
      </header>

      {notice && (
        <p role="status" className={`rounded-lg p-3 text-sm ${notice.kind === "error" ? "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300" : "bg-green-50 text-green-800 dark:bg-green-950 dark:text-green-300"}`}>
          {notice.text}
        </p>
      )}

      <section className={card} aria-labelledby="export-title">
        <h2 id="export-title" className="font-medium">
          Export
        </h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {ready ? (
            <>
              <span className="font-score text-base text-foreground">{store.words.length}</span> words ·{" "}
              {/* 며칠 전인지 먼저, 날짜는 괄호에 (2026-10-28 UX 개선). 현재 시각은 ready일 때만 읽는다 */}
              {lastBackup && store.lastBackupAt
                ? `last backup ${daysAgoText(daysSinceBackup(store.lastBackupAt))} (${lastBackup.toLocaleDateString("en-US")})`
                : "never backed up"}
            </>
          ) : (
            "Loading…"
          )}
        </p>
        <button type="button" onClick={handleExport} disabled={!ready || busy || store.words.length === 0} className={primary}>
          Export backup
        </button>
        <p className="text-xs text-zinc-600 dark:text-zinc-400">On iPhone this opens the share sheet (save to Files, mail it, …). Elsewhere it downloads a .json file.</p>
      </section>

      <section className={card} aria-labelledby="import-title">
        <h2 id="import-title" className="font-medium">
          Import
        </h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">Replaces everything on this device with the backup, including today&apos;s progress. You will be asked to confirm.</p>
        <input ref={fileInput} type="file" accept="application/json,.json" onChange={handleImport} className="sr-only" aria-label="Choose a backup file" />
        <button type="button" onClick={() => fileInput.current?.click()} disabled={!ready} className={secondary}>
          Choose backup file…
        </button>
      </section>

      <section className={`${card} border-red-200 dark:border-red-900`} aria-labelledby="reset-title">
        <h2 id="reset-title" className="font-medium text-red-700 dark:text-red-400">
          Delete all data
        </h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">Removes words, history, Still Learning, progress and backup dates from this device. Export a backup first.</p>
        <button type="button" onClick={handleReset} disabled={!ready} className="min-h-12 rounded-lg border border-red-300 px-4 text-base text-red-700 dark:border-red-800 dark:text-red-400">
          Delete all data…
        </button>
      </section>
    </main>
  );
}

function downloadFile(file: File) {
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
