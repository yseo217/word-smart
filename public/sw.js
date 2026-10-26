// Word Smart 서비스 워커 — 푸시 알림 전용 (DESIGN.md 13장).
// 오프라인 캐시는 하지 않는다. 받은 알림을 보여주고, 누르면 복습 화면을 연다.

self.addEventListener("push", (event) => {
  let data = { title: "Word Smart", body: "Time for a round.", url: "/review", tag: "wordsmart-round" };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch {
    // 본문이 JSON이 아니면 기본 문구를 쓴다
  }
  const options = {
    body: data.body,
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    tag: data.tag,
    data: { url: data.url },
  };
  event.waitUntil(self.registration.showNotification(data.title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || "/review", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      // 이미 열린 앱 창이 있으면 그 창을 앞으로 가져와 복습 화면으로 보낸다
      for (const client of clients) {
        if (new URL(client.url).origin === self.location.origin && "focus" in client) {
          return client.focus().then((c) => (c && "navigate" in c ? c.navigate(url) : c));
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
