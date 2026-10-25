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
| **SUCCESS** | 4주 뒤 기억률 70%, 주 5일 × 하루 4회 이상, 예문 제공률 60% |
| **SCOPE** | must(단어장·복습·예문) 완료 → nice(Still Learning·통계·발음·백업) 완료 → 배포·폰 확인·빈도 목록·모음 확대·예외 점검 |

## 0. 설계 개요

### 0.1 설계 목표와 원칙

- **서버 없이 돌아가는 앱**: 학습 기록은 브라우저 `localStorage`에만 두고, 서버는 예문 하나를 찾아 주는 일만 한다. 계정·DB·로그인이 없다.
- **순수 로직과 화면의 분리**: 규칙(단어 검사, 회차, 어려운 단어, 예문 고르기, 통계)은 `lib/`에 브라우저와 무관한 함수로 두고 `node:test`로 검증한다. 화면(`app/`)은 그 함수를 부르기만 한다.
- **출처를 갈아 끼울 수 있는 예문**: 예문 출처 순서(VOA 모음 → 사전 → 없음)는 `lib/examples.ts` 한 곳에만 있다.
- **한 번에 한 가지 결정**: 숫자(가중치, 상한, 기간)는 PRD에 확정/제안값을 구분해 적고, 코드에는 상수로 둔다.

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
│  N/5    A–Z        !         │  ← app/tab-bar.tsx (fixed, safe-area 여백)
│ Today  Word List  Still L.   │
└──────────────────────────────┘
```

| 탭 / 주소 | 위에서 아래로 보이는 것 | 파일 |
|---|---|---|
| **Today** `/` | 제목 "Today" · 설명 한 줄 · 카드[오늘 횟수 N/5, 버튼: Start review / Continue review / Done for today] | `app/page.tsx`, `app/today-progress.tsx` |
| **복습** `/review` (Today 탭에 속함) | 제목 "Review"와 오른쪽 "Today N/5" · "k / 3" · 단어(크게) + 스피커 버튼 · 예문 카드[앞문장 흐리게, 문장(단어 강조), 뒷문장, 출처·라이선스, Another example] · "Does it ring a bell?" · 버튼 2개 [I remember / Look it up] · 안내 두 줄. Look it up 뒤에는 버튼이 [Open Google / Next]로 바뀜. 회차 끝: 요약 카드[Round complete!, N/5, (어제로 계산됨), Still Learning 추가·제외, One more round / Home] | `app/review/page.tsx`, `example-card.tsx`, `speak-button.tsx`, `example-cache.ts` |
| **Word List** `/words` | 제목 "Word list"와 오른쪽 [Backup] · (조건부) 백업 안내 카드[Back up now / Remind me in 7 days] · 여러 줄 입력칸 · 안내 · [Add] · 결과 안내와 건너뛴 목록(10개까지) · "Your words N"과 검색 칸 · 알파벳 순 목록(각 줄: 단어, Delete) | `app/words/page.tsx`, `app/backup-notice.tsx` |
| **Still Learning** `/hard` | 제목과 오른쪽 [Stats] · 설명 · "Still learning N"과 검색 칸 · 최근 순 목록(각 줄: 단어, 누적 횟수·연속 횟수·날짜, Remove) · 비어 있으면 안내와 [Start review] | `app/hard/page.tsx` |
| **Stats** `/stats` | 제목 "Stats" · "Day N" 머리말 · 카드 4장 2×2[Rounds this week / Active days x/28 / Remembered % / Examples shown %], 각각 목표 설명 | `app/stats/page.tsx` |
| **Backup** `/backup` | 제목 · 설명 · 카드[Export: N words, last backup, 버튼] · 카드[Import: 파일 선택 버튼] · 빨간 테두리 카드[Delete all data…] | `app/backup/page.tsx` |

### 0.3 데이터 흐름 — 입력 → 처리 → 출력

```
① 단어 등록
   입력칸 글자 ─▶ splitInput(줄바꿈·쉼표로 나눔) ─▶ validateWord(글자·길이·중복) ─▶ addWords
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

④ 통계
   저장본(words, logs, rounds, firstUsedAt) ─▶ stats.ts(주간 횟수, 28일 활동일, 기억률, 예문 제공률) ─▶ 카드 4장 (저장하지 않고 볼 때마다 계산)

⑤ 백업
   내보내기: 저장본 전체 ─▶ makeBackup({app, version, exportedAt, data}) ─▶ 공유 시트 또는 .json 다운로드 ─▶ lastBackupAt 기록
   가져오기: 파일 ─▶ parseBackup(앱 확인·버전·내용 검사) ─▶ 확인 창 ─▶ 저장본 전체 교체
   초기화: 확인 창 ─▶ "DELETE" 입력 ─▶ 저장소 키 삭제
```

데이터가 기기 밖으로 나가는 지점은 ③의 "단어 한 개"뿐이다. ①②④⑤는 모두 브라우저 안에서 끝난다.

### 0.4 기술 선택 — Next.js를 기본으로, 그 위에 쓰는 것

Vercel 배포를 위해 **Next.js 16**을 기본으로 쓴다. 그 위에 실제로 쓰고 있는 기술과, 비개발자 눈높이의 한 줄 설명이다.

| 기술 | 쓰는 곳 | 쉬운 설명 (한 줄) | 상태 |
|---|---|---|---|
| **Next.js 16** (App Router) | 모든 화면과 `/api/example` | 화면과 작은 서버 기능을 한 프로젝트에 넣어 Vercel에 그대로 올릴 수 있게 해 주는 틀 | 사용 중 |
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
| **node:test** | 단위 테스트 | Node.js에 들어 있는 테스트 도구. 추가 설치 없이 `npm test`로 규칙 92개를 검사 | 사용 중 |
| **ESLint** | 코드 검사 | 흔한 실수와 규칙 위반을 찾아 주는 검사기. `npm run lint` | 사용 중 |
| **Vercel** | 배포 | 코드를 올리면 인터넷 주소를 만들어 주는 서비스. Next.js를 만든 회사라 설정이 거의 없다 | 배포 예정 |

**추가로 제안하는 기술 (지금은 필요 없음, 나중에 고려)**

| 기술 | 언제 | 쉬운 설명 (한 줄) |
|---|---|---|
| **Playwright** | PLAN 24번 예외 점검 때 | 사람 대신 브라우저를 눌러 보며 화면 흐름을 자동으로 검사하는 도구. 지금은 제가 직접 눌러 확인 |
| **서비스 워커 (오프라인 캐시)** | 폰에서 오프라인 사용이 자주 필요해지면 | 앱 파일을 폰에 복사해 두어 인터넷 없이도 열리게 하는 기능. 지금은 "열어 둔 상태"에서만 오프라인 동작 |
| **단어 빈도 목록** (`data/word-freq.json`) | PLAN 21번 | 영어 단어가 얼마나 흔한지 순위를 적은 표. 이게 있어야 "예문이 단어보다 어렵지 않게" 규칙이 켜진다 |

지금 PRD의 기능은 위 "사용 중" 기술만으로 모두 만들 수 있다. 데이터베이스, 로그인 서비스, 결제, 분석 도구는 필요 없다.

### 0.5 화면 체크리스트 (빠짐 검사용)

- **Today**: 오늘 횟수 N/5 · 상태별 버튼 1개(Start review / Continue review / Done for today / Add words first)
- **Review**: 진행 k/3 · 단어 · 스피커 버튼(지원 시) · 예문 카드(강조·출처·Another example 또는 No more examples·오프라인 문구) · I remember / Look it up · Look it up 뒤 Open Google / Next · 요약(횟수, 어제 계산 안내, 추가·제외 단어, One more round / Home) · 빈 단어장 안내 · 5회 완료 안내
- **Word List**: Backup 링크 · 백업 안내(조건부, 7일 미루기) · 여러 줄 입력 · Add · 결과 안내 · 건너뛴 목록(10개 + and N more) · 검색 · 단어 수 · 알파벳 목록 · Delete(확인 창)
- **Still Learning**: Stats 링크 · 검색 · 개수 · 최근 순 목록(단어·횟수·날짜) · Remove(확인 창) · 빈 상태 안내
- **Stats**: Day N · Rounds this week · Active days x/28 · Remembered % · Examples shown %(데이터 부족 문구)
- **Backup**: 단어 수·마지막 백업 · Export · Import(파일 선택, 확인 창, 결과 안내) · Delete all data(확인 창 + DELETE 입력)

### 0.6 테스트 계획

| 단계 | 대상 | 방법 | 지금 상태 |
|---|---|---|---|
| L0 단위 | `lib/*.ts` 규칙 전부 | `npm test` (node:test, 92개) | 자동 |
| L1 API | `/api/example` 정상·400·없음 | `curl` 또는 브라우저 | 수동 (개발 중 확인) |
| L2 화면 | 0.5 체크리스트 | 내장 브라우저에서 눌러 확인 | 수동 |
| L3 흐름 | 단어 등록 → 복습 3단어 → 요약 → Still Learning → 통계 → 백업 왕복 | 폰에서 직접 | PLAN 19~20·24번 |

## 1. 한눈에 보기

스마트폰 브라우저에서 쓰는 Next.js 웹 앱이다. 사용자가 **단어장**에 영어 단어를 입력하면, 앱이 하루 최대 5번, 한 번에 3단어씩 **영어 예문**(VOA 기사, 없으면 사전 예문)과 함께 "아는지" 묻는다.

| 구분 | 어디서 처리하나 | 하는 일 |
|---|---|---|
| 화면 | 브라우저 (Next.js 클라이언트 컴포넌트) | 단어장, 복습, 목록, 통계, 백업 화면 |
| 데이터 저장 | 브라우저 `localStorage` | 단어장, 응답 기록, 어려운 단어 목록, 진행 상태 |
| 예문 가져오기 | Next.js 서버 (`/api/example`) | VOA 문장 모음에서 찾기, 없으면 Free Dictionary API 호출 |

핵심 원칙 두 가지는 이렇다.

- **학습 기록은 서버로 보내지 않는다.** 서버로 가는 것은 예문 검색용 영어 단어 하나뿐이다.
- **기사 전체는 브라우저로 보내지 않는다.** 서버에서 문장을 뽑아 최대 2문장만 내려준다.

## 2. 화면 구성

| 주소 | 화면 | 기획서 근거 |
|---|---|---|
| `/` | 홈(Today 탭): 오늘 복습 횟수 N/5, '복습 시작/이어서 하기/오늘 완료' 버튼 | 5번 ②, 4번 |
| `/words` | **단어장**(Word List 탭): 여러 줄 입력칸, 알파벳 순 목록, 검색, 삭제, Backup 링크, 백업 안내 | 5번 ① |
| `/review` | 복습: 한 화면에 한 단어, 예문, I remember / Look it up, 회차 요약 | 5번 ② |
| `/hard` | 어려운 단어 목록(Still Learning 탭): 보기·검색·삭제, Stats 링크 | nice |
| `/stats` | 통계 4가지 | nice |
| `/backup` | 내보내기·가져오기·전체 초기화 | nice |

- 스마트폰 세로 화면(가로 375px)을 기준으로 만들고, 가로 스크롤이 생기지 않게 한다. (자세한 배치는 0.2)
- **앱 화면의 문구는 모두 영어로 쓴다** (2026-10-25 결정). 문서(PRD, DESIGN)와 코드 주석은 한국어다.
- **디자인은 핀 스트라이프 유니폼 느낌**이다 (2026-10-25 결정): 네이비(`#0c2340`)와 흰색, 바탕에 가는 세로 줄무늬, 상단에 네이비 띠, 글은 흰 패널 위에. 색과 줄무늬는 `app/globals.css` 한 곳에서 정한다. 구단 로고·이름 같은 상표는 쓰지 않는다.
- **글꼴** (2026-10-25 결정, 모두 Google Fonts, `app/layout.tsx`에서 `next/font/google`로 불러옴): 제목·헤더는 **Playfair Display**(복습 화면의 단어 자체는 Inter 그대로)(700·900, 하이컨트라스트 세리프), 본문·버튼·라벨은 **Inter**(없으면 시스템 글꼴), 숫자·스코어·통계는 **Oswald**(500·600, 스코어보드 느낌). Tailwind 클래스는 `font-display`, `font-sans`, `font-score`.
- must는 `/`, `/words`, `/review` 세 화면이다. 나머지는 must를 먼저 끝낸 뒤에 만든다.
- **하단 탭 바** (2026-10-25 결정, `app/tab-bar.tsx`): Today(`/`, 복습 화면 `/review` 포함) · Word List(`/words`) · Still Learning(`/hard`, 어려운 단어 목록) 세 탭. 모든 화면에 고정으로 붙고, 누르면 바로 이동한다.

**홈 화면 추가(PWA)**: `app/manifest.ts`(이름, 전체화면 `standalone`, 색), `public/icon-192.png`·`icon-512.png`·`apple-touch-icon.png`(`scripts/make-icons.mjs`가 만드는 네이비 핀 스트라이프 아이콘), 레이아웃의 `appleWebApp`·`viewportFit: cover`. 서비스 워커(오프라인 캐시)는 두지 않는다. 오프라인이면 예문 카드에 "Offline – examples need an internet connection."을 보여준다.

## 3. 단어장

단어장은 복습과 분리된 독립 화면이며, 모든 단어의 원본 목록이다.

**입력 검사 (순서대로)**
1. 앞뒤 공백을 지운다.
2. 영문자, 하이픈(-), 아포스트로피(')만 남아 있는지 본다. 숫자와 중간 공백이 있으면 거부한다.
3. 길이가 1~30자인지 본다.
4. 소문자로 바꾼 값이 이미 있는지 본다. 있으면 저장하지 않고 "이미 단어장에 있는 단어입니다"를 보여준다.
5. 통과하면 저장한다. 저장 순서는 입력 순서이지만, 화면 목록은 알파벳 순으로 정렬해 보여준다 (2026-10-25 결정). 목록 위의 검색 칸에 글자를 넣으면 그 글자가 들어 있는 단어만 바로 걸러 보여준다(저장과 무관한 화면 상태).

**여러 단어를 한꺼번에**: 입력칸은 여러 줄이다. 줄바꿈, 쉼표, 세미콜론으로 나눈 조각마다 위 검사를 차례로 하고, 통과한 것만 입력한 순서대로 목록 맨 위에 추가한다. 같은 입력 안의 중복도 걸러낸다. 건너뛴 조각은 이유와 함께 보여주고 입력칸에 남겨서 바로 고칠 수 있게 한다. 띄어쓰기로는 나누지 않는다(`ice cream`이 조용히 두 단어가 되는 것을 막기 위해). 구현은 `addWords`(`lib/store.ts`), 나누는 함수는 `splitInput`(`lib/words.ts`).

**저장하는 형태**: 단어는 소문자로 바꾼 값(`text`)으로 저장한다. 그래야 `Apple`과 `apple`이 하나로 취급된다.

**삭제**: 단어를 지우면 그 단어의 응답 기록과 어려운 단어 목록 항목도 같이 지운다. (기획서에 없던 부분이라 이 문서에서 정했다. 10번 참고)

## 4. 데이터 모델

모두 `localStorage` 한 키(`wordsmart:v1`)에 JSON으로 저장한다.

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
type Log = { wordId: string; at: string; answer: Answer; example?: ExampleKind };  // example: 답할 때 예문이 있었는지 (예문 제공률 통계용)

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
  firstUsedAt?: string;  // 앱을 처음 쓴 시각. 처음 저장할 때 use-store가 채운다 (기억률 "4주 뒤" 기준)
  lastBackupAt?: string; backupSnoozedUntil?: string;  // 백업 안내용
};
```

## 5. 복습 동작

### 5.1 회차 시작
1. 한국 시간(KST)으로 오늘 날짜를 구한다. `progress.date`와 다르면 `completed`를 0으로 초기화한다.
2. 진행 중인 회차(`current`)가 있으면 이어서 한다.
3. `completed`가 5이면 '오늘 복습 완료'를 보여주고 시작하지 않는다.
4. 단어장이 비어 있으면 '단어를 먼저 등록해 주세요'를 보여준다.
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

**화면 문구**: 기획서의 "안다/모른다"는 데이터 값(`known`/`unknown`)의 이름이고, 화면에는 영어로 "Does it ring a bell?" 아래에 **I remember / Look it up** 버튼으로 보여준다. 'Look it up'이 구글 검색 탭을 여는 동작과 맞기 때문이다. 나머지 안내 문구는 한국어다.

**구현 메모** (`lib/quiz.ts`, `app/review/page.tsx`)
- `/review`에 들어오면 진행 중인 회차가 없을 때 자동으로 시작한다. 홈의 '복습 시작'은 이 화면으로 가는 링크다.
- 자정을 넘겨 끝난 회차는 시작한 날로 센다: 회차의 `startedAt`이 오늘(KST)이 아니면 오늘 `completed`에 더하지 않는다.
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
2. **Free Dictionary API**: 모음에 없을 때만 서버가 호출하는 사전 예문 (키 불필요)
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
잘못된 단어(단어장 규칙 위반)는 400으로 거부한다. 화면은 회차가 시작되면 3단어의 예문을 한꺼번에 요청해 캐시(`app/review/example-cache.ts`)에 두고, 회차가 끝나면 비운다.
`skip`은 '다른 예문 보기'를 눌렀을 때 이미 본 예문을 빼기 위한 값이다. 더 찾았는데 없으면(`ok: false`) 화면은 마지막 예문을 그대로 두고 "No more examples"만 표시한다(`example-cache`의 `exhausted`). 한 단어당 '다른 예문 보기'는 5번까지(`MAX_ANOTHER`)이며, 넘으면 요청하지 않고 같은 표시를 한다.

### 6.3 서버가 하는 일 (순서대로)
1. `word`를 단어장 입력 검사(3번)와 같은 규칙으로 검사한다. 맞지 않으면 거부한다.
2. VOA 문장 모음에서 단어 또는 그 변화형(7번)이 든 문장을 찾는다. `skip`에 있는 것은 빼고, **문장 수준이 단어 수준 이하인 것만 남긴다**(6.6).
3. 찾았으면 무작위로 하나 고르고, 그 문장의 앞 문장과 뒷 문장 중 **더 긴 쪽**을 붙인다. 합쳐서 300자를 넘으면 다른 쪽을 쓰고, 둘 다 넘으면 찾은 문장만 쓴다. 한쪽이 없으면 있는 쪽만 쓴다.
4. 못 찾았으면 `https://api.dictionaryapi.dev/api/v2/entries/en/<단어>`를 호출해 `example`이 있는 항목 중 **수준이 맞는 것**(6.6) 하나를 고른다. 응답의 `license`와 `sourceUrls`를 출처로 같이 돌려준다.
5. 그래도 없거나, 사전 서비스가 오류(530 등)를 내거나 네트워크가 끊기면 `{ ok: false }`를 돌려준다. 예문을 지어내지 않는다.

### 6.4 VOA 문장 모음 만들기

개발 컴퓨터에서 직접 실행하는 스크립트(`scripts/build-voa-corpus.mjs`)로 만들고, 결과를 `data/voa-sentences.json`에 저장한다. 배포한 서버에서는 실행하지 않는다.

```ts
type VoaSentence = { id: string; text: string; prev?: string; next?: string; url: string; level: number };  // level: 6.6의 문장 수준(1~5)
```

**지켜야 할 규칙**
- VOA 사이트의 검색 기능(`/s?k=`)은 자동 접속이 금지(`robots.txt`)라서 쓰지 않는다. 공개된 `sitemap.xml`로 기사 주소를 얻는다.
- 요청은 1초 이상 간격을 두고 보내고, 식별 가능한 이름(`User-Agent`)을 붙인다. 개인 연락처(이메일 등)는 넣지 않는다.
- 통신사(AP, Reuters, AFP) 기사는 넣지 않는다. 소설 낭독, 팟캐스트 안내처럼 기사가 아닌 페이지도 뺀다.
- 기사 주소는 `/a/<제목-슬러그>/<번호>.html` 꼴만 쓴다. 슬러그가 없는 `/a/<번호>.html`은 생방송·영상 페이지라 본문이 없고, `learning-english-podcast` 슬러그는 팟캐스트 안내라 뺀다. 번호가 클수록 최근 기사다. (2026-10-25 확인: 전체 67,359개 중 슬러그 있는 주소 32,737개)
- 기사 본문의 문단(`<div class="wsw">` 안의 `<p>`)만 뽑아 문장으로 나누고, 각 문장에 원문 링크를 붙인다. 사진 설명(`<figcaption>`, 이미지 `alt`), 사인오프("I'm Jill Robbins."), `____` 구분선 뒤의 단어 풀이(Words in This Story), 프로그램 인사말("And now Words and Their Stories…")은 뽑지 않는다.
- 저장 형태는 기사별 문장 배열이다 (`{ url, title, sentences: string[] }`). 앞뒤 문장은 이웃 원소이고, 예문 id는 `voa:<기사 번호>:<문장 번호>`다. 수준(`level`)은 미리 저장하지 않고 요청할 때 계산한다(빈도 목록을 바꿔도 모음을 다시 만들 필요가 없도록).
- **통신사 기사 구분 규칙** (기사 12개로 확인, 2026-10-25): 통신사 표기는 사진 설명의 `(AP Photo/...)`와 본문 중간의 **짧은 크레디트 문단** 두 군데에 나온다. 사진 설명은 사진 저작자 표시일 뿐이라 기사를 제외할 이유가 아니다. 제외 기준은 크레디트 문단이다.
  - 제외하는 형태: `... reported (on) this story for (The) Associated Press. ... adapted it for VOA Learning English.` / `... wrote this story for The Associated Press. ... adapted it for VOA Learning English.` / `... Additional reporting came from The Associated Press.`
  - 남기는 형태: `... wrote this story/report for Learning English.` (VOA 자체 기사)
  - 규칙: 260자 이하의 문단 중 `(reported|wrote) ... for (The )?(Associated Press|Reuters|AFP|Agence France-Presse)`, `adapted it for VOA`, `Additional reporting came from ... (Associated Press|Reuters|AFP)` 중 하나라도 맞으면 그 기사 전체를 제외한다. "adapted it for VOA"만 있는 경우도 다른 매체를 고쳐 쓴 것으로 보고 제외한다(보수적 판단).
  - 본문 문단이 2개 이하인 페이지(영상·팟캐스트 안내 등)와 제목이 "Learning English Podcast"인 페이지도 뺀다.
- VOA Learning English의 텍스트는 퍼블릭 도메인이라 보관 기간 제한이 없다.

**현재 사정 (2026-10-25 확인)**: 사이트맵에 기사 주소가 67,359개다. 1초에 1개씩 받으면 모두 받는 데 약 19시간이 걸리므로, 최근 기사 일부부터 모으는 것으로 시작한다. (범위와 파일 크기는 10번)

### 6.5 미리 불러오기
복습을 시작하면 3단어의 예문을 한꺼번에 요청하고, 도착하는 대로 보여준다. VOA 모음은 서버 안의 검색이라 빠르고, 사전 호출만 시간이 걸린다.

### 6.6 예문 수준 맞추기

예문이 묻는 단어보다 어려우면 안 된다. 단어와 문장의 수준을 같은 자로 재서 비교한다. **통과 조건(문장 수준 ≤ 단어 수준)은 2026-10-25에 확정했다. 5단계의 경계와 "어려운 쪽 10% 제외", "25단어 초과 시 +1" 같은 숫자는 제안값이며, 실제 예문을 몇십 개 보면서 조정한다.**

**자로 쓰는 것: 단어 사용 빈도 순위** (영어에서 얼마나 흔히 쓰이는 단어인가). 순위가 낮을수록(흔할수록) 쉬운 단어다.

| 수준 | 빈도 순위 (제안값) | 예 |
|---|---|---|
| 1 | 1 ~ 2,000위 | run, economy |
| 2 | 2,001 ~ 5,000위 | challenge, support |
| 3 | 5,001 ~ 10,000위 | plausible, reluctant |
| 4 | 10,001 ~ 20,000위 | ubiquitous, ephemeral |
| 5 | 그 밖이거나 목록에 없음 | 아주 드문 단어 |

**단어 수준**: 단어장 단어의 기본형(`run`, `hinder`)이 속하는 수준. 목록에 없으면 5.

**문장 수준** (예문 하나에 대해)
1. 문장을 단어로 나누고 어미 변화를 기본형으로 되돌린다.
2. **묻는 단어(와 변화형)는 뺀다.** 묻는 단어가 어려운 것은 당연하기 때문이다.
3. 고유명사(문장 중간의 대문자 단어)와 숫자도 뺀다. 사람 이름이나 지명 때문에 문장이 어렵다고 나오지 않게 하기 위해서다.
4. 남은 단어들의 수준을 구하고, **어려운 쪽 10%를 뺀 가장 높은 수준**을 문장 수준으로 한다. (드문 단어가 하나 섞인 것까지 막지는 않는다.)
5. 문장이 **25단어를 넘으면 수준을 1 올린다** (길이도 어려움에 반영).
6. 앞뒤 문장을 붙인 예문은 붙인 전체로 계산한다.

**통과 조건**: `문장 수준 ≤ 단어 수준`
- 수준 1 단어(run)에는 수준 1 문장만 쓴다. 수준 4 단어(ubiquitous)에는 수준 4 이하 문장을 쓴다.
- 문장이 단어보다 쉬운 것은 괜찮다. "너무 어려운 예문"을 막는 것이 목적이다.

**적용 위치**
- VOA 문장 모음: 각 문장의 수준을 **모음을 만들 때 미리 계산해 저장**한다(`level`). 서버는 단어 수준 이하인 문장만 후보로 삼는다.
- 사전 예문(Free Dictionary): 호출할 때마다 같은 방법으로 계산한다. 보통 짧아서 대부분 통과한다.
- 앞뒤 문장을 붙인 결과가 기준을 넘으면 붙인 문장을 빼고 원래 문장만 쓴다(300자 규칙과 같은 방식). 원래 문장도 넘으면 그 예문은 쓰지 않는다.

**미리 알아둘 영향**: 수준이 낮은(흔한) 단어에는 VOA 문장이 많이 통과하고, 수준이 높은 단어는 VOA에서 애초에 드물어 "예문 없음"이 나올 가능성이 큽니다. 이 규칙 때문에 "예문 없음"이 더 늘 수 있다.

**빈도 목록**: `data/word-freq.json` (단어 → 순위)과 이를 쓰는 `lib/level.ts`를 둔다. 어떤 목록을 쓸지(출처, 라이선스, 단어 변화형 처리)는 10번에서 정한다. **목록이 비어 있는 동안(지금)은 수준을 알 수 없으므로 이 규칙은 꺼져 있고, 모든 예문이 통과한다.** 목록을 채우면 코드 변경 없이 규칙이 켜진다.

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
- 불규칙형: 자주 쓰는 불규칙 동사 표(`run → ran`, `go → went` 등)를 코드에 넣어 둔다. (표의 범위는 10번 참고)
- 고유명사 제외(PRD 5번 ②, `containsFormAsCommonWord`): 문장 중간에서 대문자로 시작하는 형태만 있는 문장은 후보에서 뺀다. 문장 첫머리의 대문자는 인정하므로 "Apple released…" 같은 경우는 걸러지지 않는다(한계, '다른 예문 보기'로 넘긴다).

## 8. 통계와 백업

**통계 화면** (`lib/stats.ts`, `app/stats/page.tsx`, Still Learning 화면 제목 옆의 Stats 링크) — 구현됨
- 끝낸 회차는 `store.rounds`에 `{ at, date }`로 쌓는다(`date`는 시작한 날의 KST 날짜). 회차 기록을 남기기 전 데이터를 위해 오늘 횟수는 `progress.completed`와 기록 중 큰 쪽을 쓴다.
- 이번 주 복습 횟수: 월~일(`kstWeekStart`) 안의 회차 수. 목표 20(하루 4회 × 5일).
- 최근 4주 복습한 날 수: 오늘 포함 28일 중 회차가 1회 이상 있는 날. 목표 20.
- 기억률: `firstAnswer === "unknown"`인 단어 중 `lastAnswer === "known"`인 비율. 대상이 없으면 "–".
- 예문 제공률: `example`이 기록된 최근 100건 중 `none`이 아닌 비율. 20건 미만이면 "Not enough data yet".
- 첫 사용일로부터 며칠째인지(`Day N`)를 머리말에 보여준다.

**백업 파일**: `{ app: "word-smart", version: 1, exportedAt, data: Store }` 형태의 JSON 파일. 이름은 `word-smart-backup-<KST 날짜>.json` (`lib/backup.ts`, 화면은 `app/backup/page.tsx`). — 구현됨
- 내보내기: `navigator.canShare({files})`가 되면 공유 시트, 아니면(또는 공유 실패) `<a download>`로 다운로드. 사용자가 공유를 취소하면(AbortError) 백업 시각을 남기지 않는다. 성공하면 `lastBackupAt`을 기록하고 미룸을 푼다.
- 가져오기: `parseBackup`이 JSON → `app === "word-smart"` → `version`(앱보다 크면 거부, 작으면 `migrate`로 변환) → `parseStore` 순으로 검사한다. 통과하면 단어 수와 내보낸 시각을 보여주는 확인 창을 거친 뒤 저장본 전체를 바꾼다(`useStore().replace`). 오늘의 진행 상태도 파일 것으로 바뀐다고 알린다.
- 백업 안내(Word List 화면, `app/backup-notice.tsx`; Backup 링크도 그 화면 제목 옆): `needsBackupReminder` = 단어 50개 초과 ∧ (백업 기록 없음 ∨ 14일 경과) ∧ 미룸 기간 아님. '7일 뒤에 다시'는 `backupSnoozedUntil`에 저장.
- 전체 초기화(백업 화면 맨 아래): 확인 창 → `prompt`에 `DELETE` 입력 → `useStore().reset()`이 저장소 키를 지운다.

## 9. 폴더 구조

```
app/
  page.tsx            홈
  words/page.tsx      단어장
  review/page.tsx     복습
  hard/page.tsx       어려운 단어 목록
  stats/page.tsx      통계
  backup/page.tsx     백업
  api/example/route.ts  예문 API (서버)
lib/
  store.ts            localStorage 읽기·쓰기, 버전 관리
  words.ts            입력 검사, 중복 걸러내기
  quiz.ts             단어 뽑기, 응답 처리, 어려운 단어 규칙
  kst.ts              한국 시간 날짜 계산
  forms.ts            단어 변화형 찾기·강조
  examples.ts         VOA 문장 모음 검색 + Free Dictionary 호출 (출처가 바뀌어도 여기만 고침)
  level.ts            단어·문장 수준 계산 (6.6)
scripts/
  build-voa-corpus.mjs  VOA 문장 모음 만들기 (개발 컴퓨터에서 직접 실행)
data/
  voa-sentences.json  VOA 문장 모음 (스크립트가 만듦)
  word-freq.json      단어 빈도 순위 목록 (수준 계산용)
.env                  지금은 비어 있음. 키가 필요한 서비스를 추가할 때 사용 (Git에 올리지 않음)
```

Next.js 규칙은 이 프로젝트에 설치된 버전의 문서(`node_modules/next/dist/docs/`)를 따른다. 예를 들어 예문 API는 `app/api/example/route.ts`에 `GET` 함수를 두는 방식이다.

## 10. 아직 정하지 못한 것

| # | 내용 | 언제 정하나 |
|---|---|---|
| 1 | **VOA 문장 모음의 범위.** 첫 모음(2026-10-25): 최근 기사 300개를 받아 **102개 유지, 3,252문장, 313KB**. 제외는 통신사 134, 본문 부족(too_short) 60, 팟캐스트 2, 퀴즈 1, 본문 없음 1. 통신사 기사가 절반이라 유지되는 기사는 받은 수의 1/3 정도다. 더 모을지(예: 1,000개 → 약 20분, 1MB 안팎), `too_short` 60개가 정말 짧은 글인지 추출 실수인지 확인할 것. | 적중률을 본 뒤 |
| 1-1 | **통신사 기사 구분 규칙의 검증.** 기사 12개로 표기 형태를 확인해 6.4에 규칙을 적었다. 다만 Reuters와 AFP 표기는 표본에 한 번도 나오지 않아 확인하지 못했고, 크레디트가 없는 통신사 기사가 있는지도 모른다. 모음을 만든 뒤 제외된 기사를 몇십 개 직접 훑어봐야 한다. | 모음을 만든 뒤 (필수) |
| 1-3 | **수준 계산의 재료와 숫자.** 빈도 순위 목록을 어디서 구할지(출처, 라이선스, 변화형 처리), 5단계 경계(2,000/5,000/10,000/20,000위), "어려운 쪽 10% 제외", "25단어 초과 시 +1"이 적절한지. 실제 예문 30~50개를 단어와 함께 보며 조정해야 한다. | 모음 스크립트를 만들 때 (필수) |
| 1-2 | **VOA 모음의 단어 적중률.** 표본 40개에서는 어려운 단어가 0건이었으나 표본이 너무 작다. 모음을 만든 뒤 단어장 단어의 몇 %가 걸리는지 재 본다. 낮으면 Wikinews를 앞쪽 출처로 추가할 수 있다. | 모음을 만든 뒤 |
| 2 | 불규칙 동사 표를 얼마나 넓게 할지 (지금 `lib/forms.ts`에 약 120개) | 예문을 쓰다 빠진 것이 보이면 추가 |
| ~~3~~ | 응답 기록 보관 기간 → **무제한으로 확정** (PRD 검토 4회) | 완료 |
| ~~4~~ | 단어 삭제 시 기록 삭제 → **PRD 5번 ①에 반영** (검토 3회) | 완료 |
| ~~5~~ | "1분 이내"에 예문 로딩 포함 → **포함으로 확정** (검토 4회) | 완료 |
| ~~6~~ | 테스트 도구 → **`node:test`로 확정**, 92개 작성 | 완료 |

## 11. 알아둘 점

- `localStorage`는 **주소마다 따로** 저장된다. 컴퓨터에서 띄운 `localhost` 주소와 Vercel에 배포한 주소는 서로 다른 단어장을 갖는다. 배포 주소를 바꾸면 기록이 사라지므로 백업 기능이 중요하다.
- 사파리는 오래 쓰지 않은 사이트의 저장 데이터를 지울 수 있다. 홈 화면에 추가해서 쓰면 도움이 될 수 있다. (제가 아는 범위의 내용이라 만들 때 다시 확인한다.)
- 지금 쓰는 예문 출처(VOA 모음, Free Dictionary API)는 API 키가 필요 없다. 나중에 키가 필요한 서비스를 추가하면 `.env`에 넣고 서버 코드에서만 읽는다. `NEXT_PUBLIC_`으로 시작하는 이름은 쓰지 않는다. 브라우저로 노출되기 때문이다.
- Free Dictionary API는 후원으로 운영되는 서비스라 오류가 날 수 있다(시험에서 20번 중 5번). 그래서 실패해도 "예문 없음"으로 계속 진행한다.

## 12. 만드는 순서

작업 순서와 완료 여부는 `PLAN.md`의 "작업 목록"(25개)이 기준이다. 이 문서의 처음 계획(모음 → 저장 기반 → 예문 → 복습 → 홈 → nice → 배포)은 그대로 지켜졌고, 1~17번이 끝났다. 남은 것은 배포(18) → 데이터 이전(19) → 폰 확인(20) → 빈도 목록과 수준 조정(21~22) → 모음 확대(23) → 예외 점검(24) → 4주 뒤 판정(25).
