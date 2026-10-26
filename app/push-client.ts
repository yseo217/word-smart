// 이 기기의 푸시 알림을 끈다 (브라우저 전용, DESIGN.md 13장).
// Today의 알림 띠 "Turn off"와 백업 화면의 전체 초기화가 같은 함수를 쓴다.
// 서버 목록에서 지운 뒤 브라우저 구독을 해제한다. 구독이 없으면 아무것도 하지 않는다.
export async function turnOffPushOnThisDevice(): Promise<boolean> {
  if (!("serviceWorker" in navigator)) return false;
  const registration = await navigator.serviceWorker.getRegistration("/");
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) return false;
  await fetch("/api/push/subscribe", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint: subscription.endpoint }),
  });
  await subscription.unsubscribe();
  return true;
}
