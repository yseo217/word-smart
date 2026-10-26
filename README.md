# Word Smart

혼자 쓰는 영어 단어 복습 웹 앱. 단어장에 넣은 단어를 하루 5회, 회당 3단어씩 VOA Learning English 예문과 함께 묻는다. 학습 기록은 브라우저 `localStorage`에만 둔다.

- 기획: `PRD.md` (최상위 기준) · 계획: `PLAN.md` · 설계: `DESIGN.md` · 작업 규칙: `CLAUDE.md`
- 기술: Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · 배포는 Vercel

## 명령

```bash
npm run dev     # 개발 서버 http://localhost:3000
npm test        # 단위 테스트 (node --test, lib/*.test.ts)
npm run lint    # ESLint
npm run build   # 프로덕션 빌드
node scripts/build-voa-corpus.mjs --limit 300        # VOA 문장 모음 다시 만들기
node scripts/build-word-freq.mjs <en_50k.txt 경로>   # 단어 빈도 목록 다시 만들기
node scripts/make-icons.mjs                          # PWA 아이콘 다시 만들기
```

## 자료 출처

- VOA Learning English 기사 문장 (`data/voa-sentences.json`): 퍼블릭 도메인. 통신사(AP·Reuters·AFP) 기사는 제외.
- Free Dictionary API 예문: CC BY-SA 3.0 (Wiktionary).
- 단어 빈도 목록 (`data/word-freq.json`): hermitdave/FrequencyWords의 OpenSubtitles 2018 영어 목록 상위 20,000단어, CC BY-SA 4.0. 출처 정보는 `data/word-freq.meta.json`.
- 아이콘 글꼴 (`scripts/fonts/PlayfairDisplay-Black.ttf`): Playfair Display, SIL Open Font License 1.1 (`scripts/fonts/OFL.txt`). 아이콘의 W 글자를 그릴 때만 쓴다.
