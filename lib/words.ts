// 단어장 입력 검사 (DESIGN.md 3장)

export const MAX_WORD_LENGTH = 30;

export type WordCheckFailure = {
  ok: false;
  reason: "empty" | "invalid" | "too_long" | "duplicate";
  message: string;
};

export type WordCheck = { ok: true; text: string } | WordCheckFailure;

const ALLOWED = /^[A-Za-z'-]+$/;
const HAS_LETTER = /[A-Za-z]/;

// 앞뒤 공백을 지우고, 스마트폰 키보드가 넣는 둥근 아포스트로피(’)를 곧은 것(')으로 바꾼 뒤 소문자로 만든다.
export function normalizeWord(input: string): string {
  return input.trim().replace(/[‘’ʼ]/g, "'").toLowerCase();
}

// 여러 단어를 한꺼번에 넣을 때 나누는 기준: 줄바꿈, 쉼표, 세미콜론. (띄어쓰기로는 나누지 않는다)
export function splitInput(input: string): string[] {
  return input
    .split(/[\r\n,;]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

// 순서: 공백 제거 → 문자 검사 → 길이 검사 → 중복 검사.
// existing은 이미 단어장에 있는 단어들이다.
export function validateWord(input: string, existing: readonly string[]): WordCheck {
  const text = normalizeWord(input);

  if (text.length === 0) {
    return { ok: false, reason: "empty", message: "Enter a word." };
  }
  if (!ALLOWED.test(text) || !HAS_LETTER.test(text)) {
    return {
      ok: false,
      reason: "invalid",
      message: "Use only English letters, hyphens (-) and apostrophes ('). No digits or spaces.",
    };
  }
  if (text.length > MAX_WORD_LENGTH) {
    return {
      ok: false,
      reason: "too_long",
      message: `Use ${MAX_WORD_LENGTH} characters or fewer.`,
    };
  }
  if (existing.some((w) => w.toLowerCase() === text)) {
    return { ok: false, reason: "duplicate", message: "This word is already in your list." };
  }
  return { ok: true, text };
}
