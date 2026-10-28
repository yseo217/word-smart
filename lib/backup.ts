// 백업 파일 만들기·읽기와 백업 안내 조건 (PRD 5번 nice, DESIGN.md 8장). 브라우저 API는 쓰지 않는다.
import { kstDate } from "./kst.ts";
import { parseStore, type Store } from "./store.ts";

export const BACKUP_APP = "word-smart";
export const BACKUP_VERSION = 1;
export const REMINDER_MIN_WORDS = 50;
export const REMINDER_AFTER_DAYS = 14;
export const SNOOZE_DAYS = 7;

export type BackupFile = { app: typeof BACKUP_APP; version: number; exportedAt: string; data: Store };

// 파일 안의 저장본에는 이번 내보내기 시각을 마지막 백업 시각으로 넣는다. 그래야 다른 주소에서 가져온 직후 백업 안내가 바로 뜨지 않는다.
export function makeBackup(store: Store, now: Date = new Date()): BackupFile {
  return { app: BACKUP_APP, version: BACKUP_VERSION, exportedAt: now.toISOString(), data: markBackedUp(store, now) };
}

// 마지막 백업이 며칠 전인지, 한국 시간 날짜 기준 (2026-10-28 UX 개선). 오늘이면 0, 어제면 1.
export function daysSinceBackup(lastBackupAt: string, now: Date = new Date()): number {
  const day = (iso: string) => Date.UTC(...(kstDate(new Date(iso)).split("-").map(Number) as [number, number, number]).map((n, i) => (i === 1 ? n - 1 : n)) as [number, number, number]);
  return Math.max(0, Math.round((day(now.toISOString()) - day(lastBackupAt)) / (24 * 60 * 60 * 1000)));
}

// 화면 문구: "today", "yesterday", "N days ago"
export function daysAgoText(days: number): string {
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  return `${days} days ago`;
}

export function backupFileName(now: Date = new Date()): string {
  return `word-smart-backup-${kstDate(now)}.json`;
}

export type ParseBackupResult =
  | { ok: true; store: Store; exportedAt: string }
  | { ok: false; reason: "not_json" | "not_this_app" | "newer_version" | "unreadable"; message: string };

// 파일 내용(글자)을 읽어 저장본으로 바꾼다. 이 앱의 형식이 아니거나 앱보다 새 버전이면 거부한다.
// 옛 버전은 현재 형식으로 변환해 받아들인다 (지금은 버전 1뿐이라 변환할 것이 없다).
export function parseBackup(text: string): ParseBackupResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, reason: "not_json", message: "This file is not a Word Smart backup (it is not valid JSON)." };
  }
  if (typeof raw !== "object" || raw === null || (raw as { app?: unknown }).app !== BACKUP_APP) {
    return { ok: false, reason: "not_this_app", message: "This file was not made by Word Smart." };
  }
  const file = raw as { version?: unknown; exportedAt?: unknown; data?: unknown };
  const version = typeof file.version === "number" ? file.version : 0;
  if (version > BACKUP_VERSION) {
    return {
      ok: false,
      reason: "newer_version",
      message: `This backup was made by a newer version of Word Smart (file version ${version}). Update the app first.`,
    };
  }
  const data = migrate(file.data, version);
  // data가 아예 없거나 객체가 아니면(손으로 고친 파일 등) "빈 단어장"으로 통과시키지 않고 거부한다. 덮어쓰면 데이터를 잃기 때문이다.
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    return { ok: false, reason: "unreadable", message: "The backup's contents could not be read." };
  }
  const { store, corrupt } = parseStore(JSON.stringify(data));
  if (corrupt) {
    return { ok: false, reason: "unreadable", message: "The backup's contents could not be read." };
  }
  return { ok: true, store, exportedAt: typeof file.exportedAt === "string" ? file.exportedAt : "" };
}

// 옛 버전 파일을 현재 형식으로 바꾸는 자리. 버전이 올라갈 때 여기에 단계별 변환을 더한다.
function migrate(data: unknown, fromVersion: number): unknown {
  void fromVersion;
  return data;
}

const DAY_MS = 24 * 60 * 60 * 1000;

// Word List 화면의 백업 안내를 보여줄지: 단어 50개 초과 + (백업 기록 없음 또는 14일 경과) + 미룸 기간 아님
export function needsBackupReminder(store: Store, now: Date = new Date()): boolean {
  if (store.words.length <= REMINDER_MIN_WORDS) return false;
  if (store.backupSnoozedUntil && new Date(store.backupSnoozedUntil).getTime() > now.getTime()) return false;
  if (!store.lastBackupAt) return true;
  return now.getTime() - new Date(store.lastBackupAt).getTime() > REMINDER_AFTER_DAYS * DAY_MS;
}

export function markBackedUp(store: Store, now: Date = new Date()): Store {
  return { ...store, lastBackupAt: now.toISOString(), backupSnoozedUntil: undefined };
}

export function snoozeReminder(store: Store, now: Date = new Date()): Store {
  return { ...store, backupSnoozedUntil: new Date(now.getTime() + SNOOZE_DAYS * DAY_MS).toISOString() };
}
