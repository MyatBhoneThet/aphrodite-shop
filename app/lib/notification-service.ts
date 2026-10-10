import { z } from "zod";
import { badRequest } from "./errors";
import { getVapid } from "./push";
import {
  countUnreadNotifications,
  deletePushSubscriptionByEndpoint,
  markNotificationsRead,
  selectNotifications,
  selectPushSubscriptions,
  upsertPushSubscription,
  type CurrentUser,
} from "./supabase";

/** What the bell shows. Everything is scoped to the signed-in customer. */
export async function listNotifications(user: CurrentUser) {
  const [items, unread] = await Promise.all([selectNotifications(user.id, 30), countUnreadNotifications(user.id)]);
  return {
    unread,
    items: items.map(({ id, kind, title, body, link, created_at, read_at }) => ({ id, kind, title, body, link, created_at, read: read_at !== null })),
  };
}

const readSchema = z.object({
  ids: z.union([z.literal("all"), z.array(z.string().uuid()).min(1).max(100)]),
});

export async function markRead(user: CurrentUser, input: unknown) {
  const parsed = readSchema.safeParse(input);
  if (!parsed.success) throw badRequest("Choose which notifications to mark as read.");
  await markNotificationsRead(user.id, parsed.data.ids);
}

export async function pushPublicKey() {
  const vapid = await getVapid();
  return vapid ? { publicKey: vapid.publicKey } : { publicKey: null };
}

const MAX_BROWSERS_PER_CUSTOMER = 10;

const subscriptionSchema = z.object({
  endpoint: z.string().url().startsWith("https://", "Push endpoints must be https.").max(1000),
  keys: z.object({
    p256dh: z.string().min(10).max(200),
    auth: z.string().min(10).max(100),
  }),
});

export async function subscribePush(user: CurrentUser, input: unknown, userAgent: string | null) {
  const parsed = subscriptionSchema.safeParse(input);
  if (!parsed.success) throw badRequest("That phone subscription is not valid.");
  const existing = await selectPushSubscriptions(user.id);
  if (existing.length >= MAX_BROWSERS_PER_CUSTOMER && !existing.some((row) => row.endpoint === parsed.data.endpoint)) {
    throw badRequest("Phone notifications are on for too many browsers. Turn some off first.");
  }
  await upsertPushSubscription({
    user_id: user.id,
    endpoint: parsed.data.endpoint,
    p256dh: parsed.data.keys.p256dh,
    auth: parsed.data.keys.auth,
    user_agent: userAgent ? userAgent.slice(0, 300) : null,
  });
}

export async function unsubscribePush(user: CurrentUser, input: unknown) {
  const parsed = z.object({ endpoint: z.string().min(10).max(1000) }).safeParse(input);
  if (!parsed.success) throw badRequest("Say which browser to turn off.");
  await deletePushSubscriptionByEndpoint(parsed.data.endpoint, user.id);
}
