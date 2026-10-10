import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../app/lib/supabase", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../app/lib/supabase")>()),
  insertNotification: vi.fn(),
  selectProfileByIdService: vi.fn(),
  selectPushSubscriptions: vi.fn(),
  deletePushSubscriptionByEndpoint: vi.fn(),
  touchPushSubscription: vi.fn(),
}));
vi.mock("../app/lib/push", () => ({ sendPush: vi.fn() }));

import { notifyCustomer, notifyOrderCustomer, orderNoticeContent, returnNoticeContent, supportReplyContent } from "../app/lib/notifications";
import { sendPush } from "../app/lib/push";
import * as db from "../app/lib/supabase";

const ORDER = "c0a1ce22-0000-4000-8000-000000000001";
const event = { kind: "order_packed", category: "order" as const, title: "Order #C0A1CE22", body: "Packed", link: `/orders/${ORDER}`, dedupeKey: "k1" };
const sub = (n: number) => ({ id: `s${n}`, user_id: "u1", endpoint: `https://push.example/${n}`, p256dh: "p", auth: "a", user_agent: null });

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(db.insertNotification).mockResolvedValue({ id: "n1" } as never);
  vi.mocked(db.selectProfileByIdService).mockResolvedValue({ id: "u1", order_updates_enabled: true, support_updates_enabled: true, preferred_language: "en" } as never);
  vi.mocked(db.selectPushSubscriptions).mockResolvedValue([sub(1), sub(2)] as never);
  vi.mocked(sendPush).mockResolvedValue("sent");
});

describe("notifyCustomer", () => {
  it("saves the bell item and pushes to every browser the customer turned on", async () => {
    await notifyCustomer("u1", event);
    expect(db.insertNotification).toHaveBeenCalledWith({ user_id: "u1", kind: "order_packed", title: "Order #C0A1CE22", body: "Packed", link: `/orders/${ORDER}`, dedupe_key: "k1" });
    expect(sendPush).toHaveBeenCalledTimes(2);
    expect(sendPush).toHaveBeenCalledWith(expect.objectContaining({ endpoint: "https://push.example/1" }), { title: "Order #C0A1CE22", body: "Packed", url: `/orders/${ORDER}`, tag: "k1" });
    expect(db.touchPushSubscription).toHaveBeenCalledTimes(2);
  });

  it("announces an event only once", async () => {
    vi.mocked(db.insertNotification).mockResolvedValue(null as never);
    await notifyCustomer("u1", event);
    expect(sendPush).not.toHaveBeenCalled();
  });

  it("still fills the bell, but sends no phone notification, when order updates are switched off", async () => {
    vi.mocked(db.selectProfileByIdService).mockResolvedValue({ id: "u1", order_updates_enabled: false, support_updates_enabled: true } as never);
    await notifyCustomer("u1", event);
    expect(db.insertNotification).toHaveBeenCalled();
    expect(sendPush).not.toHaveBeenCalled();
  });

  it("support replies follow the support switch, not the order one", async () => {
    vi.mocked(db.selectProfileByIdService).mockResolvedValue({ id: "u1", order_updates_enabled: true, support_updates_enabled: false } as never);
    await notifyCustomer("u1", { ...event, category: "support" });
    expect(sendPush).not.toHaveBeenCalled();
    vi.mocked(db.selectProfileByIdService).mockResolvedValue({ id: "u1", order_updates_enabled: false, support_updates_enabled: true } as never);
    await notifyCustomer("u1", { ...event, category: "support", dedupeKey: "k2" });
    expect(sendPush).toHaveBeenCalledTimes(2);
  });

  it("removes a browser the customer has unsubscribed or cleared", async () => {
    vi.mocked(sendPush).mockResolvedValueOnce("gone").mockResolvedValueOnce("sent");
    await notifyCustomer("u1", event);
    expect(db.deletePushSubscriptionByEndpoint).toHaveBeenCalledWith("https://push.example/1");
    expect(db.deletePushSubscriptionByEndpoint).toHaveBeenCalledTimes(1);
  });

  it("never throws, and keeps going if one push fails", async () => {
    vi.mocked(sendPush).mockResolvedValueOnce("failed").mockResolvedValueOnce("sent");
    await expect(notifyCustomer("u1", event)).resolves.toBeUndefined();
    expect(db.deletePushSubscriptionByEndpoint).not.toHaveBeenCalled();
    vi.mocked(db.insertNotification).mockRejectedValue(new Error("db down"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(notifyCustomer("u1", event)).resolves.toBeUndefined();
    spy.mockRestore();
  });

  it("notifyOrderCustomer uses the customer's own language", async () => {
    vi.mocked(db.selectProfileByIdService).mockResolvedValue({ id: "u1", preferred_language: "my", order_updates_enabled: true } as never);
    await notifyOrderCustomer({ id: ORDER, user_id: "u1" }, { type: "stage", stage: "packed" });
    const saved = vi.mocked(db.insertNotification).mock.calls[0][0];
    expect(saved.title).toBe("အော်ဒါ #C0A1CE22");
    expect(saved.body).toBe("ထုပ်ပိုးပြီး");
  });
});

describe("what the notices say", () => {
  it("order steps reuse the tracking labels and link to the order", () => {
    const notice = orderNoticeContent({ type: "stage", stage: "out_for_delivery" }, ORDER, "en");
    expect(notice).toMatchObject({ kind: "order_out_for_delivery", title: "Order #C0A1CE22", body: "Out for delivery", link: `/orders/${ORDER}`, category: "order" });
    expect(notice.dedupeKey).toBe(`order:${ORDER}:stage:out_for_delivery`);
  });

  it("covers placed, cancelled, refunds, failed attempts and payment decisions", () => {
    expect(orderNoticeContent({ type: "placed" }, ORDER, "en").body).toBe("Order received");
    expect(orderNoticeContent({ type: "cancelled" }, ORDER, "en").body).toMatch(/cancelled/);
    expect(orderNoticeContent({ type: "refund_sent" }, ORDER, "en").body).toMatch(/refund/);
    expect(orderNoticeContent({ type: "attempt_failed", attempt: 2 }, ORDER, "en").dedupeKey).toBe(`order:${ORDER}:attempt:2`);
    expect(orderNoticeContent({ type: "payment", decision: "verified" }, ORDER, "en").body).toBe("Your payment was verified.");
    expect(orderNoticeContent({ type: "payment", decision: "rejected" }, ORDER, "en").body).toMatch(/could not verify/);
    expect(orderNoticeContent({ type: "payment", decision: "correction_requested" }, ORDER, "en").body).toMatch(/correction/);
  });

  it("a failed delivery attempt gets its own notice for each attempt", () => {
    const first = orderNoticeContent({ type: "attempt_failed", attempt: 1 }, ORDER, "en").dedupeKey;
    const second = orderNoticeContent({ type: "attempt_failed", attempt: 2 }, ORDER, "en").dedupeKey;
    expect(first).not.toBe(second);
  });

  it("support replies open the chat; return updates open the order", () => {
    expect(supportReplyContent("en")).toMatchObject({ category: "support", link: "/#chat", body: "The shop replied to your message." });
    const ret = returnNoticeContent("approved", "en", { id: "r1", order_id: ORDER });
    expect(ret).toMatchObject({ category: "return", link: `/orders/${ORDER}` });
    expect(ret.body.length).toBeGreaterThan(3);
    expect(returnNoticeContent("approved", "my", { id: "r1", order_id: ORDER }).body).not.toBe(ret.body);
  });

  it("never puts anything but order code and status on a lock screen", () => {
    const notice = orderNoticeContent({ type: "stage", stage: "delivered" }, ORDER, "en");
    expect(`${notice.title} ${notice.body}`).not.toMatch(/\d{7,}|@|MMK/);
  });
});
