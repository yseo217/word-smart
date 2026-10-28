# Word Smart

**혼자 쓰는 영어 단어 복습 웹 앱.** 단어장에 넣은 단어를 하루 5회, 회당 3단어씩 실제 기사(VOA Learning English) 예문과 함께 "기억나는지" 묻고, 자주 틀리는 단어는 Still Learning 목록에 모아 더 자주 낸다. 로그인이 없고 학습 기록은 브라우저 안(`localStorage`)에만 둔다.

*A personal English-vocabulary review web app: five 3-word rounds a day, each word shown inside a real VOA Learning English sentence. No account, all learning data stays in the browser.*

- **배포 주소**: https://word-smart.vercel.app (스마트폰에서 홈 화면에 추가하면 앱처럼 열린다)
- **심사·기획 자료**: [`PRD.md`](PRD.md)(기획서, 최상위 기준) · [`PLAN.md`](PLAN.md)(계획서, 작업 목록) · [`DESIGN.md`](DESIGN.md)(설계) · [`CHECK.md`](CHECK.md)(점검) · [`CLAUDE.md`](CLAUDE.md)(작업 규칙)

## 무엇을 하는 앱인가

| 화면 | 하는 일 |
|---|---|
| **Today** | 오늘 끝낸 회차 N/5, 오늘 결과(Knew it N · Looked up N), 연속 복습 일수, 복습 시작 버튼, 알림 켜기/끄기 |
| **Review** | 단어 하나와 예문(묻는 단어 강조, 출처 표시) → "I know it" / "Look it up"(구글 검색 새 탭). 3단어를 마치면 회차 요약 |
| **Word List** | 영어 단어 등록(여러 개 한꺼번에, 중복·잘못된 입력은 건너뛰고 알려줌), 알파벳 순 목록, 검색, 상태 필터, 발음 듣기, 삭제, 백업 링크 |
| **Still Learning** | "Look it up"을 누적 3번 누른 단어 목록. 연속 3번 "I know it"이면 자동으로 빠진다. 통계 링크 |
| **Stats** | 이번 주 회차 수, 최근 4주 복습한 날, 기억률(Knew it %), 예문 제공률 |
| **Backup** | 학습 데이터 파일로 내보내기(아이폰은 공유 시트)·가져오기, 전체 초기화 |

**예문 규칙**: VOA 문장 모음(퍼블릭 도메인, 통신사 기사 제외) → 없으면 Free Dictionary API → 그래도 없으면 "No example". 예문을 지어내지 않는다. 예문의 수준이 묻는 단어의 수준을 넘지 않도록 단어 빈도 목록으로 거른다.

**알림**: 한국 시간 9·11·13·17·19시에 "Time for Nth round" 푸시 알림(웹 푸시, 아이폰은 홈 화면에 추가한 뒤 켤 수 있다).

## 기술

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · 배포는 Vercel. 푸시 알림에는 `web-push`, 구독 저장에 Vercel Blob, 정해진 시각 호출에 cron-job.org를 쓴다. 테스트는 `node:test`로 순수 로직(`lib/*.test.ts`) 117개.

## 직접 돌려 보기

```bash
npm install
npm run dev     # http://localhost:3000
npm test        # 단위 테스트
npm run lint    # ESLint
npm run build   # 프로덕션 빌드
```

알림 기능까지 쓰려면 `.env`에 `NEXT_PUBLIC_VAPID_PUBLIC_KEY`·`VAPID_PRIVATE_KEY`·`VAPID_SUBJECT`·`PUSH_CRON_SECRET`이 필요하다(값은 저장소에 없다. 만드는 법은 `DESIGN.md` 13장). 예문 기능은 API 키가 필요 없다.

데이터 파일을 다시 만드는 스크립트(개발 컴퓨터에서만 실행):

```bash
node scripts/build-voa-corpus.mjs --limit 300        # VOA 문장 모음
node scripts/build-word-freq.mjs <en_50k.txt 경로>   # 단어 빈도 목록
node scripts/make-icons.mjs                          # PWA 아이콘
```

## 데이터와 개인정보

- 단어장과 학습 기록은 브라우저 `localStorage`(`wordsmart:v1`)에만 저장된다. 서버로 가는 것은 예문 검색용 영어 단어 한 개와, 알림을 켰을 때의 푸시 구독 정보뿐이다.
- 개인정보(이름·이메일 등)를 받는 칸이 없다.

## 자료 출처

- VOA Learning English 기사 문장 (`data/voa-sentences.json`): 퍼블릭 도메인. 통신사(AP·Reuters·AFP) 기사는 제외.
- Free Dictionary API 예문: CC BY-SA 3.0 (Wiktionary).
- 단어 빈도 목록 (`data/word-freq.json`): hermitdave/FrequencyWords의 OpenSubtitles 2018 영어 목록 상위 20,000단어, CC BY-SA 4.0. 출처 정보는 `data/word-freq.meta.json`.
- 아이콘 글꼴 (`scripts/fonts/PlayfairDisplay-Black.ttf`): Playfair Display, SIL Open Font License 1.1 (`scripts/fonts/OFL.txt`). 아이콘의 W 글자를 그릴 때만 쓴다.
