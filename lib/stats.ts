// 통계 화면의 네 지표 (PRD 5번 nice, 3번 성공 기준). 브라우저 API는 쓰지 않는다.
import { kstDate, kstDateDaysAgo, kstWeekStart } from "./kst.ts";
import type { Store } from "./store.ts";

export const EXAMPLE_WINDOW = 100; // 예문 제공률: 예문 정보가 있는 최근 응답 100건
export const EXAMPLE_MIN_SAMPLE = 20; // 20건 미만이면 "아직 데이터 부족"
export const ACTIVE_DAYS_WINDOW = 28; // 최근 4주

// 끝낸 회차들의 날짜 목록. 오늘 횟수는 progress.completed가 더 정확할 수 있어(회차 기록을 남기기 전 데이터) 큰 쪽을 쓴다.
function roundDates(store: Store, now: Date): string[] {
  const today = kstDate(now);
  const recorded = (store.rounds ?? []).map((r) => r.date);
  const recordedToday = recorded.filter((d) => d === today).length;
  const todayCount = store.progress.date === today ? store.progress.completed : 0;
  const missingToday = Math.max(0, todayCount - recordedToday);
  return [...recorded, ...Array.from({ length: missingToday }, () => today)];
}

// 이번 주(월~일)에 끝낸 회차 수
export function roundsThisWeek(store: Store, now: Date = new Date()): number {
  const start = kstWeekStart(now);
  const today = kstDate(now);
  return roundDates(store, now).filter((d) => d >= start && d <= today).length;
}

// 최근 4주(오늘 포함 28일) 중 회차를 1회 이상 끝낸 날 수
export function activeDaysLast4Weeks(store: Store, now: Date = new Date()): number {
  const from = kstDateDaysAgo(now, ACTIVE_DAYS_WINDOW - 1);
  const today = kstDate(now);
  return new Set(roundDates(store, now).filter((d) => d >= from && d <= today)).size;
}

// 기억률: 처음 응답이 "모른다"였던 단어 중 가장 최근 응답이 "안다"인 단어의 비율 (대상이 없으면 null)
export function retention(store: Store): { known: number; total: number; rate: number | null } {
  const target = store.words.filter((w) => w.firstAnswer === "unknown");
  const known = target.filter((w) => w.lastAnswer === "known").length;
  return { known, total: target.length, rate: target.length === 0 ? null : known / target.length };
}

// 예문 제공률: 예문 정보가 기록된 최근 100건 중 예문이 있었던 비율 (20건 미만이면 null)
export function exampleRate(store: Store): { withExample: number; sample: number; rate: number | null } {
  const recent = store.logs.filter((l) => l.example !== undefined).slice(-EXAMPLE_WINDOW);
  const withExample = recent.filter((l) => l.example !== "none").length;
  return { withExample, sample: recent.length, rate: recent.length < EXAMPLE_MIN_SAMPLE ? null : withExample / recent.length };
}

// 앱을 처음 쓴 날부터 며칠째인지 (첫 사용일이 없으면 null)
export function daysSinceFirstUse(store: Store, now: Date = new Date()): number | null {
  if (!store.firstUsedAt) return null;
  const first = kstDate(new Date(store.firstUsedAt));
  const today = kstDate(now);
  const diff = (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${first}T00:00:00Z`)) / (24 * 60 * 60 * 1000);
  return Math.max(0, Math.round(diff)) + 1;
}

// 오늘(KST) 응답을 "안다"/"모른다"로 센다 (Today 화면의 결과 한 줄, 2026-10-30 UX 개선). 어제 자정 전 응답은 세지 않는다.
export function todayAnswers(store: Store, now: Date = new Date()): { known: number; unknown: number } {
  const today = kstDate(now);
  let known = 0;
  let unknown = 0;
  for (const log of store.logs) {
    if (kstDate(new Date(log.at)) !== today) continue;
    if (log.answer === "known") known++;
    else unknown++;
  }
  return { known, unknown };
}

// 연속 복습 일수 (Today 화면, 2026-10-30 UX 개선): 회차를 1회 이상 끝낸 날이 끊기지 않고 며칠 이어졌는지.
// 오늘 아직 안 했으면 어제부터 거꾸로 센다 (오늘 하면 이어진다는 뜻). 어제도 없으면 0.
export function streakDays(store: Store, now: Date = new Date()): number {
  const days = new Set(roundDates(store, now));
  let n = 0;
  let back = days.has(kstDate(now)) ? 0 : 1;
  while (days.has(kstDateDaysAgo(now, back))) {
    n++;
    back++;
  }
  return n;
}
