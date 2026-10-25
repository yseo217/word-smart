// 한국 시간(KST, UTC+9) 기준 날짜. 한국은 서머타임이 없어서 9시간을 더하면 된다.
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

// 예: 2026-10-25
export function kstDate(d: Date = new Date()): string {
  return new Date(d.getTime() + KST_OFFSET_MS).toISOString().slice(0, 10);
}

// n일 전(또는 n<0이면 뒤)의 KST 날짜
export function kstDateDaysAgo(d: Date, n: number): string {
  return kstDate(new Date(d.getTime() - n * 24 * 60 * 60 * 1000));
}

// 그 날이 속한 주의 월요일 날짜 (주는 월~일, PRD 3번)
export function kstWeekStart(d: Date = new Date()): string {
  const shifted = new Date(d.getTime() + KST_OFFSET_MS);
  const weekday = shifted.getUTCDay(); // 0=일 … 6=토
  const sinceMonday = (weekday + 6) % 7;
  return kstDateDaysAgo(d, sinceMonday);
}
