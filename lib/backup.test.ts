import { test } from "node:test";
import assert from "node:assert/strict";
import { backupFileName, makeBackup, markBackedUp, needsBackupReminder, parseBackup, snoozeReminder } from "./backup.ts";
import { addWords, emptyStore, type Store } from "./store.ts";

const NOW = new Date("2026-10-25T03:00:00.000Z"); // KST 12:00

// 단어장 규칙이 숫자를 거부하므로 글자로만 단어를 만든다: wa, wb, …, wz, waa, …
function withWords(n: number): Store {
  const letters = (i: number) => {
    let s = "";
    let k = i;
    do {
      s = String.fromCharCode(97 + (k % 26)) + s;
      k = Math.floor(k / 26) - 1;
    } while (k >= 0);
    return s;
  };
  const inputs = Array.from({ length: n }, (_, i) => `w${letters(i)}`);
  return addWords(emptyStore(), inputs.join("\n"), NOW).store;
}

test("makeBackup wraps the store with app, version and time; parseBackup reads it back", () => {
  const store = withWords(3);
  const file = makeBackup(store, NOW);
  assert.equal(file.app, "word-smart");
  assert.equal(file.version, 1);
  assert.equal(file.exportedAt, NOW.toISOString());
  assert.equal(file.data.lastBackupAt, NOW.toISOString()); // 파일 속 저장본은 이번 백업 시각을 갖는다 (가져온 뒤 안내가 바로 뜨지 않도록)
  assert.equal(store.lastBackupAt, undefined); // 원본은 바꾸지 않는다
  const r = parseBackup(JSON.stringify(file));
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.deepEqual(
      r.store.words.map((w) => w.text),
      ["wa", "wb", "wc"],
    );
    assert.equal(r.exportedAt, NOW.toISOString());
  }
});

test("backupFileName carries the KST date", () => {
  assert.equal(backupFileName(NOW), "word-smart-backup-2026-10-25.json");
  assert.equal(backupFileName(new Date("2026-10-25T15:30:00.000Z")), "word-smart-backup-2026-10-26.json");
});

test("parseBackup rejects files that are not from this app", () => {
  assert.equal(parseBackup("not json").ok, false);
  assert.equal(parseBackup("{}").ok, false);
  assert.equal(parseBackup(JSON.stringify({ app: "other", version: 1, data: {} })).ok, false);
  const r = parseBackup("[]");
  assert.equal(r.ok === false && r.reason, "not_this_app");
});

test("parseBackup rejects a file whose data is missing or not an object (would wipe the store)", () => {
  for (const data of [undefined, null, "x", 3, []]) {
    const r = parseBackup(JSON.stringify({ app: "word-smart", version: 1, exportedAt: NOW.toISOString(), data }));
    assert.equal(r.ok === false && r.reason, "unreadable", `data=${JSON.stringify(data)}`);
  }
});

test("parseBackup rejects a newer version but accepts an older one", () => {
  const newer = parseBackup(JSON.stringify({ app: "word-smart", version: 2, data: emptyStore() }));
  assert.equal(newer.ok === false && newer.reason, "newer_version");
  const older = parseBackup(JSON.stringify({ app: "word-smart", version: 0, data: emptyStore() }));
  assert.equal(older.ok, true);
});

test("parseBackup rejects unreadable contents", () => {
  const r = parseBackup(JSON.stringify({ app: "word-smart", version: 1, data: { version: 1 } }));
  assert.equal(r.ok === false && r.reason, "unreadable");
});

test("reminder: only above 50 words, and only when no backup or an old one", () => {
  assert.equal(needsBackupReminder(withWords(50), NOW), false);
  const many = withWords(51);
  assert.equal(needsBackupReminder(many, NOW), true); // 백업 기록 없음
  const fresh = markBackedUp(many, NOW);
  assert.equal(needsBackupReminder(fresh, NOW), false);
  const later = new Date(NOW.getTime() + 15 * 24 * 60 * 60 * 1000);
  assert.equal(needsBackupReminder(fresh, later), true); // 14일 경과
  assert.equal(needsBackupReminder(fresh, new Date(NOW.getTime() + 13 * 24 * 60 * 60 * 1000)), false);
});

test("snoozing hides the reminder for 7 days; backing up clears the snooze", () => {
  const many = withWords(51);
  const snoozed = snoozeReminder(many, NOW);
  assert.equal(needsBackupReminder(snoozed, NOW), false);
  assert.equal(needsBackupReminder(snoozed, new Date(NOW.getTime() + 6 * 24 * 60 * 60 * 1000)), false);
  assert.equal(needsBackupReminder(snoozed, new Date(NOW.getTime() + 8 * 24 * 60 * 60 * 1000)), true);
  assert.equal(markBackedUp(snoozed, NOW).backupSnoozedUntil, undefined);
});
