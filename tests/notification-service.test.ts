import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../app/lib/supabase", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../app/lib/supabase")>()),
  selectNotifications: vi.fn(),
  countUnreadNotifications: vi.fn(),
  markNotificationsRead: vi.fn(),
  selectPushSubscriptions: vi.fn(),
  upsertPushSubscription: vi.fn(),
  deletePushSubscriptionByEndpoint: vi.fn(),
}));
vi.mock("../app/lib/push", () => ({ getVapid: vi.fn() }));

import { listNotifications, markRead, pushPublicKey, subscribePush, unsubscribePush } from "../app/lib/notification-service";
import { getVapid } from "../app/lib/push";
import * as db from "../app/lib/supabase";
import type { CurrentUser } from "../app/lib/supabase";

const user = { id: "u1" } as unknown as CurrentUser;
const good = { endpoint: "https://fcm.googleapis.com/fcm/send/abc123", keys: { p256dh: "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA", auth: "tBHItJI5svbpez7KI4CCXg" } };

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(db.selectPushSubscriptions).mockResolvedValue([]);
});

describe("the bell list", () => {
  it("returns only the customer's own items, newest first, with an unread count", async () => {
    vi.mocked(db.selectNotifications).mockResolvedValue([
      { id: "n1", user_id: "u1", kind: "order_packed", title: "T", body: "B", link: "/orders/1", dedupe_key: "secret", created_at: "2026-10-12T00:00:00Z", read_at: null },
    ] as never);
    vi.mocked(db.countUnreadNotifications).mockResolvedValue(3);
    const result = await listNotifications(user);
    expect(db.selectNotifications).toHaveBeenCalledWith("u1", 30);
    expect(db.countUnreadNotifications).toHaveBeenCalledWith("u1");
    expect(result.unread).toBe(3);
    expect(result.items[0]).toEqual({ id: "n1", kind: "order_packed", title: "T", body: "B", link: "/orders/1", created_at: "2026-10-12T00:00:00Z", read: false });
    expect(JSON.stringify(result)).not.toContain("secret");
  });

  it("marks read only through the customer's own id", async () => {
    await markRead(user, { ids: "all" });
    expect(db.markNotificationsRead).toHaveBeenCalledWith("u1", "all");
    const id = "11111111-1111-4111-8111-111111111111";
    await markRead(user, { ids: [id] });
    expect(db.markNotificationsRead).toHaveBeenLastCalledWith("u1", [id]);
  });

  it("rejects nonsense ids", async () => {
    await expect(markRead(user, { ids: ["not-a-uuid"] })).rejects.toMatchObject({ status: 400 });
    await expect(markRead(user, { ids: [] })).rejects.toMatchObject({ status: 400 });
    await expect(markRead(user, {})).rejects.toMatchObject({ status: 400 });
  });
});

describe("phone notification subscriptions", () => {
  it("returns the public key, or null when notifications cannot be set up", async () => {
    vi.mocked(getVapid).mockResolvedValue({ publicKey: "PUB", privateKey: "PRIV", subject: "mailto:a@b.c" });
    const result = await pushPublicKey();
    expect(result).toEqual({ publicKey: "PUB" });
    expect(JSON.stringify(result)).not.toContain("PRIV");
    vi.mocked(getVapid).mockResolvedValue(null);
    expect(await pushPublicKey()).toEqual({ publicKey: null });
  });

  it("saves a valid subscription against the signed-in customer", async () => {
    await subscribePush(user, good, "Mozilla/5.0 Chrome");
    expect(db.upsertPushSubscription).toHaveBeenCalledWith({ user_id: "u1", endpoint: good.endpoint, p256dh: good.keys.p256dh, auth: good.keys.auth, user_agent: "Mozilla/5.0 Chrome" });
  });

  it("refuses an endpoint that is not https, or missing keys", async () => {
    await expect(subscribePush(user, { ...good, endpoint: "http://insecure.example/x" }, null)).rejects.toMatchObject({ status: 400 });
    await expect(subscribePush(user, { endpoint: good.endpoint }, null)).rejects.toMatchObject({ status: 400 });
    expect(db.upsertPushSubscription).not.toHaveBeenCalled();
  });

  it("caps how many browsers one customer can register, but lets an existing one refresh", async () => {
    const many = Array.from({ length: 10 }, (_, n) => ({ id: `s${n}`, user_id: "u1", endpoint: `https://p.example/${n}`, p256dh: "x", auth: "y", user_agent: null }));
    vi.mocked(db.selectPushSubscriptions).mockResolvedValue(many);
    await expect(subscribePush(user, good, null)).rejects.toMatchObject({ status: 400 });
    await subscribePush(user, { ...good, endpoint: "https://p.example/3" }, null);
    expect(db.upsertPushSubscription).toHaveBeenCalledTimes(1);
  });

  it("turning off only affects the customer's own browser entry", async () => {
    await unsubscribePush(user, { endpoint: good.endpoint });
    expect(db.deletePushSubscriptionByEndpoint).toHaveBeenCalledWith(good.endpoint, "u1");
    await expect(unsubscribePush(user, {})).rejects.toMatchObject({ status: 400 });
  });
});
