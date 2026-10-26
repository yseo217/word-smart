// 푸시 구독 목록의 저장소 (서버 전용, DESIGN.md 13장).
// 배포에서는 Vercel Blob(비공개 파일 하나)에, 토큰이 없는 개발 컴퓨터에서는 .local/push-subscriptions.json에 둔다.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { get, put } from "@vercel/blob";
import { parseSubscriptionList, type PushSubscriptionRecord } from "./push.ts";

const BLOB_PATH = "push/subscriptions.json";
const LOCAL_FILE = path.join(process.cwd(), ".local", "push-subscriptions.json");

function hasBlobToken(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

export async function readSubscriptions(): Promise<PushSubscriptionRecord[]> {
  if (hasBlobToken()) {
    const result = await get(BLOB_PATH, { access: "private", useCache: false });
    if (!result || result.statusCode !== 200) return [];
    return parseSubscriptionList(await new Response(result.stream).text());
  }
  try {
    return parseSubscriptionList(await readFile(LOCAL_FILE, "utf8"));
  } catch {
    return [];
  }
}

export async function writeSubscriptions(list: readonly PushSubscriptionRecord[]): Promise<void> {
  const body = JSON.stringify(list, null, 2);
  if (hasBlobToken()) {
    await put(BLOB_PATH, body, { access: "private", allowOverwrite: true, contentType: "application/json" });
    return;
  }
  await mkdir(path.dirname(LOCAL_FILE), { recursive: true });
  await writeFile(LOCAL_FILE, body, "utf8");
}

// 어디에 저장하는지 (화면·로그에는 쓰지 않고, 상태 확인용)
export function storageKind(): "blob" | "local" {
  return hasBlobToken() ? "blob" : "local";
}
