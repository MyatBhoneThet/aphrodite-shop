import { STATUS_COPY, type ReturnEmailEvent } from "./return-email";
import { sendPush } from "./push";
import {
  deletePushSubscriptionByEndpoint,
  insertNotification,
  selectProfileByIdService,
  selectPushSubscriptions,
  touchPushSubscription,
} from "./supabase";
import { translate, type Language } from "./translations";

/**
 * One "tell the customer" step for everything that happens to them: it saves
 * the item the bell shows, and sends a phone notification to every browser the
 * customer turned notifications on in (unless they switched that kind off).
 * It never throws, so it can sit anywhere without risking an order action.
 */

export type NotificationCategory = "order" | "support" | "return";

export type NotificationEvent = {
  kind: string;
  category: NotificationCategory;
  title: string;
  body: string;
  /** Where tapping it goes. Must start with "/". */
  link: string;
  /** The same event is only announced once. */
  dedupeKey?: string;
};

export async function notifyCustomer(userId: string, event: NotificationEvent) {
  try {
    const row = await insertNotification({
      user_id: userId,
      kind: event.kind,
      title: event.title,
      body: event.body,
      link: event.link,
      dedupe_key: event.dedupeKey ?? null,
    });
    if (!row) return; // already announced

    const profile = await selectProfileByIdService(userId).catch(() => null);
    const allowed =
      event.category === "support"
        ? profile?.support_updates_enabled ?? true
        : profile?.order_updates_enabled ?? true;
    if (!allowed) return;

    const subscriptions = await selectPushSubscriptions(userId);
    await Promise.all(
      subscriptions.map(async (subscription) => {
        const result = await sendPush(subscription, { title: event.title, body: event.body, url: event.link, tag: event.dedupeKey ?? event.kind });
        if (result === "gone") await deletePushSubscriptionByEndpoint(subscription.endpoint).catch(() => undefined);
        if (result === "sent") await touchPushSubscription(subscription.endpoint).catch(() => undefined);
      })
    );
  } catch (error) {
    console.error("[notifications] could not notify the customer", error instanceof Error ? error.message : error);
  }
}

async function languageOf(userId: string): Promise<Language> {
  const profile = await selectProfileByIdService(userId).catch(() => null);
  return profile?.preferred_language === "my" ? "my" : "en";
}

const orderCode = (id: string) => id.slice(0, 8).toUpperCase();

export type OrderNotice =
  | { type: "placed" }
  | { type: "stage"; stage: "verified" | "packed" | "handed_to_courier" | "out_for_delivery" | "delivered" }
  | { type: "cancelled" }
  | { type: "refund_sent" }
  | { type: "attempt_failed"; attempt: number }
  | { type: "payment"; decision: "verified" | "rejected" | "correction_requested" };

/** The words for an order update, in the customer's language. Pure, so it is easy to test. */
export function orderNoticeContent(notice: OrderNotice, orderId: string, language: Language): NotificationEvent {
  const title = translate(language, "notify.order", { code: orderCode(orderId) });
  const base = { category: "order" as const, title, link: `/orders/${orderId}` };
  switch (notice.type) {
    case "placed":
      return { ...base, kind: "order_placed", body: translate(language, "tracking.order_placed"), dedupeKey: `order:${orderId}:placed` };
    case "stage":
      return { ...base, kind: `order_${notice.stage}`, body: translate(language, `tracking.${notice.stage}`), dedupeKey: `order:${orderId}:stage:${notice.stage}` };
    case "cancelled":
      return { ...base, kind: "order_cancelled", body: translate(language, "notify.cancelled"), dedupeKey: `order:${orderId}:cancelled` };
    case "refund_sent":
      return { ...base, kind: "order_refund_sent", body: translate(language, "notify.refundSent"), dedupeKey: `order:${orderId}:refund_sent` };
    case "attempt_failed":
      return { ...base, kind: "order_attempt_failed", body: translate(language, "delivery.attempt.heading"), dedupeKey: `order:${orderId}:attempt:${notice.attempt}` };
    case "payment": {
      const key = notice.decision === "verified" ? "notify.payment.verified" : notice.decision === "rejected" ? "notify.payment.rejected" : "notify.payment.correction";
      return { ...base, kind: `payment_${notice.decision}`, body: translate(language, key), dedupeKey: `order:${orderId}:payment:${notice.decision}:${new Date().toISOString().slice(0, 13)}` };
    }
  }
}

export async function notifyOrderCustomer(order: { id: string; user_id: string }, notice: OrderNotice) {
  try {
    await notifyCustomer(order.user_id, orderNoticeContent(notice, order.id, await languageOf(order.user_id)));
  } catch (error) {
    console.error("[notifications] order notice failed", error instanceof Error ? error.message : error);
  }
}

export function supportReplyContent(language: Language): NotificationEvent {
  return {
    kind: "support_reply",
    category: "support",
    title: translate(language, "notify.support.title"),
    body: translate(language, "notify.support.body"),
    link: "/#chat",
  };
}

export async function notifySupportReply(customerId: string) {
  try {
    await notifyCustomer(customerId, supportReplyContent(await languageOf(customerId)));
  } catch (error) {
    console.error("[notifications] support notice failed", error instanceof Error ? error.message : error);
  }
}

export function returnNoticeContent(
  event: ReturnEmailEvent,
  language: Language,
  request: { id: string; order_id: string },
  suffix?: string
): NotificationEvent {
  const copy = STATUS_COPY[event];
  return {
    kind: `return_${event}`,
    category: "return",
    title: translate(language, "notify.return.title"),
    body: language === "my" ? copy.burmeseHeading : copy.heading,
    link: `/orders/${request.order_id}`,
    dedupeKey: `return:${request.id}:${event}:${suffix ?? ""}`.slice(0, 200),
  };
}

export async function notifyReturnCustomer(
  customerId: string,
  request: { id: string; order_id: string },
  event: ReturnEmailEvent,
  suffix?: string
) {
  try {
    await notifyCustomer(customerId, returnNoticeContent(event, await languageOf(customerId), request, suffix));
  } catch (error) {
    console.error("[notifications] return notice failed", error instanceof Error ? error.message : error);
  }
}
