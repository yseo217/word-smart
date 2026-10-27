"use client";

import { useEffect, useState } from "react";
import { turnOffPushOnThisDevice } from "./push-client";

// Today 화면의 알림(Reminders) 카드 (PRD 5번 nice, DESIGN.md 13장).
// 켜면 브라우저에 알림 권한을 묻고 구독 정보를 서버에 보낸다. 서버는 하루 5번 정해진 시각에 알림을 보낸다.
// 아이폰은 홈 화면에 추가한 뒤에만 알림을 받을 수 있다.

type Status =
  | { kind: "loading" }
  | { kind: "not_configured" } // 서버에 VAPID 공개 키가 없다 (배포 설정 전)
  | { kind: "need_install" } // 아이폰 사파리에서 홈 화면 추가 전
  | { kind: "unsupported" }
  | { kind: "denied" }
  | { kind: "off"; registration: ServiceWorkerRegistration }
  | { kind: "on"; registration: ServiceWorkerRegistration; subscription: PushSubscription };

const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = window.atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function detect(): Promise<Status> {
  if (!PUBLIC_KEY) return { kind: "not_configured" };
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    return isIOS && !standalone ? { kind: "need_install" } : { kind: "unsupported" };
  }
  const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
  if (Notification.permission === "denied") return { kind: "denied" };
  const subscription = await registration.pushManager.getSubscription();
  return subscription ? { kind: "on", registration, subscription } : { kind: "off", registration };
}

export default function Reminders() {
  const [status, setStatus] = useState<Status>({ kind: "loading" });
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    detect()
      .then((s) => {
        if (!cancelled) setStatus(s);
      })
      .catch(() => {
        if (!cancelled) setStatus({ kind: "unsupported" });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function turnOn(registration: ServiceWorkerRegistration) {
    setBusy(true);
    setNotice(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus(permission === "denied" ? { kind: "denied" } : { kind: "off", registration });
        return;
      }
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(PUBLIC_KEY),
      });
      // 서버 저장이 어떤 이유로든 안 되면(응답 오류든 네트워크 예외든) 브라우저 구독을 되돌린다.
      // 안 그러면 다음에 열었을 때 띠는 "On"인데 서버에는 없어 알림이 오지 않는다 (DESIGN 13.3).
      let saved: Response | null = null;
      try {
        saved = await fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subscription: subscription.toJSON() }),
        });
      } catch {
        saved = null;
      }
      if (!saved || !saved.ok) {
        await subscription.unsubscribe();
        setNotice(
          saved?.status === 409
            ? "This server already has the maximum number of devices registered. See the design notes to clear the list."
            : "Could not save the reminder on the server. Check your connection and try again.",
        );
        setStatus({ kind: "off", registration });
        return;
      }
      setStatus({ kind: "on", registration, subscription });
      setNotice("Reminders are on for this device.");
    } catch {
      setNotice("Could not turn on reminders.");
    } finally {
      setBusy(false);
    }
  }

  async function turnOff(registration: ServiceWorkerRegistration) {
    setBusy(true);
    setNotice(null);
    try {
      await turnOffPushOnThisDevice();
      setStatus({ kind: "off", registration });
      setNotice("Reminders are off for this device.");
    } catch {
      setNotice("Could not turn off reminders.");
    } finally {
      setBusy(false);
    }
  }

  async function sendTest(registration: ServiceWorkerRegistration, subscription: PushSubscription) {
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch("/api/push/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: subscription.endpoint }),
      });
      if (res.ok) {
        setNotice("Test sent. It may take a few seconds to arrive.");
      } else if (res.status === 404 || res.status === 410) {
        // 서버에 이 기기가 없다(목록을 지웠거나 푸시 서비스가 구독을 끊음). 브라우저 구독도 풀고 꺼진 상태로 돌아가 다시 켤 수 있게 한다 (DESIGN 13.6).
        await subscription.unsubscribe();
        setStatus({ kind: "off", registration });
        setNotice("This device is no longer registered on the server. Turn reminders on again.");
      } else {
        setNotice("The test could not be sent. The server could not deliver it (check the push settings on the server).");
      }
    } catch {
      setNotice("The test could not be sent.");
    } finally {
      setBusy(false);
    }
  }

  // 제목 없이 한 줄짜리 띠: 종 아이콘 + 상태 글 + 알약 버튼 (2026-10-26 사용자 요청: "Reminders" 글자와 시각은 보이지 않게)
  const pill = "inline-flex min-h-9 shrink-0 items-center rounded-full px-3.5 text-sm font-medium transition-colors disabled:opacity-50";
  const pillSolid = `${pill} bg-foreground text-background hover:opacity-90`;
  const pillOutline = `${pill} border border-zinc-300 text-foreground hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800`;
  const muted = "text-sm text-zinc-600 dark:text-zinc-400";
  const isOn = status.kind === "on";

  return (
    <section className="flex flex-col gap-2 rounded-lg border border-zinc-200 px-4 py-3 dark:border-zinc-800">
      <div className="flex items-center gap-3">
        {/* 종 아이콘: 켜져 있으면 네이비 바탕, 아니면 회색 테두리 */}
        <span
          aria-hidden="true"
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${isOn ? "bg-foreground text-background" : "border border-zinc-300 text-zinc-500 dark:border-zinc-700"}`}
        >
          <BellIcon />
        </span>
        <div className="min-w-0 flex-1">
          {status.kind === "loading" && <p className={muted}>Loading…</p>}
          {status.kind === "not_configured" && <p className={muted}>Reminders are not set up on this server yet.</p>}
          {status.kind === "need_install" && (
            <p className={muted}>To get reminders on iPhone, add Word Smart to your Home Screen (Share → Add to Home Screen) and open it from there.</p>
          )}
          {status.kind === "unsupported" && <p className={muted}>This browser cannot receive reminders.</p>}
          {status.kind === "denied" && <p className={muted}>Notifications are blocked for Word Smart. Allow them in your device settings to turn reminders on.</p>}
          {status.kind === "off" && <p className={muted}>Get a nudge five times a day.</p>}
          {status.kind === "on" && <p className="text-sm font-medium">On for this device.</p>}
        </div>
        {status.kind === "off" && (
          <button type="button" className={pillSolid} disabled={busy} onClick={() => turnOn(status.registration)}>
            Turn on reminders
          </button>
        )}
        {status.kind === "on" && (
          <span className="flex shrink-0 gap-2">
            <button type="button" className={pillOutline} disabled={busy} onClick={() => sendTest(status.registration, status.subscription)}>
              Send a test
            </button>
            <button type="button" className={pillOutline} disabled={busy} onClick={() => turnOff(status.registration)}>
              Turn off
            </button>
          </span>
        )}
      </div>
      {notice && (
        <p role="status" className="pl-11 text-sm text-zinc-700 dark:text-zinc-300">
          {notice}
        </p>
      )}
    </section>
  );
}

// 종 모양 아이콘 (외부 아이콘 라이브러리 없이 선 하나)
function BellIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.7 21a2 2 0 0 1-3.4 0" />
    </svg>
  );
}
