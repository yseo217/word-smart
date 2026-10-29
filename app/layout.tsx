import type { Metadata, Viewport } from "next";
import { Inter, Oswald, Playfair_Display } from "next/font/google";
import "./globals.css";
import SaveWarning from "./save-warning";
import TabBar from "./tab-bar";

// 글꼴 (DESIGN.md 2장): 제목은 Playfair Display, 본문·버튼은 Inter, 숫자·스코어는 Oswald
const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  weight: ["700", "900"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const oswald = Oswald({
  variable: "--font-oswald",
  subsets: ["latin"],
  weight: ["500", "600"],
});

export const metadata: Metadata = {
  title: "Word Smart",
  description: "Review the English words in your list five times a day.",
  // 홈 화면에 추가 (아이폰은 apple-touch-icon과 아래 설정을 본다)
  icons: { apple: "/apple-touch-icon.png" },
  appleWebApp: { capable: true, title: "Word Smart", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#0c2340",
  viewportFit: "cover", // 아이폰 홈 바 영역까지 쓰고, 탭 바는 safe-area만큼 띄운다
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${playfair.variable} ${inter.variable} ${oswald.variable} antialiased`}>
      {/* 앱 틀 (2026-10-29): 띠와 탭 바는 화면에 고정하고 가운데 .shell만 스크롤한다. 아이폰 홈 화면 앱에서 페이지 전체가 고무줄처럼
          당겨지며 띠가 따라 움직이던 것을 막고, 본문 아래에 탭 바 높이만큼 비워 두던 여백도 없앤다 (globals.css). */}
      <body className="flex flex-col">
        <div className="band shrink-0">
          <p className="mx-auto w-full max-w-md px-4 py-3 text-center font-display text-base font-black uppercase tracking-[0.3em]">Word Smart</p>
        </div>
        <div className="shell flex min-h-0 flex-1 flex-col">
          <SaveWarning />
          {children}
        </div>
        <TabBar />
      </body>
    </html>
  );
}
