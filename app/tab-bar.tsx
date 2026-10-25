"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { completedToday, ROUNDS_PER_DAY } from "@/lib/quiz";
import { useStore } from "@/lib/use-store";

// 하단 탭 바: Today / Word List / Still Learning(어려운 단어). 복습 화면(/review)은 Today 탭에 속한다.
// Today 탭 위에는 오늘 끝낸 회차 수를 N/5로 보여준다.
const TABS = [
  { href: "/", label: "Today", match: (p: string) => p === "/" || p.startsWith("/review") },
  { href: "/words", label: "Word List", match: (p: string) => p.startsWith("/words") },
  { href: "/hard", label: "Still Learning", match: (p: string) => p.startsWith("/hard") },
] as const;

export default function TabBar() {
  const pathname = usePathname();
  const { ready, store } = useStore();
  // 오늘 날짜는 브라우저에서 저장소가 준비된 뒤에만 읽는다 (미리 그리는 단계에서는 현재 시각을 쓸 수 없다).
  const completed = ready ? Math.min(completedToday(store), ROUNDS_PER_DAY) : null;

  const glyph = (label: string) => {
    if (label === "Today") {
      return (
        <>
          {completed ?? "–"}
          <span className="text-zinc-400">/{ROUNDS_PER_DAY}</span>
        </>
      );
    }
    return label === "Word List" ? "A–Z" : "!";
  };

  return (
    <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-10 border-t border-zinc-200 bg-background pb-[env(safe-area-inset-bottom)] dark:border-zinc-800">
      <ul className="mx-auto grid w-full max-w-md grid-cols-3">
        {TABS.map((tab) => {
          const active = tab.match(pathname);
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-14 flex-col items-center justify-center gap-0.5 border-t-2 text-xs font-medium ${
                  active ? "border-foreground text-foreground" : "border-transparent text-zinc-500 dark:text-zinc-400"
                }`}
              >
                <span aria-hidden="true" className="font-score text-lg leading-none">
                  {glyph(tab.label)}
                </span>
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
