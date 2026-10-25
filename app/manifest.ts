import type { MetadataRoute } from "next";

// 폰 홈 화면에 추가하면 앱처럼 전체 화면으로 열리게 하는 설정 (PRD 4번 사용 환경).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Word Smart",
    short_name: "Word Smart",
    description: "Review the English words in your list five times a day.",
    start_url: "/",
    display: "standalone",
    background_color: "#f3f3ee",
    theme_color: "#0c2340",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
