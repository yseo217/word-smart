"use client";

import { useEffect, useState } from "react";

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
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: subscription.toJSON() }),
      });
      if (!res.ok) {
        await subscription.unsubscribe();
        setNotice("Could not save the reminder on the server. Try again later.");
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

  async function turnOff(registration: ServiceWorkerRegistration, subscription: PushSubscription) {
    setBusy(true);
    setNotice(null);
    try {
      await fetch("/api/push/subscribe", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: subscription.endpoint }),
      });
      await subscription.unsubscribe();
      setStatus({ kind: "off", registration });
      setNotice("Reminders are off for this device.");
    } catch {
      setNotice("Could not turn off reminders.");
    } finally {
      setBusy(false);
    }
  }

  async function sendTest(subscription: PushSubscription) {
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch("/api/push/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: subscription.endpoint }),
      });
      setNotice(res.ok ? "Test sent. It may take a few seconds to arrive." : "The test could not be sent.");
    } catch {
      setNotice("The test could not be sent.");
    } finally {
      setBusy(false);
    }
  }

  const primary = "flex min-h-12 items-center justify-center rounded-lg bg-foreground px-4 text-base font-medium text-background disabled:opacity-50";
  const link = "min-h-11 font-medium underline underline-offset-4 disabled:opacity-50"; // 글자 버튼이지만 누르는 높이는 44px 유지
  const muted = "text-sm text-zinc-600 dark:text-zinc-400";

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <p className="font-medium">Reminders</p>
      {status.kind === "loading" && <p className={muted}>Loading…</p>}
      {status.kind === "not_configured" && <p className={muted}>Reminders are not set up on this server yet.</p>}
      {status.kind === "need_install" && (
        <p className={muted}>To get reminders on iPhone, add Word Smart to your Home Screen first (Share → Add to Home Screen), then open it from there.</p>
      )}
      {status.kind === "unsupported" && <p className={muted}>This browser cannot receive reminders.</p>}
      {status.kind === "denied" && <p className={muted}>Notifications are blocked for Word Smart. Allow them in your device settings to turn reminders on.</p>}
      {status.kind === "off" && (
        <>
          <p className={muted}>Get a nudge five times a day to review three words.</p>
          <button type="button" className={primary} disabled={busy} onClick={() => turnOn(status.registration)}>
            Turn on reminders
          </button>
        </>
      )}
      {status.kind === "on" && (
        // 켠 뒤에는 한 줄로 작게: 상태 글과 작은 글자 버튼 두 개 (Today 화면이 길어지지 않게)
        <p className="flex items-center justify-between gap-3 text-sm">
          <span className="text-zinc-600 dark:text-zinc-400">On for this device.</span>
          <span className="flex shrink-0 gap-4">
            <button type="button" className={link} disabled={busy} onClick={() => sendTest(status.subscription)}>
              Send a test
            </button>
            <button type="button" className={link} disabled={busy} onClick={() => turnOff(status.registration, status.subscription)}>
              Turn off
            </button>
          </span>
        </p>
      )}
      {notice && (
        <p role="status" className="text-sm text-zinc-700 dark:text-zinc-300">
          {notice}
        </p>
      )}
    </section>
  );
}
