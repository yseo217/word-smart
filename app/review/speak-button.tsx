"use client";

import { useEffect, useSyncExternalStore } from "react";

// 단어 발음 듣기 (PRD 5번 nice): 브라우저 기본 음성(speechSynthesis)으로 영어(미국식)를 누를 때만 읽어준다.
// 음성 파일은 가져오지 않고, 브라우저가 지원하지 않으면 버튼을 숨긴다.
const noop = () => () => {};
const supported = () => typeof window !== "undefined" && "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
const notOnServer = () => false;

export default function SpeakButton({ text }: { text: string }) {
  const canSpeak = useSyncExternalStore(noop, supported, notOnServer);

  // 단어가 바뀌거나 화면을 나가면 읽던 것을 멈춘다 (PRD 5번 nice).
  useEffect(() => {
    return () => {
      if (supported()) window.speechSynthesis.cancel();
    };
  }, [text]);

  if (!canSpeak) return null;

  function speak() {
    const synth = window.speechSynthesis;
    synth.cancel(); // 앞서 읽던 것이 있으면 멈추고 새로 읽는다
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    utterance.rate = 0.9;
    const voice = synth.getVoices().find((v) => v.lang === "en-US") ?? synth.getVoices().find((v) => v.lang.startsWith("en"));
    if (voice) utterance.voice = voice;
    synth.speak(utterance);
  }

  return (
    <button
      type="button"
      onClick={speak}
      aria-label={`Hear ${text}`}
      title="Hear the word"
      className="flex size-11 shrink-0 items-center justify-center rounded-full border border-zinc-300 text-zinc-700 dark:border-zinc-700 dark:text-zinc-300"
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M11 5 6 9H3v6h3l5 4z" />
        <path d="M15.5 8.5a5 5 0 0 1 0 7" />
        <path d="M18.5 5.5a9 9 0 0 1 0 13" />
      </svg>
    </button>
  );
}
