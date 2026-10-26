# Word Smart — 프로젝트 규칙서

혼자 쓰는 영어 단어 복습 웹 앱. 단어장에 넣은 단어를 하루 5회, 회당 3단어씩 예문과 함께 묻는다.
**기획서 `PRD.md`가 최상위 기준**이고, 어떻게 만들지는 `DESIGN.md`에 있다. 둘이 어긋나면 PRD가 이긴다.
기능을 바꾸면 코드와 함께 두 문서도 같은 커밋에서 고친다.

## 명령

```bash
npm run dev     # 개발 서버 (http://localhost:3000)
npm test        # 단위 테스트 (node --test, lib/*.test.ts)
npm run lint    # ESLint
npx tsc --noEmit
npm run build   # 프로덕션 빌드. 미리 그리기(prerender) 오류는 여기서만 잡힌다
node scripts/build-voa-corpus.mjs --limit 300   # VOA 문장 모음 다시 만들기 (느림, 아래 예절 참고)
node scripts/make-icons.mjs                     # PWA 아이콘 다시 만들기
node scripts/build-word-freq.mjs <en_50k.txt 경로>   # 단어 빈도 목록 다시 만들기 (파일은 빈 폴더에 내려받아 경로만 넘긴다)
```

Windows PowerShell에서는 `npm.cmd`, `npx.cmd`로 부른다. 작업을 마칠 때는 테스트·린트·빌드를 모두 돌린다.

## 구조

- `app/` 화면. `page.tsx`(Today), `words/`(단어장), `review/`(복습), `hard/`(Still Learning), `stats/`, `backup/`, `api/example/route.ts`(예문 API). 공용 조각은 `app/*.tsx`(`tab-bar`, `today-progress`, `backup-notice`).
- `lib/` 순수 로직과 테스트. 브라우저 API는 `lib/use-store.ts`에만 있다.
  - `store.ts` 저장 데이터 모양·`parseStore`·단어 추가/삭제 · `words.ts` 입력 검사 · `quiz.ts` 회차·응답·어려운 단어 규칙 · `kst.ts` 한국 시간 날짜
  - `forms.ts` 단어 변화형·강조 · `level.ts` 예문 수준(빈도 목록 없으면 꺼짐) · `word-freq.ts` 빈도 목록 변환 규칙 · `examples-core.ts`/`examples.ts` 예문 고르기(순수/서버) · `backup.ts` · `stats.ts`
- `data/voa-sentences.json` VOA 문장 모음(퍼블릭 도메인, 스크립트가 만듦) · `data/word-freq.json` 단어 빈도 순위 20,000개(OpenSubtitles 기반, CC BY-SA 4.0, 출처는 `data/word-freq.meta.json`)
- `scripts/` 개발 컴퓨터에서 직접 실행하는 도구. 배포 서버에서는 돌리지 않는다.

## 작업 절차 (검증 루프)

변경할 때마다 아래를 반복한다.

1. 변경한다.
2. `npm run lint`와 `npm run build`를 실행해 오류가 없는지 확인한다. (순수 로직을 바꿨으면 `npm test`도 돌린다.)
3. 화면이 바뀐 작업이면 `npm run dev`로 띄워 실제로 보이는지 확인한다.
4. 문제가 있으면 고치고 다시 1)로 돌아간다.
5. 통과하면 git 커밋으로 그 상태를 남긴다. 커밋 메시지는 한국어로 무엇을 왜 바꿨는지 한 줄. **검증을 통과하지 못한 상태는 커밋하지 않는다.**
6. 무엇을 왜 바꿨는지 한 줄로 요약해 알려준다.

## 작업 절차 (브랜치)

- 새 기능이나 눈에 띄는 변경을 시작할 때는, 먼저 main에서 작업용 브랜치를 만들고 그 브랜치에서 작업한다. 브랜치 이름은 `feature/기능이름` 형태로, 한글 없이 영문으로 짓는다.
- 커밋은 그 작업 브랜치에만 쌓는다. main에서 직접 작업하지 않는다.
- 검증을 통과해 작업이 끝나도 main에 바로 합치지 않는다. "합칠 준비가 됐다"고 사용자에게 알리고, 사용자가 확인한 뒤 병합해 달라고 말하면 그때 main에 합친다.

## 지켜야 할 규칙

**작업 방식**
- 새 파일은 작업 폴더(이 프로젝트 폴더) 안에만 만든다.
- 코드를 바꾸면 반드시 무엇을 왜 바꿨는지 한 줄로 알려준다.
- 파일을 지워야 할 때는 바로 삭제하지 않는다. `trash-can/` 폴더를 만들어 그 안으로 옮겨만 두고, 사용자가 직접 확인한 뒤 삭제한다. (`trash-can/`은 `.gitignore`에 있다.)
- 이미 설치된 서브에이전트(bkit 등)는 필요할 때마다 적극 활용한다.

**기술 스택과 배포**
- 기술 스택은 PRD에 정한 대로 Next.js로 고정한다. 다른 프레임워크로 바꾸거나 마이그레이션을 제안하지 않는다.
- 배포는 Vercel을 사용한다.

**비밀 정보와 외부 서비스 인증**
- `.env` 같은 비밀 정보 파일과 `node_modules/`는 `.gitignore`에 등록해 두고 절대 커밋하지 않는다.
- 외부 서비스 인증이 필요하면 토큰 값을 사용자에게 묻거나 채팅에 출력하지 않고, `.env`에 있는 값을 읽어서 쓴다. 값은 코드나 CLI가 읽고, 채팅·로그·커밋에는 절대 나오지 않게 한다.
  - 예: Supabase를 쓸 상황이 생기면 Supabase CLI를 설치해 `.env`의 `SUPABASE_ACCESS_TOKEN`으로 작업한다.
  - 예: Vercel 프로덕션 배포는 사용자가 터미널에서 Vercel CLI로 직접 실행한다(PRD 9번 18, DESIGN 11장). 에이전트가 Vercel 작업을 해야 할 때는 `.env`의 `VERCEL_TOKEN`으로 인증하고, 값은 출력하지 않는다.
- 지금 쓰는 예문 출처(VOA 문장 모음, Free Dictionary API)는 API 키가 필요 없다.

**데이터와 개인정보**
- 학습 기록은 브라우저 `localStorage`(`wordsmart:v1`)에만 둔다. 서버로 보내는 것은 예문 검색용 영어 단어뿐이고, 서버는 그 단어를 로그에 남기지 않는다.
- 외부 요청의 `User-Agent`나 어디에도 사용자 이메일·개인 연락처를 넣지 않는다. 식별용 이름은 `WordSmart …/0.1 (personal learning project)` 꼴만 쓴다.

**예문 출처**
- 순서는 VOA 문장 모음 → Free Dictionary API → "No example". 예문을 지어내지 않는다.
- VOA 사이트의 검색(`/s?k=`)은 `robots.txt`가 막으므로 호출하지 않는다. 모음은 공개 `sitemap.xml`로 만들고, 요청은 1초 이상 간격을 둔다.
- 통신사(AP, Reuters, AFP) 기사는 모음에 넣지 않는다(`scripts/build-voa-corpus.mjs`의 크레디트 규칙). 기사 전체를 저장하거나 보여주지 않는다.
- 사전 API는 한 번에 최대 6초, '다른 예문 보기'는 단어당 5번까지.

**화면과 문구**
- 앱 화면 문구는 영어, 문서와 코드 주석은 한국어. PRD의 따옴표 문구는 뜻이고 실제 영어 문구는 코드를 따른다.
- 디자인은 네이비 핀 스트라이프(바탕색·줄무늬·회색은 `app/globals.css`에서만 정의. 경고·오류·강조 같은 상태색은 Tailwind 기본색 amber·red·green을 화면 코드에서 바로 쓴다). 글꼴은 Playfair Display(제목) / Inter(본문) / Oswald(숫자, `font-score`). 구단 로고·이름 같은 상표는 쓰지 않는다.
- 스마트폰 가로 375px에서 가로 스크롤이 없어야 한다. 하단 탭 바는 `fixed`이고 `main`에 그만큼 아래 여백이 있다.

**시간**
- 하루는 한국 시간(KST) 0시에 바뀐다. 날짜는 항상 `lib/kst.ts`로 계산한다.
- 클라이언트 컴포넌트에서 `new Date()`는 저장소가 준비된 뒤(`ready`)에만 읽는다. 미리 그리는 단계에서 읽으면 Next.js가 빌드를 거부한다.

**Next.js 16**
- 설치된 버전은 예전과 규칙이 다르다. 코드를 쓰기 전에 `node_modules/next/dist/docs/`의 해당 문서를 읽는다. Cache Components가 켜져 있다.
- 효과(`useEffect`) 안에서 `setState`를 바로 부르지 않는다(린트가 막는다). 외부 상태는 `useSyncExternalStore` 패턴을 쓴다(`lib/use-store.ts`, `app/review/example-cache.ts` 참고).

**테스트**
- 순수 로직은 `lib/*.ts`에 두고 `lib/*.test.ts`에 `node:test`로 테스트를 쓴다. `.ts` 확장자를 붙여 import 한다(`allowImportingTsExtensions`).
- 테스트용 단어는 글자만 쓴다(단어 규칙이 숫자를 거부함).

## 기획서 바꾸기

- 규칙을 더하거나 바꿀 때는 사용자와 합의한 내용만 `PRD.md`에 반영하고, 숫자(가중치·상한·기간)는 "제안값"인지 "확정"인지 적는다.
- 아직 안 정한 것은 `DESIGN.md` 10번 "아직 정하지 못한 것"에 둔다. 지금 열려 있는 큰 항목: VOA 모음 확대 여부(PLAN 23번), 통신사 규칙 검증(PLAN 24번).

## Git

- 작업은 `feature/*` 브랜치에서 하고 `main`은 배포 기준으로 둔다(브랜치 절차는 위 "작업 절차 (브랜치)").
- 커밋 메시지는 한국어로, 무엇을 왜 바꿨는지 한 줄로 적는다.
- 커밋하기 전에 `git status`로 `.env` 같은 비밀 값 파일이 커밋에 들어가지 않았는지 확인한다.
- `.env`, `.bkit/`, `.next/`, `node_modules/`, `trash-can/`은 올리지 않는다(`.gitignore`).
- PowerShell에서 커밋 메시지에 큰따옴표를 넣으면 인수가 깨진다. `-m`에 작은따옴표로 쓴다.
