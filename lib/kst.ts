// 한국 시간(KST, UTC+9) 기준 날짜. 한국은 서머타임이 없어서 9시간을 더하면 된다.
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

// 예: 2026-10-25
export function kstDate(d: Date = new Date()): string {
  return new Date(d.getTime() + KST_OFFSET_MS).toISOString().slice(0, 10);
}
