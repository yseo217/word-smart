# Word Smart 설계 문서

> **한 줄 요약**: 폰 브라우저에서 하루 5회, 3단어씩 VOA 예문과 함께 묻는 단어 복습 앱을 Next.js 하나로 만든다. 학습 데이터는 기기 안에만 둔다.
>
> **프로젝트**: word-smart 0.1.0 · **작성자**: Iron man · **작성일**: 2026-10-25 · **상태**: 구현 반영 중 (10번 "아직 정하지 못한 것" 참고)
> **근거 문서**: `PRD.md`(기획, 최상위 기준) · `PLAN.md`(계획, 작업 순서) · `CLAUDE.md`(작업 규칙). 기획서와 어긋나면 기획서가 우선이다.

## Context Anchor

> `PLAN.md`에서 가져옴. 설계·구현 중에 "왜 만드는지"를 잃지 않기 위한 요약.

| Key | Value |
|---|---|
| **WHY** | 적어 둔 단어를 실제로 기억하는지 확인할 수단이 없어 잊어버린다 |
| **WHO** | 본인 한 명, 로그인 없이 스마트폰 브라우저에서 사용 |
| **RISK** | 브라우저가 저장 데이터를 지우면 단어장이 사라진다 → 백업 기능과 안내로 대비 |
| **SUCCESS** | 4주 뒤 기억률 70%, 매주 회차 20회 이상(하루 4회 × 5일), 예문 제공률 60% |
| **SCOPE** | must(단어장·복습·예문) 완료 → nice(Still Learning·통계·발음·백업) 완료, 빈도 목록·수준 조정 완료 → 배포·푸시 알림 설정(코드 완료, 배포 뒤 설정 남음)·폰 확인·모음 확대·예외 점검 |

## 0. 설계 개요

### 0.1 설계 목표와 원칙

- **서버 없이 돌아가는 앱**: 학습 기록은 브라우저 `localStorage`에만 두고, 서버는 예문 하나를 찾아 주는 일과, 알림을 켰을 때 그 기기의 푸시 구독 정보를 보관해 정해진 시각에 알림을 보내는 일(13장)만 한다. 계정·DB·로그인이 없다.
- **순수 로직과 화면의 분리**: 규칙(단어 검사, 회차, 어려운 단어, 예문 고르기, 통계)은 `lib/`에 브라우저와 무관한 함수로 두고 `node:test`로 검증한다. 화면(`app/`)은 그 함수를 부르기만 한다.
- **출처를 갈아 끼울 수 있는 예문**: 예문 출처 순서(VOA 모음 → 사전 → 없음)는 `lib/examples.ts` 한 곳에만 있다.
- **한 번에 한 가지 결정**: 숫자(가중치, 상한, 기간)는 확정값인지 제안값인지 구분해 적고(수준 규칙의 숫자는 6.6), 코드에는 상수로 둔다.

### 0.2 화면 구성 — 무엇이 어디에 보이는가

모든 화면은 같은 틀 안에 있다. 폰 세로 화면(가로 375px) 기준.

```
┌──────────────────────────────┐
│        WORD SMART (네이비 띠)  │  ← app/layout.tsx 의 .band
├──────────────────────────────┤
│  제목                [링크]   │  ← 화면마다: Word List→Backup, Still Learning→Stats
│                              │
│  (화면 내용: 흰 패널)          │  ← <main>, 아래는 탭 바 높이만큼 비워 둠
│                              │
├──────────────────────────────┤
│  N/5    A–Z        12        │  ← app/tab-bar.tsx (fixed, safe-area 여백). Still Learning 탭의 숫자는 쌓인 단어 수
│ Today  Word List  Still L.   │
└──────────────────────────────┘
```

| 탭 / 주소 | 위에서 아래로 보이는 것 | 파일 |
|---|---|---|
| **Today** `/` | 제목 "Today" · 설명 한 줄 · 카드[오늘 횟수 N/5, 버튼: Start review / Continue review / Done for today. 단어장이 비어 있으면 "Add words first" 안내와 Word List 링크] · 알림 띠[제목·시각 없이 한 줄(2026-10-26 사용자 요청): 종 아이콘(켜지면 네이비) + 상태 글 + 알약 버튼. 끈 상태 "Get a nudge five times a day." + Turn on reminders / 켠 상태 "On for this device." + Send a test·Turn off / 홈 화면 추가 안내 / 차단 안내 / 미지원 안내 / 서버 설정 전 안내. 켜거나 끈 직후 안내 한 줄] (13장) | `app/page.tsx`, `app/today-progress.tsx` |
| **복습** `/review` (Today 탭에 속함) | 제목 "Review"와 오른쪽 "Today N/5" · "k / 3" · 단어(크게) + 스피커 버튼, 단어 아래 이력 한 줄("New word" / "Remembered N in a row" 녹색 / "Looked up N times" 빨간색 / "Still learning · looked up N times" 황색, 2026-10-29 UX 개선) · 예문 카드[앞문장 흐리게, 문장(단어 강조), 뒷문장, 출처·라이선스, Another example] · "Does it ring a bell?" · 버튼 2개 [I remember / Look it up] · 안내 두 줄. Look it up 뒤에는 버튼이 [Open Google / Next]로 바뀜. 회차 끝: 요약 카드[Round complete!, N/5, (어제로 계산됨), 이 회차의 단어 3개와 결과(Remembered 녹색 / Looked up 빨간색, 2026-10-28 UX 개선), Still Learning 추가·제외, One more round / Home] | `app/review/page.tsx`, `example-card.tsx`, `speak-button.tsx`, `example-cache.ts` |
| **Word List** `/words` | 제목 "Word list"와 오른쪽 [Backup] · (조건부) 백업 안내 카드[Back up now / Remind me in 7 days] · 여러 줄 입력칸 · 안내(입력 중에는 "N will be skipped" 미리 보기) · [Add N words](입력 중 추가될 수를 버튼에 미리 표시, 2026-10-29 UX 개선) · 결과 안내와 건너뛴 목록(10개까지) · "Your words N"과 검색 칸 · 상태 필터 알약 버튼 All / Still learning(개수, 황색) / Looked up(개수, 빨간색) / Remembered(개수, 녹색) — 네 개가 375px에서 한 줄, 누른 단추는 그 색으로 채움, 검색과 함께 적용, 2026-10-29 UX 개선(Remembered 단추와 색은 2026-10-30 추가) · 알파벳 순 목록(각 줄: 단어와 그 오른쪽 위 작은 윗첨자 상태 글자 "Still learning"(황색) / "Remembered"(녹색) / "Looked up"(빨간색) — 아직 안 물은 단어는 비움, 상태색은 Tailwind 기본색, 2026-10-28 UX 개선. 2026-10-29에 아래 줄에서 윗첨자로 옮겨 한 줄로 —, Delete) | `app/words/page.tsx`, `app/backup-notice.tsx` |
| **Still Learning** `/hard` | 제목과 오른쪽 [Stats] · 설명 · "Still learning N"과 검색 칸 · 최근 순 목록(각 줄: 단어, 누적 횟수·연속 횟수·날짜, Remove) · 비어 있으면 안내와 [Start review] | `app/hard/page.tsx` |
| **Stats** `/stats` | 제목 "Stats" · "Day N" 머리말 · 카드 4장 2×2[Rounds this week / Active days x/28 / Remembered % / Examples shown %], 각각 목표 설명 | `app/stats/page.tsx` |
| **Backup** `/backup` | 제목 · 설명 · 카드[Export: N words, last backup는 "N days ago (날짜)" 꼴(today/yesterday, 한국 시간 날짜 기준, 2026-10-29 UX 개선), 버튼] · 카드[Import: 파일 선택 버튼] · 빨간 테두리 카드[Delete all data…] | `app/backup/page.tsx` |

### 0.3 데이터 흐름 — 입력 → 처리 → 출력

```
① 단어 등록
   입력칸 글자 ─▶ splitInput(줄바꿈·쉼표·세미콜론으로 나눔) ─▶ validateWord(글자·길이·중복) ─▶ addWords
             ─▶ localStorage 저장(use-store.update) ─▶ 목록 갱신 + "Added N / Skipped M" 안내

② 복습 한 단어
   /review 진입 ─▶ startRound(오늘 날짜 KST, 3단어 가중치 뽑기) ─▶ 진행 상태 저장
   화면에 단어 표시 ─┬▶ (동시에) /api/example?word=… 요청 3개 ─▶ 예문 카드
                   └▶ 버튼 ─▶ answerCurrent(안다/모른다, 예문 종류) ─▶ 단어 카운터·Still Learning·응답 기록·회차 기록 갱신 ─▶ 저장
   3번째 응답 ─▶ 회차 완료(오늘 횟수 +1, 자정 넘김이면 어제) ─▶ 요약 화면

③ 예문 (서버)
   단어 ─▶ validateWord(같은 규칙) ─▶ VOA 문장 모음에서 변화형·고유명사 규칙으로 후보 찾기 ─▶ 수준 규칙(목록 없으면 통과)
      ─▶ 있으면: 무작위 1개 + 앞/뒤 문장(300자 이내) ─▶ {sentence, before, after, pattern, source}
      ─▶ 없으면: Free Dictionary API(6초) ─▶ 예문 1문장 ─▶ 그것도 없으면 {ok:false}
   브라우저는 응답을 example-cache에 두고, pattern으로 단어를 굵게·색으로 강조

③-1 "모른다" (Look it up)
   단어 ─▶ 구글 검색 새 탭 (https://www.google.com/search?q=단어+meaning+pronunciation)

④ 통계
   저장본(words, logs, rounds, firstUsedAt) ─▶ stats.ts(주간 횟수, 28일 활동일, 기억률, 예문 제공률) ─▶ 카드 4장 (저장하지 않고 볼 때마다 계산)

⑤ 백업
   내보내기: 저장본 전체 ─▶ makeBackup({app, version, exportedAt, data}) ─▶ 공유 시트 또는 .json 다운로드 ─▶ lastBackupAt 기록
   가져오기: 파일 ─▶ parseBackup(앱 확인·버전·내용 검사) ─▶ 확인 창 ─▶ 저장본 전체 교체
   초기화: 확인 창 ─▶ "DELETE" 입력 ─▶ 이 기기의 알림 구독 해제(⑥ 끄기와 같음) ─▶ 저장소 키 삭제

⑥ 알림 (13장)
   켜기: 알림 띠 ─▶ 브라우저 권한 묻기 ─▶ 서비스 워커(sw.js)로 구독 만들기 ─▶ POST /api/push/subscribe ─▶ 서버 저장소(Vercel Blob)에 구독 정보 저장
   보내기: cron-job.org(한국 시간 9·11·13·17·19시) ─▶ GET /api/push/send + 비밀 값 ─▶ 저장된 구독마다 web-push로 고정 문구 전송 ─▶ 폰의 sw.js가 알림 표시 ─▶ 누르면 /review
   끄기: DELETE /api/push/subscribe ─▶ 브라우저 구독 해제 (app/push-client.ts. 전체 초기화 ⑤도 같은 함수를 부른다)
   시험: "Send a test" ─▶ POST /api/push/test {endpoint} ─▶ 이 기기에만 "Time for a round"(알림 시각이면 Nth round)
```

데이터가 기기 밖으로 나가는 지점은 ③(이 앱의 서버 → 필요하면 사전 API)과 ③-1(구글)이고, 나가는 것은 "영어 단어 한 개"뿐이다. 여기에 ⑥(알림)을 켰을 때만 푸시 구독 정보(기기의 알림 주소와 키 2개)가 이 앱의 서버 저장소(Vercel Blob)로 간다. ①②④⑤는 모두 브라우저 안에서 끝난다. 서버 코드는 단어를 로그에 쓰지 않지만, 주소(`?word=`)에 단어가 들어가므로 Vercel의 기본 요청 로그에는 남을 수 있다(PRD 7번).

### 0.4 기술 선택 — Next.js를 기본으로, 그 위에 쓰는 것

Vercel 배포를 위해 **Next.js 16**을 기본으로 쓴다. 그 위에 실제로 쓰고 있는 기술과, 비개발자 눈높이의 한 줄 설명이다.

| 기술 | 쓰는 곳 | 쉬운 설명 (한 줄) | 상태 |
|---|---|---|---|
| **Next.js 16** (App Router) | 모든 화면과 `/api/example`, `/api/push/*` | 화면과 작은 서버 기능을 한 프로젝트에 넣어 Vercel에 그대로 올릴 수 있게 해 주는 틀 | 사용 중 |
| **React 19** | 화면 구성 | 화면을 "부품"으로 나눠 조립하는 방식. Next.js에 포함됨 | 사용 중 |
| **TypeScript** | 모든 코드 | 코드에 "이 값은 글자, 이건 숫자"를 적어 두어 실수를 미리 잡아 주는 맞춤법 검사기 같은 것 | 사용 중 |
| **Tailwind CSS 4** | 디자인 | 색·여백·글꼴을 클래스 이름으로 바로 붙이는 꾸미기 도구. 핀 스트라이프는 `globals.css` 한 곳에서 정의 | 사용 중 |
| **next/font (Google Fonts)** | 글꼴 | Playfair Display·Inter·Oswald를 빌드 때 받아 두어 매번 구글에 접속하지 않게 하는 기능 | 사용 중 |
| **localStorage** | 단어장·기록 저장 | 브라우저 안의 작은 서랍. 서버 없이 이 기기에만 저장된다 (주소·기기마다 따로) | 사용 중 |
| **Web App Manifest + 아이콘** | 홈 화면 추가 | 폰 홈 화면에 아이콘을 두고 앱처럼 전체 화면으로 열리게 하는 설정 파일 | 사용 중 |
| **Web Speech API** | 발음 듣기 | 브라우저에 이미 들어 있는 "읽어 주기" 기능. 음성 파일을 따로 받지 않는다 | 사용 중 |
| **Web Share API** | 백업 내보내기 | 아이폰의 공유 창(파일·메일로 보내기)을 띄우는 브라우저 기능. 안 되면 다운로드로 대체 | 사용 중 |
| **Free Dictionary API** | 사전 예문 | 키 없이 쓰는 무료 사전 서비스(Wiktionary 기반). 느리거나 오류일 수 있어 6초만 기다린다 | 사용 중 |
| **VOA 문장 모음** (`data/voa-sentences.json`) | 기사 예문 | VOA Learning English 기사를 미리 문장으로 잘라 둔 파일. 퍼블릭 도메인이라 저장해도 된다 | 사용 중 |
| **단어 빈도 목록** (`data/word-freq.json`) | 예문 수준 규칙 | 영어 단어 20,000개가 얼마나 흔한지 순위를 적은 표(OpenSubtitles 자막 기반, CC BY-SA 4.0). 이게 있어서 "예문이 단어보다 어렵지 않게" 규칙이 켜진다 | 사용 중 |
| **node:test** | 단위 테스트 | Node.js에 들어 있는 테스트 도구. 추가 설치 없이 `npm test`로 규칙 115개를 검사 | 사용 중 |
| **ESLint** | 코드 검사 | 흔한 실수와 규칙 위반을 찾아 주는 검사기. `npm run lint` | 사용 중 |
| **opentype.js** (개발용) | 아이콘 만들기 | 글꼴 파일에서 글자의 윤곽선을 읽어 주는 라이브러리. `scripts/make-icons.mjs`만 쓰고 앱에는 들어가지 않는다 | 사용 중 |
| **Vercel** | 배포 | 코드를 올리면 인터넷 주소를 만들어 주는 서비스. Next.js를 만든 회사라 설정이 거의 없다 | 배포 예정 |
| **web-push** | 푸시 알림 보내기 | 브라우저 알림 서비스(애플·구글)에 "이 기기에 이 문구를 띄워 달라"고 서명해서 보내는 라이브러리. 서명 키(VAPID)는 `.env`에 | 사용 중 (13장) |
| **서비스 워커** (`public/sw.js`) | 알림 받기 | 앱이 닫혀 있어도 폰 뒤에서 깨어나 알림을 띄우는 작은 코드. 오프라인 캐시는 하지 않는다 | 사용 중 (13장) |
| **Vercel Blob** | 구독 정보 저장 | Vercel이 주는 작은 파일 저장소. 알림을 받을 기기 주소를 비공개 파일 하나에 둔다(무료 범위) | 배포 설정 예정 (13장) |
| **cron-job.org** | 하루 5번 호출 | 정해진 시각에 주소 하나를 대신 열어 주는 무료 예약 서비스. Vercel 무료 플랜은 하루 1번만 예약돼서 쓴다 | 배포 설정 예정 (13장) |

**추가로 제안하는 기술 (지금은 필요 없음, 나중에 고려)**

| 기술 | 언제 | 쉬운 설명 (한 줄) |
|---|---|---|
| **Playwright** | PLAN 24번 예외 점검 때 | 사람 대신 브라우저를 눌러 보며 화면 흐름을 자동으로 검사하는 도구. 지금은 제가 직접 눌러 확인 |
| **서비스 워커 (오프라인 캐시)** | 폰에서 오프라인 사용이 자주 필요해지면 | 앱 파일을 폰에 복사해 두어 인터넷 없이도 열리게 하는 기능. 지금은 "열어 둔 상태"에서만 오프라인 동작 |

지금 PRD의 기능은 위 "사용 중" 기술만으로 모두 만들 수 있다. 데이터베이스, 로그인 서비스, 결제, 분석 도구는 필요 없다.

### 0.5 화면 체크리스트 (빠짐 검사용)

- **Today**: 오늘 횟수 N/5 · 상태별 버튼 1개(Start review / Continue review / Done for today / Add words first) · 알림 띠(끔: Turn on reminders / 켬: "On for this device." + Send a test·Turn off / 홈 화면 추가 안내 / 차단 안내 / 미지원 안내 / 서버 설정 전 안내) · 켜거나 끈 직후 안내 한 줄
- **Review**: 진행 k/3 · 단어 · 스피커 버튼(지원 시) · 예문 카드(강조·출처·Another example 또는 No more examples·오프라인 문구) · I remember / Look it up · Look it up 뒤 Open Google / Next · 요약(횟수, 어제 계산 안내, 추가·제외 단어, One more round / Home) · 빈 단어장 안내 · 5회 완료 안내
- **Word List**: Backup 링크 · 백업 안내(조건부, 7일 미루기) · 여러 줄 입력 · Add · 결과 안내 · 건너뛴 목록(10개 + and N more) · 검색 · 단어 수 · 알파벳 목록 · Delete(확인 창)
- **Still Learning**: Stats 링크 · 검색 · 개수 · 최근 순 목록(단어·횟수·날짜) · Remove(확인 창) · 빈 상태 안내
- **Stats**: Day N · Rounds this week · Active days x/28 · Remembered % · Examples shown %(데이터 부족 문구)
- **Backup**: 단어 수·마지막 백업 · Export · Import(파일 선택, 확인 창, 결과 안내) · Delete all data(확인 창 + DELETE 입력)

### 0.6 테스트 계획

| 단계 | 대상 | 방법 | 지금 상태 |
|---|---|---|---|
| L0 단위 | `lib/*.ts` 규칙 전부 | `npm test` (node:test, 115개) | 자동 |
| L1 API | `/api/example` 정상·400·없음 · `/api/push/send` 비밀 값 없으면 401, 알림 시각이 아니면 `off_hours`로 안 보냄, 서버 설정 전이면 503 · `/api/push/subscribe` 잘못된 구독 400, 상한 초과 409 · `/api/push/test` 미등록 404, 기기가 구독을 끊었으면 410(목록에서 지움), 푸시 서비스가 거부하면 502, 서버 설정 전 503 | `curl` 또는 브라우저 | 수동 (개발 중 확인) |
| L2 화면 | 0.5 체크리스트 | 내장 브라우저에서 눌러 확인 | 수동 |
| L3 흐름 | 단어 등록 → 복습 3단어 → 요약 → Still Learning → 통계 → 백업 왕복 → 알림 켜고 Send a test 수신 | 폰에서 직접 | PLAN 19~20·24·26번 |

## 1. 한눈에 보기

스마트폰 브라우저에서 쓰는 Next.js 웹 앱이다. 사용자가 **단어장**에 영어 단어를 입력하면, 앱이 하루 최대 5번, 한 번에 3단어씩 **영어 예문**(VOA 기사, 없으면 사전 예문)과 함께 "아는지" 묻는다.

| 구분 | 어디서 처리하나 | 하는 일 |
|---|---|---|
| 화면 | 브라우저 (Next.js 클라이언트 컴포넌트) | 단어장, 복습, 목록, 통계, 백업 화면 |
| 데이터 저장 | 브라우저 `localStorage` | 단어장, 응답 기록, 어려운 단어 목록, 진행 상태 |
| 예문 가져오기 | Next.js 서버 (`/api/example`) | VOA 문장 모음에서 찾기, 없으면 Free Dictionary API 호출 |
| 알림 보내기 | Next.js 서버 (`/api/push/*`) + Vercel Blob + cron-job.org | 구독 정보 보관, 정해진 시각에 고정 문구 알림 (13장) |

핵심 원칙 두 가지는 이렇다.

- **학습 기록은 서버로 보내지 않는다.** 서버로 가는 것은 예문 검색용 영어 단어 하나와, 알림을 켰을 때의 푸시 구독 정보(기기 알림 주소와 키 2개, 13장)뿐이다.
- **기사 전체는 브라우저로 보내지 않는다.** 서버에서 문장을 뽑아 최대 2문장만 내려준다.

## 2. 화면 구성

| 주소 | 화면 | 기획서 근거 |
|---|---|---|
| `/` | 홈(Today 탭): 오늘 복습 횟수 N/5, '복습 시작/이어서 하기/오늘 완료' 버튼, 알림 켜기/끄기 띠(13장) | 5번 ②, 4번, 5번 nice |
| `/words` | **단어장**(Word List 탭): 여러 줄 입력칸, 알파벳 순 목록, 검색, 삭제, Backup 링크, 백업 안내 | 5번 ① |
| `/review` | 복습: 한 화면에 한 단어, 예문, I remember / Look it up, 회차 요약 | 5번 ② |
| `/hard` | 어려운 단어 목록(Still Learning 탭): 보기·검색·삭제, Stats 링크 | nice |
| `/stats` | 통계 4가지 | nice |
| `/backup` | 내보내기·가져오기·전체 초기화 | nice |

- 스마트폰 세로 화면(가로 375px)을 기준으로 만들고, 가로 스크롤이 생기지 않게 한다. (자세한 배치는 0.2)
- **앱 화면의 문구는 모두 영어로 쓴다** (2026-10-25 결정). 문서(PRD, DESIGN)와 코드 주석은 한국어다.
- **디자인은 핀 스트라이프 유니폼 느낌**이다 (2026-10-25 결정): 네이비(`#0c2340`)와 흰색, 바탕에 가는 세로 줄무늬, 상단에 네이비 띠, 글은 흰 패널 위에. 색과 줄무늬는 `app/globals.css` 한 곳에서 정한다. 구단 로고·이름 같은 상표는 쓰지 않는다. 이 규칙의 범위는 네이비·흰색·줄무늬·회색 같은 바탕색이고, 경고(amber)·오류(red)·강조(green) 같은 상태색은 Tailwind 기본색을 화면 코드에서 바로 쓴다(`app/backup-notice.tsx`, `app/review/example-card.tsx`, 단어장·백업 화면의 알림).
- **다크 모드** (PRD 4번): 기기 설정을 따른다. 어두운 색 값은 `app/globals.css`의 `@media (prefers-color-scheme: dark)` 한 곳에서 정하고, 화면 코드는 Tailwind의 `dark:` 클래스만 쓴다. 따로 켜고 끄는 설정은 두지 않는다.
- **글꼴** (2026-10-25 결정, 모두 Google Fonts, `app/layout.tsx`에서 `next/font/google`로 불러옴): 제목·헤더는 **Playfair Display**(복습 화면의 단어 자체는 Inter 그대로)(700·900, 하이컨트라스트 세리프), 본문·버튼·라벨은 **Inter**(없으면 시스템 글꼴), 숫자·스코어·통계는 **Oswald**(500·600, 스코어보드 느낌). Tailwind 클래스는 `font-display`, `font-sans`, `font-score`.
- must는 `/`, `/words`, `/review` 세 화면이고, nice 화면(`/hard`, `/stats`, `/backup`)까지 모두 구현됐다.
- **하단 탭 바** (2026-10-25 결정, `app/tab-bar.tsx`): Today(`/`, 복습 화면 `/review` 포함) · Word List(`/words`) · Still Learning(`/hard`, 어려운 단어 목록) 세 탭. 모든 화면에 고정으로 붙고, 누르면 바로 이동한다. 탭 위 글자는 Today가 오늘 횟수 N/5, Word List가 "A–Z", Still Learning이 **지금 쌓인 단어 수**(2026-10-28 UX 개선. 전에는 "!"였다. 단어장에서 지워진 단어의 항목은 세지 않는다)이다.

**홈 화면 추가(PWA)**: `app/manifest.ts`(이름, 전체화면 `standalone`, 색), `public/icon-192.png`·`icon-512.png`·`apple-touch-icon.png`(`scripts/make-icons.mjs`가 만드는 아이콘: 흰 바탕에 가는 네이비 핀 스트라이프, 가운데 네이비 "W" 한 글자. W는 상단 띠의 "WORD SMART"와 같은 글꼴(Playfair Display 900)의 글자 모양을 `scripts/fonts/PlayfairDisplay-Black.ttf`(SIL OFL 1.1)에서 읽어 그린다. 홈 유니폼 느낌이되 구단 로고·이름은 쓰지 않는다, 2026-10-26 사용자 결정). 같은 스크립트가 안드로이드 알림 배지 `badge-96.png`(투명 배경 W)도 만들며, 글꼴 읽기에는 개발용 라이브러리 opentype.js를 쓴다, 레이아웃의 `appleWebApp`·`viewportFit: cover`. 오프라인 캐시용 서비스 워커는 두지 않고, `public/sw.js`는 푸시 알림만 다룬다(13장). 오프라인이면 예문 카드에 "Offline – examples need an internet connection."을 보여준다.

## 3. 단어장

단어장은 복습과 분리된 독립 화면이며, 모든 단어의 원본 목록이다.

**입력 검사 (순서대로)**
1. 앞뒤 공백을 지운다.
2. 앞뒤 공백을 지우고 둥근 아포스트로피(’ ‘ ʼ)는 곧은 것(')으로 바꾼 뒤 소문자로 만든다(`normalizeWord`). 그다음 영문자, 하이픈(-), 아포스트로피(')만 남아 있는지 본다. 숫자와 중간 공백이 있으면 거부하고, 영문자가 하나도 없는 입력(`-`, `'` 등)도 거부한다.
3. 길이가 1~30자인지 본다.
4. 소문자로 바꾼 값이 이미 있는지 본다. 있으면 저장하지 않고 "이미 단어장에 있는 단어입니다"를 보여준다.
5. 통과하면 저장한다. 저장 순서는 입력 순서이지만, 화면 목록은 알파벳 순으로 정렬해 보여준다 (2026-10-25 결정). 목록 위의 검색 칸에 글자를 넣으면 그 글자가 들어 있는 단어만 바로 걸러 보여준다(저장과 무관한 화면 상태).

**여러 단어를 한꺼번에**: 입력칸은 여러 줄이다. 줄바꿈, 쉼표, 세미콜론으로 나눈 조각마다 위 검사를 차례로 하고, 통과한 것만 입력한 순서대로 목록 맨 위에 추가한다. 같은 입력 안의 중복도 걸러낸다. 건너뛴 조각은 이유와 함께 보여주고 입력칸에 남겨서 바로 고칠 수 있게 한다. 띄어쓰기로는 나누지 않는다(`ice cream`이 조용히 두 단어가 되는 것을 막기 위해). 구현은 `addWords`(`lib/store.ts`), 나누는 함수는 `splitInput`(`lib/words.ts`).

**저장하는 형태**: 단어는 소문자로 바꾼 값(`text`)으로 저장한다. 그래야 `Apple`과 `apple`이 하나로 취급된다.

**삭제**: 단어를 지우면 그 단어의 응답 기록과 어려운 단어 목록 항목도 같이 지운다 (PRD 5번 ①).

## 4. 데이터 모델

모두 `localStorage` 한 키(`wordsmart:v1`)에 JSON으로 저장한다. 읽을 수 없는(깨진) 데이터를 덮어쓸 때는 그 원문을 `wordsmart:v1:corrupt:<시각>` 키에 따로 보관하고, 전체 초기화는 이 사본 키들도 함께 지운다. 읽을 때 `progress.completed`가 숫자가 아니면 0으로 둔다(화면에 "NaN/5"가 나오지 않게, 2026-10-26). 깨진 항목은 버린다(2026-10-27): `logs`·`hard`·`rounds`의 원소는 id·시각·답이 온전한 것만 남기고, 진행 중 회차 `progress.current`는 시각이 맞고, 단어가 하나 이상이며, 답한 수가 단어 수보다 작을 때만 받는다(아니면 없는 것으로 보고 새 회차를 시작한다). 저장이 막힌 브라우저에서는 `useStore().saveFailed`가 참이 되고, 모든 화면 위에 공통 경고(`app/save-warning.tsx`)가 보인다.

```ts
type Answer = "known" | "unknown";

type Word = {
  id: string;            // 고유값
  text: string;          // 소문자로 정리한 단어
  addedAt: string;       // ISO 시각
  lastAnswer?: Answer;   // 가장 최근 응답
  firstAnswer?: Answer;  // 첫 응답 (기억률 계산용)
  missTotal: number;     // "모른다" 누적 횟수
  knownStreak: number;   // 연속 "안다" 횟수
};

type ExampleKind = "voa" | "dictionary" | "none";
type Log = { wordId: string; at: string; answer: Answer; example?: ExampleKind };  // example: 답할 때 예문이 있었는지 (예문 제공률 통계용). 아직 불러오는 중이었으면 비워 둔다(계산에서 빠짐), 못 받았으면 "none"

type HardItem = { wordId: string; savedAt: string };  // 누적 횟수는 Word.missTotal을 본다

type Progress = {
  date: string;          // 한국 시간 기준 YYYY-MM-DD
  completed: number;     // 오늘 끝낸 회차 수 (최대 5)
  current?: {            // 진행 중인 회차
    startedAt: string;
    wordIds: string[];   // 정확히 3개 (단어장이 적으면 그만큼)
    answered: number;    // 몇 번째 단어까지 답했는지
  };
};

type Store = {
  version: 1; words: Word[]; logs: Log[]; hard: HardItem[]; progress: Progress;
  rounds?: { at: string; date: string }[];  // 끝낸 회차 기록 (통계용, date = 시작한 날의 KST 날짜)
  firstUsedAt?: string;  // 앱을 처음 쓴 시각. 처음 저장할 때 use-store가 채운다 (통계의 "Day N" 표시용. 백업을 가져오면 옮겨 오므로 판정 기준일로는 쓰지 않는다, PRD 3번)
  lastBackupAt?: string; backupSnoozedUntil?: string;  // 백업 안내용
};
```

## 5. 복습 동작

### 5.1 회차 시작
1. 한국 시간(KST)으로 오늘 날짜를 구한다. `progress.date`와 다르면 `completed`를 0으로 초기화한다.
2. 진행 중인 회차(`current`)가 있으면 이어서 한다.
3. 단어장이 비어 있으면 '단어를 먼저 등록해 주세요'를 보여준다(단어가 없으면 횟수와 상관없이 복습할 수 없으므로 완료 판정보다 먼저 본다. 2026-10-27 코드 순서에 맞춤).
4. `completed`가 5이면 '오늘 복습 완료'를 보여주고 시작하지 않는다.
5. 아니면 3단어를 뽑아 `current`에 저장한다.

### 5.2 단어 뽑기
- 단어마다 가중치를 준다. `lastAnswer`가 `unknown`이거나 어려운 단어 목록(`hard`)에 있으면 2, 아니면 1 (둘 다여도 2).
- 가중치에 따른 무작위로 하나를 뽑고, 뽑힌 단어는 빼고 다시 뽑는다. 이걸 3번 하면 한 회차에 같은 단어가 두 번 나오지 않는다.
- 단어가 3개보다 적으면 있는 만큼만 뽑는다.

### 5.3 응답 처리
응답은 누를 때마다 바로 저장한다. 3번째까지 답하면 `completed`를 1 올리고 `current`를 비운다. 중간에 나가면 `answered`부터 이어서 한다.

| 응답 | 하는 일 |
|---|---|
| 안다 | `knownStreak` +1. 어려운 단어 목록에 있고 `knownStreak`이 3이 되면 목록에서 빼고 `missTotal`과 `knownStreak`을 0으로 되돌린다. |
| 모른다 | `missTotal` +1, `knownStreak` 0으로. `missTotal`이 3이 되고 목록에 없으면 목록에 추가한다. 구글 검색을 새 탭으로 연다. |

두 경우 모두 `lastAnswer`를 갱신하고, 처음이면 `firstAnswer`도 채우고, `Log`를 한 줄 추가한다.

**화면 문구**: 기획서의 "안다/모른다"는 데이터 값(`known`/`unknown`)의 이름이고, 화면에는 영어로 "Does it ring a bell?" 아래에 **I remember / Look it up** 버튼으로 보여준다. 'Look it up'이 구글 검색 탭을 여는 동작과 맞기 때문이다. 다른 안내 문구도 모두 영어다(2장).

**구현 메모** (`lib/quiz.ts`, `app/review/page.tsx`)
- `/review`에 들어오면 진행 중인 회차가 없을 때 자동으로 시작한다. 홈의 '복습 시작'은 이 화면으로 가는 링크다.
- 자정을 넘겨 끝난 회차는 시작한 날로 센다: 회차의 `startedAt`이 오늘(KST)이 아니면 오늘 `completed`에 더하지 않는다.
- 앱을 열어 둔 채 자정을 넘기면 Today 카드와 탭 바의 N/5가 저절로 0으로 바뀐다(2026-10-27): `useKstMidnightTick`(`lib/use-store.ts`)이 다음 KST 0시에 맞춘 타이머와, 폰이 잠들었다 깨어날 때의 `visibilitychange`로 날짜가 바뀌었으면 화면을 다시 그린다.
- 회차에 있던 단어가 지워졌으면 그 회차는 버리고 새로 뽑는다.
- 회차를 끝내면 결과(오늘 횟수, 어려운 단어 목록 추가·제외)를 보여주고, '한 회차 더'를 누를 때까지 다음 회차를 시작하지 않는다.
- 'Look it up'을 누르면 응답은 즉시 기록하되 화면은 그 단어에 머문다(`lookedUp` 상태). 예문을 다시 볼 수 있고 'Open Google' 링크(새 탭)와 'Next' 버튼이 보인다. 그 응답으로 회차가 끝났으면 요약은 'Next'를 누른 뒤에 보여준다. 'I remember'는 바로 다음 단어로 넘어간다.

### 5.4 구글 검색 연결
`https://www.google.com/search?q=<단어>+meaning+pronunciation`을 새 탭(`target="_blank"`, `rel="noopener noreferrer"`)으로 연다. 뜻은 앱이 만들지 않는다.

### 5.5 발음 듣기 (nice) — 구현됨
복습 화면의 단어 옆 스피커 버튼(`app/review/speak-button.tsx`). 누를 때만 브라우저 기본 음성(`speechSynthesis`)으로 영어(`en-US`, 속도 0.9)를 읽어준다. 음성 파일은 가져오지 않고, `speechSynthesis`가 없는 브라우저에서는 버튼을 그리지 않는다. 음성 목록은 기기마다 달라서 미국식 영어 음성이 없으면 다른 영어 음성을 쓴다.

## 6. 예문 가져오기

### 6.1 구조

예문 출처는 두 개이고, 순서대로 찾는다.

1. **VOA 문장 모음**: VOA Learning English 기사를 미리 문장 단위로 모아 앱에 넣어 둔 파일 (6.4)
2. **Free Dictionary API**: 모음에서 쓸 수 있는 예문을 못 찾았을 때(단어가 없거나, 수준이 맞는 문장이 없거나, '다른 예문 보기'로 다 봤을 때)만 서버가 호출하는 사전 예문 (키 불필요)
3. 둘 다 없으면 "예문 없음"을 보여주고 퀴즈는 계속한다.

어려운 단어는 VOA에 없을 수 있다. 그때는 사전 예문이나 "예문 없음"이 나오는 것이 정상이다.

### 6.2 서버 API

`GET /api/example?word=<단어>&skip=<이미 본 예문 번호들>`

응답은 셋 중 하나다. (구현: `lib/examples-core.ts`의 `ExampleResult`)
```ts
{ ok: true, kind: "voa", id: string,
  before?: string, sentence: string, after?: string,  // 묻는 단어가 든 문장과 앞 또는 뒷 문장. 합쳐서 300자 이내
  pattern: string,                                     // 화면에서 단어를 강조할 정규식 소스 (lib/forms.ts, sentence에만 적용)
  source: { name: "VOA Learning English", url: string, license: "Public domain" } }
{ ok: true, kind: "dictionary", id: string, sentence: string, pattern: string,
  source: { name: "Wiktionary (Free Dictionary API)", url: string, license: "CC BY-SA 3.0" } }  // 1문장
{ ok: false }                                                      // 예문 없음
```
잘못된 단어(단어장 규칙 위반)는 400으로 거부한다. 화면은 회차가 시작되면 3단어의 예문을 한꺼번에 요청해 캐시(`app/review/example-cache.ts`)에 두고, 회차가 끝나거나 복습 화면을 떠나면 비운다(2026-10-27: 중간에 나가도 옛 예문·"더 없음" 상태가 남지 않게). '다른 예문 보기'를 불러오는 동안은 직전 예문을 그대로 보여주고 버튼만 "Finding…"이 되며, 그때 답하면 직전 예문의 종류를 기록한다. 요청이 실패하고 브라우저가 오프라인이면 처음이든 '다른 예문 보기'든 오프라인 문구를 보인다.
`skip`은 '다른 예문 보기'를 눌렀을 때 이미 본 예문을 빼기 위한 값이다. 더 찾았는데 없으면(`ok: false`) 화면은 마지막 예문을 그대로 두고 "No more examples"만 표시한다(`example-cache`의 `exhausted`). 한 단어당 '다른 예문 보기'는 5번까지(`MAX_ANOTHER`)이며, 넘으면 요청하지 않고 같은 표시를 한다.

### 6.3 서버가 하는 일 (순서대로)
1. `word`를 단어장 입력 검사(3번)와 같은 규칙으로 검사한다. 맞지 않으면 거부한다.
2. VOA 문장 모음에서 단어 또는 그 변화형(7번)이 든 문장을 찾는다. `skip`에 있는 것은 빼고, **문장 수준이 단어 수준 이하인 것만 남긴다**(6.6).
3. 찾았으면 무작위로 하나 고르고, 그 문장의 앞 문장과 뒷 문장 중 **더 긴 쪽**을 붙인다. 합쳐서 300자를 넘으면 다른 쪽을 쓰고, 둘 다 넘으면 찾은 문장만 쓴다. 한쪽이 없으면 있는 쪽만 쓴다.
4. 못 찾았으면 `https://api.dictionaryapi.dev/api/v2/entries/en/<단어>`를 호출해 `example`이 있는 항목 중, 단어(변화형)가 보통 단어로 들어 있고 300자 이하이며 **수준이 맞는 것**(6.6) 하나를 무작위로 고른다. 첫 글자를 대문자로 바꾸고 끝에 마침표가 없으면 붙인다. 출처는 응답의 `sourceUrls` 첫 주소(https가 아니거나 없으면 Wiktionary 단어 페이지로 대체, 2026-10-28)와 라이선스 "CC BY-SA 3.0"(Wiktionary 고정값. 응답의 `license`는 쓰지 않는다)으로 돌려준다. 요청에는 `User-Agent: WordSmart example/0.1 (personal learning project)`를 붙인다.
5. 그래도 없거나, 사전 서비스가 오류(530 등)를 내거나 네트워크가 끊기면 `{ ok: false }`를 돌려준다. 예문을 지어내지 않는다.
6. 서버 코드는 받은 단어를 `console` 등 로그에 쓰지 않는다(PRD 7번). 주소에 단어가 들어가는 것은 피할 수 없으므로 배포 서비스의 요청 로그에는 남을 수 있다.

### 6.4 VOA 문장 모음 만들기

개발 컴퓨터에서 직접 실행하는 스크립트(`scripts/build-voa-corpus.mjs`)로 만들고, 결과를 `data/voa-sentences.json`에 저장한다. 배포한 서버에서는 실행하지 않는다.

```ts
type VoaCorpus = {
  builtAt: string; source: string; license: string; requested: number;
  articles: { url: string; title: string; sentences: string[] }[];   // 앞뒤 문장은 이웃 원소. 수준은 저장하지 않는다(요청 때 계산, 6.6)
};
```

**지켜야 할 규칙**
- VOA 사이트의 검색 기능(`/s?k=`)은 자동 접속이 금지(`robots.txt`)라서 쓰지 않는다. 공개된 `sitemap.xml`로 기사 주소를 얻는다.
- 요청은 1초 이상 간격을 두고 보내고, 식별 가능한 이름(`User-Agent`)을 붙인다. 개인 연락처(이메일 등)는 넣지 않는다.
- 통신사(AP, Reuters, AFP) 기사는 넣지 않는다. 소설 낭독, 팟캐스트 안내처럼 기사가 아닌 페이지도 뺀다.
- 기사 주소는 `/a/<제목-슬러그>/<번호>.html` 꼴만 쓴다. 슬러그가 없는 `/a/<번호>.html`은 생방송·영상 페이지라 본문이 없고, `learning-english-podcast` 슬러그는 팟캐스트 안내라 뺀다. 번호가 클수록 최근 기사다. (2026-10-25 확인: 전체 67,359개 중 슬러그 있는 주소 32,737개)
- 기사 본문의 문단(`<div class="wsw">` 안의 `<p>`)만 뽑아 문장으로 나누고, 각 문장에 원문 링크를 붙인다. 사진 설명(`<figcaption>`, 이미지 `alt`), 사인오프("I'm Jill Robbins."), `____` 구분선 뒤의 단어 풀이(Words in This Story), 프로그램 인사말("And now Words and Their Stories…")은 뽑지 않는다.
- 저장 형태는 기사별 문장 배열이다 (`{ url, title, sentences: string[] }`). 앞뒤 문장은 이웃 원소이고, 예문 id는 `voa:<모음 안의 기사 순번>:<문장 순번>`이다(VOA 기사 번호가 아니라 배열 순번이라, 모음을 다시 만들면 바뀐다). 수준(`level`)은 미리 저장하지 않고 요청할 때 계산한다(빈도 목록을 바꿔도 모음을 다시 만들 필요가 없도록).
- **통신사 기사 구분 규칙** (기사 12개로 확인, 2026-10-25): 통신사 표기는 사진 설명의 `(AP Photo/...)`와 본문 중간의 **짧은 크레디트 문단** 두 군데에 나온다. 사진 설명은 사진 저작자 표시일 뿐이라 기사를 제외할 이유가 아니다. 제외 기준은 크레디트 문단이다.
  - 제외하는 형태: `... reported (on) this story for (The) Associated Press. ... adapted it for VOA Learning English.` / `... wrote this story for The Associated Press. ... adapted it for VOA Learning English.` / `... Additional reporting came from The Associated Press.`
  - 제외하는 형태(2026-10-27 추가, PLAN 24 점검에서 발견): `... adapted this story based on an AFP report.` / `... wrote this story, based on reports from ..., The Associated Press and Reuters.` — 첫 모음 102개 중 2개가 이 꼴로 들어와 있어 규칙(`(adapted|wrote) … based on … AP/AFP/Reuters`)을 더하고 그 2개를 뺐다. Reuters·AFP 표기는 본문 인용("told AFP", "Reuters reported")으로는 흔히 나오며, 그것은 VOA 자체 기사라 남긴다.
  - 남기는 형태: `... wrote this story/report for Learning English.` (VOA 자체 기사)
  - 규칙: 260자 이하의 문단 중 `(reported|wrote) ... for (The )?(Associated Press|Reuters|AFP|Agence France-Presse)`, `adapted it for VOA`, `Additional reporting came from ... (Associated Press|Reuters|AFP)`, `(adapted|wrote) ... based on ... (Associated Press|AP|Reuters|AFP|Agence France-Presse)`(2026-10-27 추가) 중 하나라도 맞으면 그 기사 전체를 제외한다. "Agence France Press"(e 없음) 철자 변형도 잡는다. "adapted it for VOA"만 있는 경우도 다른 매체를 고쳐 쓴 것으로 보고 제외한다(보수적 판단).
  - 본문 문단이 2개 이하인 페이지(영상·팟캐스트 안내 등)와 제목이 "Learning English Podcast"인 페이지도 뺀다.
  - 그 밖의 걸러내기(코드 기준, 2026-10-26 확인): 사이트맵 목록에서 `sections`·`videos` 사이트맵은 빼고, 제목이 "Quiz"로 시작하는 페이지는 뺀다. 40자 미만 문단은 건너뛴다. 문장은 20~300자, 4단어 이상, 문장부호로 끝나는 것만 남기고, 전부 대문자인 문장과 `___`가 든 문장은 뺀다. 남은 문장이 3개 미만이면 기사를 뺀다.
  - **알려진 빈틈**: VOA 자체 크레디트 문단(`… for Learning English`)을 만나면 본문 읽기를 멈추므로, 그 뒤에 따로 오는 "Additional reporting came from Reuters" 같은 문단은 검사하지 못한다. PLAN 24번에서 표본으로 확인한다.
- VOA Learning English의 텍스트는 퍼블릭 도메인이라 보관 기간 제한이 없다.

**현재 사정 (2026-10-25 확인)**: 사이트맵에 주소가 67,359개이고 그중 스크립트가 받는 슬러그 있는 기사 주소는 32,737개다. 1.1초 간격으로 받으면 모두 받는 데 약 10시간이 걸리므로, 최근 기사 일부부터 모으는 것으로 시작한다. (범위와 파일 크기는 10번)

### 6.5 미리 불러오기
복습을 시작하면 3단어의 예문을 한꺼번에 요청하고, 도착하는 대로 보여준다. VOA 모음은 서버 안의 검색이라 빠르고, 사전 호출만 시간이 걸린다.

### 6.6 예문 수준 맞추기

예문이 묻는 단어보다 어려우면 안 된다. 단어와 문장의 수준을 같은 자로 재서 비교한다. **통과 조건(문장 수준 ≤ 단어 수준)은 2026-10-25에 확정했다. 5단계의 경계, "어려운 쪽 10% 제외(최소 한 단어)", "40단어 초과 시 +1"은 실제 예문 약 90개를 보고 2026-10-26에 확정했다(PLAN 22번, 아래 "조정 기록"). 값은 모두 `lib/level.ts` 상수다.**

**자로 쓰는 것: 단어 사용 빈도 순위** (영어에서 얼마나 흔히 쓰이는 단어인가). 순위가 낮을수록(흔할수록) 쉬운 단어다. 목록이 영화 자막 기준이라 뉴스 단어(officials 5,605위, countries 3,444위, scientists 3,019위)가 일상 대화 기준보다 뒤에 있다. 경계는 그것을 감안해 정했다.

| 수준 | 빈도 순위 (확정) | 예 (실제 순위) |
|---|---|---|
| 1 | 1 ~ 4,000위 | money 178, school 320, scientists 3,019, election 3,228 |
| 2 | 4,001 ~ 8,000위 | economy 4,519, climate 5,507, officials 5,605 |
| 3 | 8,001 ~ 13,000위 | reluctant 11,650 |
| 4 | 13,001 ~ 20,000위 | plausible 13,916, widespread 16,523, eradicate 19,362 |
| 5 | 그 밖이거나 목록에 없음 | ubiquitous, ephemeral, serendipity (목록에 없음) |

**단어 수준**: 단어장 단어의 기본형(`run`, `hinder`)이 속하는 수준. 목록에 없으면 5.

**문장 수준** (예문 하나에 대해)
1. 둥근 아포스트로피(’ ‘)를 곧은 것(')으로 바꾼 뒤 문장을 단어로 나누고, 어미 변화를 기본형으로 되돌린다. 축약형(don't, it's, we're)은 앞부분(do, it, we)으로 찾는다. (VOA 본문은 둥근 아포스트로피를 쓰는데, 안 바꾸면 don’t가 don + t로 쪼개져 t가 "목록에 없음"이 된다.)
2. **묻는 단어(와 변화형)는 뺀다.** 묻는 단어가 어려운 것은 당연하기 때문이다.
3. 고유명사와 숫자도 뺀다. 사람 이름이나 지명 때문에 문장이 어렵다고 나오지 않게 하기 위해서다. 고유명사는 문장 중간의 대문자 단어이고, 문장 첫 단어는 보통 단어일 수 있으므로 소문자로 목록에 없을 때만 고유명사로 본다("Strauss wrote a poem…"의 Strauss).
4. 남은 단어들의 수준을 구하고, **어려운 쪽 10%(올림, 최소 한 단어)를 뺀 가장 높은 수준**을 문장 수준으로 한다. 드문 단어가 하나 섞인 것은 막지 않는다. 내림이었을 때는 10단어 미만 문장에서 한 단어도 빠지지 않아 "A Chinese teacher taught Pearl other subjects."가 subjects 하나 때문에 막혔다.
5. 문장이 **40단어를 넘으면 수준을 1 올린다** (길이도 어려움에 반영). 25였을 때는 앞뒤 문장을 붙인 예문이 거의 다 걸려 앞뒤 문장이 사라졌다.
6. 앞뒤 문장을 붙인 예문은 붙인 전체로 계산한다. 이때 3번의 첫 단어 예외는 붙인 전체의 첫 단어에만 적용되므로, 둘째 문장의 첫 대문자 단어는 늘 고유명사로 빠진다(알고 있는 한계. 쉬운 쪽으로 틀리는 것이라 그대로 둔다).

**통과 조건**: `문장 수준 ≤ 단어 수준`
- 수준 1 단어(run)에는 수준 1 문장만 쓴다. 수준 4 단어(ubiquitous)에는 수준 4 이하 문장을 쓴다.
- 문장이 단어보다 쉬운 것은 괜찮다. "너무 어려운 예문"을 막는 것이 목적이다.

**적용 위치**
- VOA 문장 모음: 각 문장의 수준은 **요청할 때 계산**한다(모음에는 저장하지 않는다. 빈도 목록이나 숫자를 바꿔도 모음을 다시 만들 필요가 없도록). 서버는 단어 수준 이하인 문장만 후보로 삼는다.
- 사전 예문(Free Dictionary): 호출할 때마다 같은 방법으로 계산한다. 보통 짧아서 대부분 통과한다.
- 앞뒤 문장을 붙인 결과가 기준을 넘으면 붙인 문장을 빼고 원래 문장만 쓴다(300자 규칙과 달리 반대쪽 문장을 대신 시도하지는 않는다). 원래 문장도 넘으면 그 예문은 쓰지 않는다.

**미리 알아둘 영향**: 수준이 낮은(흔한) 단어에는 VOA 문장이 많이 통과하고, 수준이 높은 단어는 VOA에서 애초에 드물어 "예문 없음"이 나올 가능성이 큽니다. 이 규칙 때문에 "예문 없음"이 더 늘 수 있다.

**빈도 목록** (2026-10-25 결정, PLAN 21번): `data/word-freq.json` (단어 → 순위)과 이를 쓰는 `lib/level.ts`를 둔다. 목록이 비어 있으면 수준을 알 수 없으므로 규칙이 꺼지고 모든 예문이 통과한다. 지금은 채워져 있어 규칙이 켜져 있다.
- **출처**: [hermitdave/FrequencyWords](https://github.com/hermitdave/FrequencyWords)의 `content/2018/en/en_50k.txt`. OpenSubtitles 2018 영어 자막(opus.nlpl.eu)에서 센 빈도라 영화·드라마 대화에서 흔한 순서다. 저장소 코드는 MIT, 목록 데이터는 **CC BY-SA 4.0**이라 변환 결과도 같은 조건이며, 출처·라이선스·만든 시각은 `data/word-freq.meta.json`에 적는다.
- **변환** (`scripts/build-word-freq.mjs`, 규칙은 `lib/word-freq.ts`): 내려받은 파일 경로를 인수로 받아(스크립트가 직접 내려받지 않는다) 알파벳 소문자만으로 된 단어만 남기고(`'s`, `mr.`, `i-i` 제외, 한 글자는 `a`·`i`만), 남은 순서대로 1부터 순위를 다시 매겨 **상위 20,000개**를 저장한다. 그 밖의 단어는 "목록에 없음" = 수준 5다. 다시 만들려면: 파일을 빈 폴더에 내려받고 `node scripts/build-word-freq.mjs <경로>`.
- **변화형**: 목록에는 기본형과 변화형이 따로 들어 있다(`run`, `running` 둘 다 있을 수 있음). `lib/level.ts`는 토큰을 먼저 그대로 찾고, 없으면 어미(-s/-es/-ed/-ing/-ies 등)를 떼어 기본형으로 다시 찾는다. 목록에는 글자만으로 된 단어만 있으므로 축약형(don't, teacher's)은 아포스트로피 앞부분으로 찾는다.
- **첫 측정** (2026-10-25, VOA 모음 102개 기사 기준): 수준 1 단어는 VOA 후보 문장 중 통과하는 비율이 낮다 — cat 8→1, school 24→4, money 14→2, house 16→7. 예를 들어 "The cat sat on the mat."은 sat(2,095위, 수준 2)·mat(8,350위, 수준 3) 때문에 cat(수준 1)에는 막힌다. 수준 4~5 단어는 VOA에 후보 자체가 없어 사전 예문으로 간다. 숫자 조정은 PLAN 22번. (이때의 후보 수 school 24·money 14·house 16은 그날 임시 스크립트로 센 값이고, 아래 조정 기록의 25·15·14는 코드의 후보 함수 `findVoaCandidates`로 다시 센 값이다. 코드 값을 기준으로 삼는다.)
- **조정 기록** (2026-10-26, PLAN 22번): 모음에 3번 이상 나오는 목록 단어 2,029개의 VOA 후보 35,849문장으로 변형 10여 개를 재고, 단어 30개의 예문 약 90개를 직접 보며 골랐다. 측정 스크립트는 프로젝트 밖(스크래치)에서 돌렸고 저장하지 않았다. 바뀐 것: 경계 2,000/5,000/10,000 → 4,000/8,000/13,000, 10% 제외를 내림 → 올림(최소 한 단어), 긴 문장 25 → 40단어, 둥근 아포스트로피 치환, 축약형 찾기, 첫 단어 고유명사 규칙. 결과(후보 통과율 / 후보 있는 단어 중 예문 하나라도 통과하는 비율 / 통과 예문 중 앞뒤 문장 유지율): 수준 1 단어 15%→60% / 75%→97% / 10%→54%, 수준 2 32%→83% / 84%→99% / 24%→71%, 수준 3 59%→94%, 수준 4 83%→98%. cat 8→6, school 25→15, money 15→11, house 14→9. "The cat sat on the mat."은 이제 통과한다. 지나치게 긴 과학 기사 문장("The scientists said discovering large amounts of it on Mars adds to existing evidence…")은 여전히 막힌다. 단어장 단어(대부분 수준 3~5)에는 거의 영향이 없고, 쉬운 단어의 VOA 예문이 사전 예문으로 밀리는 일을 줄이는 조정이다.

### 6.7 후보를 고른 과정 (2026-10-25 직접 확인)

| 후보 | 결과 |
|---|---|
| **VOA Learning English** | 채택(1순위). 텍스트, MP3, 사진, 영상이 퍼블릭 도메인이고 출처를 밝히면 재게시 가능 ([안내](https://learningenglish.voanews.com/p/6861.html)). 단, 통신사 기사는 제외. 검색 기능은 `robots.txt`가 막음 ([robots.txt](https://learningenglish.voanews.com/robots.txt)) |
| **Free Dictionary API** | 채택(2순위). 키 불필요, 데이터는 CC BY-SA 3.0. 20단어 시험에서 10단어에 예문이 있었고 5번은 서버 오류(530)였다 ([사이트](https://dictionaryapi.dev/)) |
| Wikinews | 보류. 키 불필요, CC BY, 검색 API로 20단어 중 19개에서 기사가 나왔다. 필요하면 나중에 `examples.ts`에 추가할 수 있다 ([저작권 정책](https://en.wikinews.org/wiki/Wikinews:Copyright)) |
| The Guardian | 보류. 무료 개발자 키(하루 500번, 초당 1번, 본문 제공)는 있으나, 헤드라인·바이라인·로고 표시 의무와 "변경 금지" 조항이 2문장 발췌와 단어 강조에 걸릴 수 있다 ([약관](https://www.theguardian.com/open-platform/terms-and-conditions)) |
| NewsAPI.org | 제외. 본문이 200자로 잘리고 무료는 개발·테스트용 ([문서](https://newsapi.org/docs/endpoints/everything)) |
| GNews | 제외. 무료는 본문이 잘리고 전체 본문은 유료 ([가격](https://gnews.io/pricing)) |
| New York Times | 제외. 검색 결과 기준으로 본문 없이 첫 문단·요약만 제공(공식 페이지는 열지 못해 미확인) |
| BBC | 제외. 웹사이트 콘텐츠 재사용과 메타데이터 추출은 허락이 필요 ([안내](https://www.bbc.co.uk/usingthebbc/terms/can-i-use-bbc-content/)) |
| Vocabulary.com | 제외. 자동 수집·추출을 약관이 금지 ([약관](https://www.vocabulary.com/terms/)) |
| 한국 영어신문 | 제외. 단어 검색용 공식 API를 찾지 못했다 |

## 7. 단어 강조

예문에서 묻는 단어(와 변화형)를 **굵게 + 색**으로 표시한다. 앞뒤 문장은 강조하지 않는다. 서버가 문장을 고를 때와 화면이 강조할 때 같은 함수(`lib/forms.ts`)를 쓴다.

찾는 모양은 이렇다. 모두 대소문자를 무시하고 단어 경계에서만 맞춘다.
- 원형: `run`
- 규칙 변화: `-s`, `-es`, `-ed`, `-d`, `-ing`, 자음 겹침(`running`), 끝 `e` 탈락(`making`), `y→ies/ied`
- 불규칙형: 자주 쓰는 불규칙 동사와 명사 복수형 표(`run → ran`, `go → went`, `child → children` 등 약 135개)를 코드에 넣어 둔다. (표의 범위는 10번 참고)
- 고유명사 제외(PRD 5번 ②, `containsFormAsCommonWord`): 문장 중간에서 대문자로 시작하는 형태만 있는 문장은 후보에서 뺀다. 문장 첫머리의 대문자는 인정하므로 "Apple released…" 같은 경우는 걸러지지 않는다(한계, '다른 예문 보기'로 넘긴다).
- 아포스트로피(2026-10-27): 단어는 곧은 '로 저장되지만 VOA 본문은 둥근 ’를 쓰므로, 찾기·강조 패턴(`formsPattern`)은 ' 자리에 둘 다 허용하고 둥근 ’도 단어 경계로 본다(o'clock ↔ o’clock).

## 8. 통계와 백업

**통계 화면** (`lib/stats.ts`, `app/stats/page.tsx`, Still Learning 화면 제목 옆의 Stats 링크) — 구현됨
- 끝낸 회차는 `store.rounds`에 `{ at, date }`로 쌓는다(`date`는 시작한 날의 KST 날짜). 회차 기록을 남기기 전 데이터를 위해 오늘 횟수는 `progress.completed`와 기록 중 큰 쪽을 쓴다.
- 이번 주 복습 횟수: 월~일(`kstWeekStart`) 안의 회차 수. 목표 20(하루 4회 × 5일).
- 최근 4주 복습한 날 수: 오늘 포함 28일 중 회차가 1회 이상 있는 날. 목표 20.
- 기억률: `firstAnswer === "unknown"`인 단어 중 `lastAnswer === "known"`인 비율. 대상이 없으면 "–".
- 예문 제공률: `example`이 기록된 최근 100건 중 `none`이 아닌 비율. 20건 미만이면 "Not enough data yet". 예문을 아직 불러오는 중에 답한 응답은 `example`이 없어 계산에서 빠지고, 오프라인 등으로 못 받은 응답은 `none`으로 기록되어 비율을 낮춘다(PRD 3번).
- 백업 파일 속 저장본의 `lastBackupAt`은 그 파일을 내보낸 시각이다(`makeBackup`이 넣는다). 그래서 다른 주소에서 가져온 직후에는 백업 안내가 뜨지 않고 14일 뒤부터 뜬다.
- 첫 사용일로부터 며칠째인지(`Day N`)를 머리말에 보여준다.

**백업 파일**: `{ app: "word-smart", version: 1, exportedAt, data: Store }` 형태의 JSON 파일. 이름은 `word-smart-backup-<KST 날짜>.json` (`lib/backup.ts`, 화면은 `app/backup/page.tsx`). — 구현됨
- 내보내기: `navigator.canShare({files})`가 되면 공유 시트, 아니면(또는 공유 실패) `<a download>`로 다운로드. 사용자가 공유를 취소하면(AbortError) 백업 시각을 남기지 않는다. 성공하면 `lastBackupAt`을 기록하고 미룸을 푼다.
- 가져오기: `parseBackup`이 JSON → `app === "word-smart"` → `version`(앱보다 크면 거부, 작으면 `migrate`로 변환) → `data`가 객체인지(없거나 다른 형이면 거부. 빈 단어장으로 덮어쓰지 않기 위해, 2026-10-27) → `parseStore` 순으로 검사한다. `parseStore`는 가져온 단어도 입력 규칙(3장)으로 검사해 규칙에 안 맞는 단어는 버리고 소문자·곧은 아포스트로피로 정리하며, 같은 id나 같은 글자의 중복은 앞의 것만 남긴다(2026-10-27). 통과하면 단어 수와 내보낸 시각을 보여주는 확인 창을 거친 뒤 저장본 전체를 바꾼다(`useStore().replace`). 오늘의 진행 상태도 파일 것으로 바뀐다고 알린다.
- 백업 안내(Word List 화면, `app/backup-notice.tsx`; Backup 링크도 그 화면 제목 옆): `needsBackupReminder` = 단어 50개 초과 ∧ (백업 기록 없음 ∨ 14일 경과) ∧ 미룸 기간 아님. '7일 뒤에 다시'는 `backupSnoozedUntil`에 저장.
- 전체 초기화(백업 화면 맨 아래): 확인 창 → `prompt`에 `DELETE` 입력 → 이 기기의 알림 구독을 끄고(`app/push-client.ts`, 서버 목록에서 지우고 브라우저 구독 해제) → `useStore().reset()`이 저장소 키를 지운다. 알림을 못 끄면 데이터는 지우되 "Today에서 끄라"고 안내한다.

## 9. 폴더 구조

```
app/
  layout.tsx            공통 틀: 상단 네이비 띠, 글꼴(next/font), 탭 바, PWA 메타
  globals.css           색·핀 스트라이프·글꼴 클래스 (디자인은 여기서만)
  manifest.ts           홈 화면 추가용 매니페스트
  tab-bar.tsx           하단 탭 3개 (Today / Word List / Still Learning)
  today-progress.tsx    홈 카드: 오늘 횟수 N/5와 상태별 버튼
  reminders.tsx         홈의 알림 띠: 켜기/끄기, 시험 알림 (13장)
  push-client.ts        이 기기의 알림 끄기 (알림 띠와 전체 초기화가 같이 씀)
  save-warning.tsx      저장이 막힌 브라우저일 때 모든 화면 위에 보이는 경고 (layout.tsx가 그림)
  backup-notice.tsx     백업 권유 안내 (Word List 화면)
  page.tsx              홈 (Today)
  words/page.tsx        단어장 (Word List)
  review/page.tsx       복습 화면
  review/example-card.tsx   예문 카드 (강조, 출처, Another example, 오프라인 안내)
  review/example-cache.ts   3단어 예문 미리 요청·캐시 (useSyncExternalStore)
  review/speak-button.tsx   발음 듣기 버튼 (Web Speech API)
  hard/page.tsx         어려운 단어 목록 (Still Learning)
  stats/page.tsx        통계
  backup/page.tsx       백업 (내보내기·가져오기·전체 초기화)
  api/example/route.ts  예문 API (서버). lib/examples.ts를 부른다
  api/push/subscribe/route.ts  푸시 구독 등록(POST)·해제(DELETE)
  api/push/send/route.ts       등록된 기기 전부에 알림 보내기 (예약 서비스가 비밀 값과 함께 부른다)
  api/push/test/route.ts       이 기기에만 시험 알림
lib/                    순수 로직. 파일마다 *.test.ts가 짝으로 있다 (kst, use-store, examples, push-store, push-send 제외)
  store.ts              저장 데이터 모양, parseStore, 단어 추가·삭제
  use-store.ts          localStorage 읽기·쓰기 훅 (브라우저 API는 여기만)
  words.ts              입력 검사, 여러 단어 나누기, 중복
  quiz.ts               단어 뽑기, 응답 처리, 어려운 단어 규칙, 회차 기록
  kst.ts                한국 시간 날짜 계산
  forms.ts              단어 변화형 찾기·강조 정규식
  examples-core.ts      예문 고르기 규칙 (VOA 후보·앞뒤 문장·300자·수준, 사전 응답 고르기) — 순수 함수, 테스트 대상
  examples.ts           예문 출처 순서와 실제 호출 (모음 JSON 읽기, Free Dictionary fetch, 6초 제한) — 서버에서만
  level.ts              단어·문장 수준 계산 (6.6)
  push.ts               알림 규칙: 시각, 문구, 구독 정보 검사 (13장, 순수)
  push-store.ts         구독 목록 읽기·쓰기: Vercel Blob 또는 .local/ 파일 (서버, 테스트 없음)
  push-send.ts          web-push로 보내기 (서버, 테스트 없음)
  word-freq.ts          빈도 목록 변환 규칙 (알파벳만, 상위 20,000, 순위 다시 매김)
  backup.ts             백업 파일 만들기·검사·버전 변환
  stats.ts              통계 네 지표
scripts/                개발 컴퓨터에서 직접 실행. 배포 서버에서는 돌리지 않는다
  fonts/                아이콘용 글꼴 PlayfairDisplay-Black.ttf와 라이선스 OFL.txt (SIL OFL 1.1, Google Fonts에서 받음)
  build-voa-corpus.mjs  VOA 문장 모음 만들기
  build-word-freq.mjs   빈도 목록 변환 (내려받은 en_50k.txt 경로를 인수로)
  make-icons.mjs        PWA 아이콘 PNG 만들기
data/
  voa-sentences.json    VOA 문장 모음 (스크립트가 만듦, 퍼블릭 도메인)
  word-freq.json        단어 빈도 순위 { 단어: 순위 } 20,000개 (스크립트가 만듦)
  word-freq.meta.json   빈도 목록의 출처·라이선스(CC BY-SA 4.0)·만든 시각
public/                 아이콘 (icon-192.png, icon-512.png, apple-touch-icon.png: 흰 바탕 핀 스트라이프 + W), badge-96.png(안드로이드 알림 배지, 투명 배경 W), sw.js(푸시 알림용 서비스 워커). Next.js 설치 때 생긴 svg 5개는 쓰지 않아 trash-can/으로 옮겼다(2026-10-26)
.local/                 개발 컴퓨터의 푸시 구독 파일 (Git에 올리지 않음)
README.md               앱 소개, 명령, 자료 출처
PRD.md · PLAN.md · DESIGN.md · CLAUDE.md   기획 · 계획 · 설계 · 작업 규칙
CHECK.md                점검서: 성공 기준 판정, Gap 분석, 보안 점검 결과와 남은 일 (2026-10-28)
.env                    `VERCEL_TOKEN` 등 외부 서비스 토큰과 푸시 알림 값 4개(13.4). 값은 코드·문서·채팅에 적지 않는다 (Git에 올리지 않음)
.vercelignore           Vercel CLI 배포 때 올리지 않을 것: .env*, .local/, trash-can/, .bkit/, .claude/ (CLI는 .gitignore를 보지 않는다, 11장)
```

Next.js 규칙은 이 프로젝트에 설치된 버전의 문서(`node_modules/next/dist/docs/`)를 따른다. 예를 들어 예문 API는 `app/api/example/route.ts`에 `GET` 함수를 두는 방식이다.

## 10. 아직 정하지 못한 것

| # | 내용 | 언제 정하나 |
|---|---|---|
| 1 | **VOA 문장 모음의 범위.** 첫 모음(2026-10-25): 최근 기사 300개를 받아 **102개 유지, 3,252문장, 313KB**(2026-10-27 통신사 규칙 보강으로 2개를 빼 지금은 **99개, 3,172문장, 304KB**. "Agence France Press" 철자 변형 1개를 같은 날 더 뺐다). 제외는 통신사 134, 본문 부족(too_short) 60, 팟캐스트 2, 퀴즈 1, 본문 없음 1. 통신사 기사가 절반이라 유지되는 기사는 받은 수의 1/3 정도다. 더 모을지(예: 1,000개 → 약 20분, 1MB 안팎), `too_short` 60개가 정말 짧은 글인지 추출 실수인지 확인할 것. | PLAN 23번 (통계의 예문 제공률이 60% 미만일 때) |
| 1-1 | **통신사 기사 구분 규칙의 검증.** 2026-10-27 점검(PLAN 24): 유지된 102개를 전부 훑어 "based on … AFP/AP/Reuters report" 꼴 2개를 찾아 규칙을 더하고 뺐다(6.4). Reuters·AFP 표기는 본문 인용으로 확인됨. 남은 것: VOA 크레디트 문단 뒤에 오는 통신사 문단(6.4 "알려진 빈틈")은 제외된 기사를 다시 받아야 볼 수 있어 모음을 확대할 때(PLAN 23) 함께 본다. | PLAN 23번 때 |
| ~~1-3~~ | **수준 계산의 숫자** → 실제 예문 약 90개를 보고 **4,000/8,000/13,000/20,000위, 10% 제외(올림), 40단어 초과 시 +1로 확정** (2026-10-26, 6.6, PLAN 22번) | 완료 |
| 1-2 | **VOA 모음의 단어 적중률.** 표본 40개에서는 어려운 단어가 0건이었으나 표본이 너무 작다. 모음을 만든 뒤 단어장 단어의 몇 %가 걸리는지 재 본다. 낮으면 먼저 모음을 확대한다(PLAN 23번). Wikinews 같은 다른 출처를 더하는 것은 PRD의 출처 순서(VOA → 사전 → 없음)를 바꾸는 일이라 PRD 변경이 필요한 선택지다. | PLAN 23번 (통계의 예문 제공률이 60% 미만일 때) |
| 2 | 불규칙 동사·명사 복수형 표를 얼마나 넓게 할지 (지금 `lib/forms.ts`에 약 135개) | 예문을 쓰다 빠진 것이 보이면 추가 |
| ~~3~~ | 응답 기록 보관 기간 → **무제한으로 확정** (PRD 검토 4회) | 완료 |
| ~~4~~ | 단어 삭제 시 기록 삭제 → **PRD 5번 ①에 반영** (검토 3회) | 완료 |
| ~~5~~ | "1분 이내"에 예문 로딩 포함 → **포함으로 확정** (검토 4회) | 완료 |
| ~~6~~ | 테스트 도구 → **`node:test`로 확정**, 115개 작성(2026-10-29 기준) | 완료 |

## 11. 알아둘 점

- **배포 주소**: (PLAN 18번을 마친 뒤 여기에 적는다) `https://________.vercel.app` · 배포 방식은 Vercel CLI로 `main`을 프로덕션 배포(사용자가 터미널에서 직접 실행, PRD 9번 18). GitHub 저장소 연동은 쓰지 않는다. **CLI는 Git 커밋이 아니라 작업 폴더 전체를 올리고 `.gitignore`를 보지 않으므로**, `.vercelignore`로 `.env*`·`.local/`·`trash-can/`·`.bkit/`·`.claude/`를 뺀다(2026-10-26 추가). 배포 뒤 Vercel의 Source 화면에서 `.env`가 없는지 한 번 확인한다.
- **보안 헤더** (2026-10-28 공개 전 점검): `next.config.ts`가 모든 경로에 `Content-Security-Policy: frame-ancestors 'none'`(다른 사이트가 이 앱을 틀에 넣는 클릭재킹 차단)·`X-Frame-Options: DENY`·`X-Content-Type-Options: nosniff`·`Referrer-Policy: strict-origin-when-cross-origin`·`Permissions-Policy`(카메라·마이크·위치 끔)를 붙인다. 스크립트까지 제한하는 엄격한 CSP(nonce)는 Cache Components와 맞지 않아 쓰지 않는다. HTTPS 강제(HSTS)는 Vercel이 붙여 주는 것으로 알고 있으니 배포 뒤 응답 헤더로 확인한다. 인증 없는 API(`/api/example`, `/api/push/subscribe`·`test`)의 호출 횟수 제한은 코드에 없고, 필요하면 Vercel 대시보드의 Firewall 규칙으로 건다.
- `localStorage`는 **주소마다 따로** 저장된다. 컴퓨터에서 띄운 `localhost` 주소와 Vercel에 배포한 주소는 서로 다른 단어장을 갖는다. 배포 주소를 바꾸면 기록이 사라지므로 백업 기능이 중요하다.
- 사파리는 오래 쓰지 않은 사이트의 저장 데이터를 지울 수 있다. 홈 화면에 추가해서 쓰면 도움이 될 수 있다. (제가 아는 범위의 내용이라 만들 때 다시 확인한다.)
- 지금 쓰는 예문 출처(VOA 모음, Free Dictionary API)는 API 키가 필요 없다. 나중에 키가 필요한 서비스를 추가하면 `.env`에 넣고 서버 코드에서만 읽는다. `NEXT_PUBLIC_`으로 시작하는 이름은 쓰지 않는다. 브라우저로 노출되기 때문이다. 단, 푸시 알림의 공개 키 `NEXT_PUBLIC_VAPID_PUBLIC_KEY`는 공개해도 되는 값이라 예외다(13.4).
- Free Dictionary API는 후원으로 운영되는 서비스라 오류가 날 수 있다(시험에서 20번 중 5번). 그래서 실패해도 "예문 없음"으로 계속 진행한다.

## 12. 만드는 순서

작업 순서와 완료 여부는 `PLAN.md`의 "작업 목록"(26개)이 기준이다. 1~17번, 21번(빈도 목록), 22번(수준 조정)이 끝났고 26번(푸시 알림)은 코드만 끝났다. 남은 것은 배포(18) → 알림 설정(26의 남은 부분) → 데이터 이전(19) → 폰 확인(20) → 모음 확대(23) → 예외 점검(24) → 4주 뒤 판정(25).

## 13. 푸시 알림 (2026-10-26 추가, PRD 5번 nice·7번)

하루 5번 정해진 시각에 "복습할 시간"이라는 알림을 폰에 띄운다. 알림은 앱이 닫혀 있어도 와야 하므로 서버가 보내야 하고, 서버는 정해진 시각에 누군가 깨워 줘야 한다. 그래서 세 조각이 필요하다: **알림을 받을 기기의 주소(구독)를 저장하는 곳**, **그 주소로 알림을 보내는 서버 코드**, **정해진 시각에 서버를 부르는 시계**.

### 13.1 결정 (2026-10-26)

| 항목 | 결정 | 이유 |
|---|---|---|
| 시각 | 한국 시간 9·11·13·17·19시 고정(확정, 2026-10-26), 앱에서는 켜기/끄기만 | PRD 3번 권장 시각. 시각 선택 기능은 만들지 않는다 |
| 시계 | cron-job.org 무료 계정, 예약 5개 | Vercel 무료 플랜은 하루 1번만 예약 가능(시 단위 오차). Pro는 월 20달러 |
| 저장 | Vercel Blob 비공개 파일 `push/subscriptions.json` 하나 | 추가 계정 없이 Vercel 안에서 해결. 사용자 한 명이라 파일 하나면 충분 |
| 문구 | "Word Smart" / "Time for 1st round" … "Time for 5th round" (시각이 하루 중 몇 번째 알림인지로 번호를 정한다. 시험 알림처럼 알림 시각이 아니면 "Time for a round") | 학습 기록을 서버에 보내지 않기 위해(PRD 7번) 번호는 시각에서만 나온다. 같은 tag라 알림이 쌓이지 않는다 |
| 소리 | 기기 기본 알림음 | 홈 화면 웹 앱 알림은 소리를 고를 수 없다(웹 표준에 없음). cabin chime 요청은 불가능하다고 확인 |
| 서비스 워커 | `public/sw.js`, 푸시 전용 | 오프라인 캐시를 넣으면 배포 때 옛 화면이 남는 문제가 생기므로 캐시는 하지 않는다 |

### 13.2 알림 모양 (아이폰 잠금 화면·배너)

```
┌────────────────────────────────────────┐
│ [W]  Word Smart                 9:00 AM │   ← 아이콘은 홈 화면 아이콘(흰 바탕 핀 스트라이프 + 네이비 W)
│      Time for 1st round                │   ← 11시 2nd, 13시 3rd, 17시 4th, 19시 5th
└────────────────────────────────────────┘
   누르면 → 앱이 열리고 /review 로 이동 (이미 열려 있으면 그 창을 앞으로)
```

안드로이드 상태 표시줄에는 `badge-96.png`의 W 실루엣이 작게 보인다. 아이폰은 배지를 쓰지 않는다.

### 13.3 흐름과 파일

- **켜기** (`app/reminders.tsx`): 지원 여부를 본다 → 서버에 공개 키가 없으면(배포 설정 전) "Reminders are not set up on this server yet.", 아이폰·아이패드 사파리(홈 화면 추가 전. 아이패드는 UA가 Mac이라 터치 포인트 수로 가른다)면 "홈 화면에 추가하세요" 안내, 지원 안 되면 "This browser cannot receive reminders.", 권한이 차단됐으면 안내. 지원되면 `sw.js`를 등록하고 "Turn on reminders" 버튼을 보인다. 누르면 권한을 묻고(iOS는 사용자 동작 안에서만 가능), 공개 키(`NEXT_PUBLIC_VAPID_PUBLIC_KEY`)로 구독을 만들어 `POST /api/push/subscribe`에 보낸다. 서버 저장이 실패하면(응답 오류든 네트워크 예외든) 구독을 되돌리고, 409면 상한이 찼다고 안내한다. 카드에는 "Reminders"라는 제목과 시각을 쓰지 않고(2026-10-26 사용자 요청), 종 아이콘 + 상태 글 + 알약 버튼의 한 줄 띠로 보인다. 켠 뒤에는 "On for this device."와 Send a test·Turn off만 남고, 켜거나 끈 직후와 시험 알림을 보낸 뒤에는 그 아래에 안내 한 줄("Reminders are on for this device." 등)이 보인다. 띠 자체는 어느 상태에서도 사라지지 않는다. 서버는 구독을 10개까지만 받는다(넘으면 409, 13.6).
- **저장** (`lib/push-store.ts`): `BLOB_READ_WRITE_TOKEN`이 있으면 Vercel Blob(비공개, 캐시 없이 읽기), 없으면 개발 컴퓨터의 `.local/push-subscriptions.json`. 구독 정보는 `lib/push.ts`의 `parseSubscription`으로 모양을 검사한 것만 저장하고(키 2개, 주소는 https이면서 **실제 푸시 서비스 도메인**(fcm.googleapis.com, *.push.apple.com, *.push.services.mozilla.com, *.notify.windows.com)이고 포트 지정이 없는 것만 — 아무 주소나 받으면 우리 서버가 남의 서버로 요청을 보내는 중계기가 되므로, 2026-10-28 보안 점검), 같은 기기는 하나만 둔다. 해제(DELETE)는 실제로 지운 게 있을 때만 저장한다.
- **보내기** (`app/api/push/send/route.ts` → `lib/push-send.ts`): `Authorization: Bearer <PUSH_CRON_SECRET>` 헤더가 맞을 때만 동작(주소에 비밀 값을 넣으면 로그에 남으므로 헤더만). 지금이 알림 시각(한국 시간 시 단위)이 아니면 보내지 않는다(`?force=1`이면 보낸다). 모든 구독에 `web-push`로 고정 문구를 보내고, 404·410(기기가 구독을 끊음)은 목록에서 지운다. TTL 1시간.
- **시험** (`app/api/push/test/route.ts`): 카드의 "Send a test". 그 기기의 endpoint를 알아야만 보낼 수 있다.
- **끄기**: `DELETE /api/push/subscribe`가 성공한 뒤에만 브라우저 구독을 해제한다. 서버에서 못 지웠으면 구독을 그대로 두고 "못 껐다"고 안내한다(풀어 버리면 서버에는 남아 알림이 계속 가므로, 2026-10-27). 브라우저 구독 해제 자체가 실패하는 것은 무시한다(다음 보내기 때 404·410으로 정리된다).
- **표시** (`public/sw.js`): `push` 이벤트에서 제목·본문·아이콘(`icon-192.png`)·배지(`badge-96.png`, 안드로이드)·tag로 알림을 띄우고, `notificationclick`에서 열린 창이 있으면 그 창을 `/review`로, 없으면 새 창을 연다. `next.config.ts`가 `/sw.js`에 캐시 금지 헤더를 붙여 항상 최신 워커를 받게 한다.
- **테스트** (`lib/push.test.ts`, 7개): 시각별 문구(1st~5th, 그 밖에는 "Time for a round"), 회차 번호와 서수, 시각 판정(KST), 구독 검사, 중복 제거, 상한 10개, 저장 파일 읽기. 저장·전송 코드는 바깥 서비스를 쓰므로 단위 테스트가 없고, 배포 뒤 폰에서 확인한다(PLAN 26).

### 13.4 비밀 값 (`.env`와 Vercel 환경 변수, 값은 적지 않는다)

| 이름 | 어디서 쓰나 | 설명 |
|---|---|---|
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | 화면·서버 | 알림 서명 공개 키. 화면 코드에 들어가도 된다 |
| `VAPID_PRIVATE_KEY` | 서버 | 알림 서명 비밀 키 |
| `VAPID_SUBJECT` | 서버 | 서명에 넣는 서비스 식별 주소. **배포 주소(https)** 를 쓴다. 이메일은 쓰지 않는다. 애플은 `https://localhost`를 거부한다 |
| `PUSH_CRON_SECRET` | 서버·cron-job.org | 예약 서비스가 `/api/push/send`를 부를 때의 비밀 값 |
| `BLOB_READ_WRITE_TOKEN` | 서버 | Vercel Blob 저장소 토큰. Blob 저장소를 프로젝트에 연결하면 Vercel이 넣어 준다 |

키 한 쌍과 비밀 값은 2026-10-26에 만들어 `.env`에 넣었다(`web-push`의 `generateVAPIDKeys`, 무작위 24바이트). `VAPID_SUBJECT`에는 임시로 예상 배포 주소를 넣어 두어 개발 컴퓨터에서도 시험 알림이 503 없이 동작하며, 배포 주소가 정해지면 그 값으로 바꾼다(13.5 1단계).

### 13.5 배포 뒤 설정 순서 (PLAN 26)

1. Vercel 프로젝트 설정 → Environment Variables에 `.env`의 푸시 값 4개를 등록한다(`VAPID_SUBJECT`는 배포 주소로).
2. Vercel 프로젝트 → Storage → Blob 저장소를 하나 만들어 연결한다(`BLOB_READ_WRITE_TOKEN`이 자동 등록됨). 만들 때 접근을 **Private**로 정한다. 접근 방식은 나중에 바꿀 수 없고, 코드가 `access: "private"`로 읽고 쓰므로 공개 저장소로 만들면 저장이 실패한다(Vercel 문서 확인, 2026-10-26. `@vercel/blob` 2.3 이상 필요, 지금 2.8).
3. 다시 배포한다(환경 변수는 새 배포부터 적용). 환경 변수를 넣기 전에는 Today의 알림 띠가 "Reminders are not set up on this server yet."을 보인다.
4. cron-job.org에 가입해 예약 5개를 만든다: 주소 `https://<배포 주소>/api/push/send`, 방식 GET, 시간대 Asia/Seoul, 시각 9·11·13·17·19시 00분, 헤더 `Authorization: Bearer <PUSH_CRON_SECRET>`. 실패 알림 메일을 켠다.
5. 아이폰: 사파리로 배포 주소를 열어 홈 화면에 추가 → 그 아이콘으로 열기 → Today의 "Turn on reminders" → 허용 → "Send a test"로 알림이 오는지 본다.

### 13.6 한계와 확인할 것

- 아이폰은 홈 화면 아이콘으로 열었을 때만 켤 수 있고(iOS 16.4 이상), 사파리 탭에서는 "홈 화면에 추가" 안내만 보인다.
- cron-job.org가 몇 분 늦게 부를 수 있다. 서버는 "그 시각(시 단위)"만 확인하므로 59분까지는 보낸다.
- 알림을 끄지 않고 홈 화면 아이콘을 지우면 구독이 남는다. 다음 보내기 때 애플이 404·410을 돌려주면 서버가 지운다.
- 구독 등록(`POST /api/push/subscribe`)은 인증 없이 누구나 부를 수 있다. 배포 주소를 아는 사람이 알림을 켜면 그 사람도 알림을 받는다. 혼자 쓰는 앱이라 감수하되, 목록 상한을 10개(확정)로 두어(넘으면 409) 저장 파일이 커지는 것은 막는다(2026-10-26). 다른 사람이 10개를 채워 내 새 기기가 거부되면, Vercel 대시보드 → Storage → Blob에서 `push/subscriptions.json`을 지운다. 이미 켜 둔 기기는 "Send a test"를 누르면 서버가 404를 돌려주고 띠가 꺼진 상태로 돌아가므로, 그 자리에서 다시 켠다(2026-10-27).
- 개발 컴퓨터의 브라우저 창(Claude 미리보기)은 알림 권한이 막혀 있어 "Notifications are blocked" 상태까지만 확인했다. 실제 수신은 배포 뒤 폰에서 확인한다.

## 변경 이력

| 버전 | 날짜 | 내용 | 작성자 |
|---|---|---|---|
| 0.1 | 2026-10-25 | 첫 작성 (PLAN 기준: 화면 구성·데이터 흐름·기술 선택, 데이터 모델, 예문 구조, 폴더 구조) | Iron man |
| 0.2 | 2026-10-25 | 설계 교차 검토 반영: 실제 폴더 구조, VOA 모음 자료형, 배포 방식(Vercel CLI), 단어 유출 지점, 빈도 목록 출처·변환 | Iron man |
| 0.3 | 2026-10-26 | 6.6 수준 규칙 숫자 확정(PLAN 22번)과 조정 기록, 10번 1-3 완료, 테스트 수 100개, 변경 이력 추가 | Iron man |
| 0.4 | 2026-10-26 | 교차 검토 2회 반영: 다크 모드 원칙, 사전 예문 처리를 코드대로, 예문 id 설명, 모음 걸러내기 규칙과 알려진 빈틈, 수준 규칙의 한계 두 가지 명시, 후보 수 차이 설명, 불규칙형 표 135개, 10번 1·1-2·6 갱신, .env 설명 | Iron man |
| 0.5 | 2026-10-26 | 교차 검토 3회 반영: 깨진 데이터 사본 키와 초기화, 예문 제공률에서 빠지는 응답, 백업 파일의 백업 시각, 모음 걸러내기 규칙을 코드대로, 수집 시간 재계산, 색 규칙 범위, 글자 하나 이상 규칙, 10번 1-1 시점, 9장 public·README. 진행 상태 읽기 보호(NaN/5 방지), 테스트 101개 | Iron man |
| 0.6 | 2026-10-26 | 푸시 알림 13장 추가(결정·알림 모양·흐름·비밀 값·설정 순서·한계), 0.2~0.4·2장·9장·12장 갱신, 테스트 106개 | Iron man |
| 0.7 | 2026-10-26 | Reminders 카드: 켠 뒤 한 줄로 줄임 (0.2, 13.3). 알림 문구를 "Time for Nth round"로 (13.1, 13.2). 카드를 제목·시각 없는 한 줄 띠(종 아이콘 + 알약 버튼)로 | Iron man |
| 0.8 | 2026-10-26 | 아이콘을 흰 바탕 핀 스트라이프 + W로 바꾸고 알림 배지 badge-96.png 추가 (2장, 9장, 13.2). W는 Playfair Display 900 글꼴 파일에서 읽어 그림(opentype.js, 개발용) | Iron man |
| 0.9 | 2026-10-26 | 교차 검토 4회 반영: 서버로 가는 데이터에 구독 정보 명시(0.1·0.3·1장), NEXT_PUBLIC_ 예외, 알림 띠 상태·안내 줄, 알림 시각 고정 확정, 구독 상한 10개(13.6), 배지·opentype.js 설명, 테스트 계획·체크리스트에 알림, 테스트 108개 | Iron man |
| 1.0 | 2026-10-26 | 교차 검토 5회 반영: .vercelignore(11장·9장), 전체 초기화가 알림도 끔(0.3·8장), Blob은 Private로(13.5), 상한 찼을 때 푸는 방법(13.6), VAPID_SUBJECT 임시 값(13.4), 0.2 띠 상태, L1에 503·off_hours, ⑥에 시험 알림 | Iron man |
| 1.1 | 2026-10-27 | Gap 분석 높음·중간 4건 반영: 시험 알림 실패를 410·502로 돌려주고 화면이 꺼진 상태로 복귀, 켜기 중 네트워크 예외도 구독 되돌림, data 없는 백업 파일 거부, 13.6 복구 절차를 화면 동작에 맞춤 | Iron man |
| 1.2 | 2026-10-27 | Gap 낮음 3건 반영: 자정 넘김 때 N/5 자동 갱신(5.1), 깨진 기록·목록·진행 중 회차 걸러내기(4장), 저장 실패 공통 경고(4장·9장) | Iron man |
| 1.3 | 2026-10-27 | PLAN 24 점검: 통신사 크레디트 규칙 보강과 모음 2개 제거(6.4·10번 1·1-1), 백업 왕복·자정 넘김은 테스트로 확인 | Iron man |
| 1.4 | 2026-10-27 | Gap 2차 20건 반영: 철자 변형 규칙과 모음 1개 더 제거(6.4·10번), 진행 중 회차 조건(4장), 가져온 단어 검사(8장), 아포스트로피(3장·7장), 끄기 응답 확인(13.3), 아이패드(13.3), 5.1 판정 순서, 예문 캐시·오프라인·다른 예문 중 기록(6.2) | Iron man |
| 1.5 | 2026-10-28 | 공개 전 보안 점검 7건 반영: 구독 주소를 푸시 서비스 도메인으로 제한(13.3), 해제 때 변경 있을 때만 저장, 전송 10초 timeout, 보안 헤더(11장), 사전 출처 주소 https 검사와 User-Agent(6.3), .gitignore에 .claude/ | Iron man |
| 1.6 | 2026-10-28 | UX 개선: Still Learning 탭에 쌓인 단어 수 표시 (0.2, 2장) | Iron man |
| 1.7 | 2026-10-28 | UX 개선: 단어장 각 줄에 복습 상태 글자 (0.2) | Iron man |
| 1.8 | 2026-10-28 | UX 개선: 회차 요약에 단어 3개와 결과 표시 (0.2) | Iron man |
| 1.9 | 2026-10-29 | UX 개선: 단어장에 상태 필터(All / Still learning / Looked up) (0.2) | Iron man |
| 2.0 | 2026-10-29 | UX 개선: 복습 화면 단어 아래 이력 한 줄 (0.2) | Iron man |
| 2.1 | 2026-10-29 | UX 개선: 백업 화면 마지막 백업을 "N days ago"로 (0.2), 테스트 115개 | Iron man |
| 2.2 | 2026-10-29 | UX 개선: 단어 추가 버튼에 추가될 수와 건너뛸 수 미리 보기 (0.2) | Iron man |
| 2.3 | 2026-10-30 | UX 개선: 단어장 상태 필터에 Remembered 단추 추가, 네 개 한 줄 배열, 단추를 상태색(황·빨강·녹)으로 (0.2) | Iron man |
