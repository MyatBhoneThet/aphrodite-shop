import { insertShopSettingIfMissing, selectShopSetting } from "./supabase";

/**
 * Phone notifications (web push).
 *
 * Browsers only accept pushes signed with a key pair ("VAPID") that the shop
 * owns. Set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY on the server to use your
 * own; if they are not set, a pair is created once and kept in the database
 * (shop_settings), so nothing has to be set up by hand.
 */

export type PushPayload = { title: string; body: string; url: string; tag?: string };
export type PushTarget = { endpoint: string; p256dh: string; auth: string };
export type PushResult = "sent" | "gone" | "failed";

type Vapid = { publicKey: string; privateKey: string; subject: string };
let cached: Vapid | null = null;

function vapidSubject(env: Record<string, string | undefined>) {
  const explicit = env.VAPID_SUBJECT?.trim();
  if (explicit) return explicit;
  const mail = env.GMAIL_USER?.trim();
  if (mail) return `mailto:${mail}`;
  const site = env.PUBLIC_SITE_URL?.trim() || env.APP_URL?.trim();
  return site && site.startsWith("https://") ? site : "mailto:admin@aphrodite.invalid";
}

export function resetVapidCache() {
  cached = null;
}

export async function getVapid(env: Record<string, string | undefined> = process.env): Promise<Vapid | null> {
  if (cached) return cached;
  const publicKey = env.VAPID_PUBLIC_KEY?.trim();
  const privateKey = env.VAPID_PRIVATE_KEY?.trim();
  if (publicKey && privateKey) {
    cached = { publicKey, privateKey, subject: vapidSubject(env) };
    return cached;
  }
  try {
    const read = async () => {
      const stored = (await selectShopSetting("vapid_keys")) as { publicKey?: string; privateKey?: string } | null;
      return stored?.publicKey && stored.privateKey ? { publicKey: stored.publicKey, privateKey: stored.privateKey } : null;
    };
    let keys = await read();
    if (!keys) {
      const webpush = (await import("web-push")).default;
      await insertShopSettingIfMissing("vapid_keys", webpush.generateVAPIDKeys());
      keys = await read(); // if two servers raced, both settle on the stored pair
    }
    if (!keys) return null;
    cached = { ...keys, subject: vapidSubject(env) };
    return cached;
  } catch (error) {
    console.error("[push] could not load or create the notification keys", error instanceof Error ? error.message : error);
    return null;
  }
}

export async function sendPush(target: PushTarget, payload: PushPayload): Promise<PushResult> {
  const vapid = await getVapid();
  if (!vapid) return "failed";
  try {
    const webpush = (await import("web-push")).default;
    await webpush.sendNotification(
      { endpoint: target.endpoint, keys: { p256dh: target.p256dh, auth: target.auth } },
      JSON.stringify(payload),
      {
        vapidDetails: { subject: vapid.subject, publicKey: vapid.publicKey, privateKey: vapid.privateKey },
        TTL: 24 * 60 * 60,
        timeout: 5000,
      }
    );
    return "sent";
  } catch (error) {
    const status = (error as { statusCode?: number } | null)?.statusCode;
    // 404/410: the customer removed the subscription or cleared the browser.
    if (status === 404 || status === 410) return "gone";
    console.error("[push] delivery failed", { status, message: error instanceof Error ? error.message : String(error) });
    return "failed";
  }
}
