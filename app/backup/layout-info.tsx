"use client";

import { useSyncExternalStore } from "react";

// 기기 레이아웃 정보 한 줄 (2026-10-30, 문제 확인용): 아이폰 홈 화면 앱에서 탭 바 아래에 설명되지 않는 빈 띠가 남아,
// 화면 높이·뷰포트 높이·safe-area 값을 기기에서 직접 읽어 비교한다. 값은 저장하거나 보내지 않는다.
function subscribe(onChange: () => void) {
  window.addEventListener("resize", onChange);
  window.visualViewport?.addEventListener("resize", onChange);
  return () => {
    window.removeEventListener("resize", onChange);
    window.visualViewport?.removeEventListener("resize", onChange);
  };
}

function snapshot(): string {
  const root = getComputedStyle(document.documentElement);
  const top = root.getPropertyValue("--safe-top").trim() || "0px";
  const bottom = root.getPropertyValue("--safe-bottom").trim() || "0px";
  const mode = window.matchMedia("(display-mode: standalone)").matches ? "standalone" : "browser";
  const body = document.body.getBoundingClientRect();
  return [
    `screen ${window.screen.width}×${window.screen.height}`,
    `window ${window.innerWidth}×${window.innerHeight}`,
    `visual ${Math.round(window.visualViewport?.height ?? 0)}`,
    `html ${document.documentElement.clientHeight}`,
    `body ${Math.round(body.top)}–${Math.round(body.bottom)}`,
    `safe-area ${top}/${bottom}`,
    mode,
  ].join(" · ");
}

export default function LayoutInfo() {
  const text = useSyncExternalStore(subscribe, snapshot, () => "");
  if (!text) return null;
  return (
    <p className="text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-500">
      Layout info (for troubleshooting): <span className="font-score">{text}</span>
    </p>
  );
}
