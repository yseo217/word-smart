// 영어 단어 빈도 순위 data/word-freq.json을 만든다 (PLAN 21번, DESIGN.md 6.5).
// 개발 컴퓨터에서 직접 실행한다. 이 스크립트는 파일을 내려받지 않고, 미리 내려받은 목록 파일의 경로를 인수로 받는다:
//   node scripts/build-word-freq.mjs <en_50k.txt 경로> [--limit 20000] [--out data/word-freq.json]
//
// 출처: hermitdave/FrequencyWords (https://github.com/hermitdave/FrequencyWords) 의 content/2018/en/en_50k.txt
//   OpenSubtitles 2018 영어 자막(opus.nlpl.eu)에서 센 단어 빈도. 한 줄에 "단어 횟수", 많이 쓰인 순서.
// 라이선스: 목록 데이터는 CC BY-SA 4.0 (저장소의 코드는 MIT). 변환한 data/word-freq.json도 같은 조건이라
//   출처·라이선스를 data/word-freq.meta.json에 함께 적어 둔다. 지도 파일 자체는 { 단어: 순위 }만 담아
//   lib/examples.ts가 그대로 FrequencyMap으로 읽을 수 있게 한다.
// 변환 규칙(알파벳만, 한 글자는 a·i만, 상위 20,000개, 순위 다시 매김)은 lib/word-freq.ts에 있고 테스트도 거기 있다.

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { buildFrequencyMap, DEFAULT_LIMIT } from "../lib/word-freq.ts";

const SOURCE = {
  name: "hermitdave/FrequencyWords (OpenSubtitles 2018, en_50k.txt)",
  url: "https://github.com/hermitdave/FrequencyWords/blob/master/content/2018/en/en_50k.txt",
  license: "CC BY-SA 4.0",
  licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
};

function argValue(args, name) {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
}

// { 단어: 순위 }를 한 줄에 한 단어씩 쓴다 (git diff를 읽을 수 있게).
function formatMap(map) {
  const lines = Object.entries(map).map(([word, rank]) => `${JSON.stringify(word)}:${rank}`);
  return `{\n${lines.join(",\n")}\n}\n`;
}

export function main(argv) {
  const args = argv.slice(2);
  // 첫 번째 "--옵션의 값"이 아닌 인수가 입력 파일 경로다.
  const input = args.find((a, i) => !a.startsWith("--") && !(i > 0 && args[i - 1].startsWith("--")));
  if (!input) {
    console.error("사용법: node scripts/build-word-freq.mjs <en_50k.txt 경로> [--limit 20000] [--out data/word-freq.json]");
    process.exit(1);
  }
  const limit = Number(argValue(args, "--limit") ?? DEFAULT_LIMIT);
  const outPath = argValue(args, "--out") ?? path.join("data", "word-freq.json");
  const metaPath = outPath.replace(/\.json$/, ".meta.json");

  const text = fs.readFileSync(input, "utf8");
  const inputLines = text.split(/\r?\n/).filter((l) => l.trim()).length;
  const map = buildFrequencyMap(text, limit);
  const words = Object.keys(map).length;

  fs.writeFileSync(outPath, formatMap(map));
  fs.writeFileSync(
    metaPath,
    JSON.stringify(
      {
        builtAt: new Date().toISOString(),
        source: SOURCE.name,
        sourceUrl: SOURCE.url,
        license: SOURCE.license,
        licenseUrl: SOURCE.licenseUrl,
        inputFile: path.basename(input),
        inputLines,
        words,
        rule: "letters-only words (single letters: a, i only), re-ranked from 1 in source order, top " + limit,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(`읽음 ${inputLines}줄 → 단어 ${words}개 → ${outPath} (출처·라이선스: ${metaPath})`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main(process.argv);
