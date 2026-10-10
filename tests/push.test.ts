import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../app/lib/supabase", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../app/lib/supabase")>()),
  selectShopSetting: vi.fn(),
  insertShopSettingIfMissing: vi.fn(),
}));
const sendNotification = vi.fn();
vi.mock("web-push", () => ({
  default: { generateVAPIDKeys: () => ({ publicKey: "GEN-PUB", privateKey: "GEN-PRIV" }), sendNotification: (...args: unknown[]) => sendNotification(...args) },
}));

import { getVapid, resetVapidCache, sendPush } from "../app/lib/push";
import * as db from "../app/lib/supabase";

const target = { endpoint: "https://push.example/1", p256dh: "p", auth: "a" };
const payload = { title: "T", body: "B", url: "/orders/1" };

beforeEach(() => {
  vi.resetAllMocks();
  resetVapidCache();
});

describe("notification keys", () => {
  it("uses keys set on the server first", async () => {
    const vapid = await getVapid({ VAPID_PUBLIC_KEY: "ENV-PUB", VAPID_PRIVATE_KEY: "ENV-PRIV", GMAIL_USER: "shop@gmail.com" });
    expect(vapid).toEqual({ publicKey: "ENV-PUB", privateKey: "ENV-PRIV", subject: "mailto:shop@gmail.com" });
    expect(db.selectShopSetting).not.toHaveBeenCalled();
  });

  it("otherwise creates a pair once and stores it, so nothing has to be set up by hand", async () => {
    vi.mocked(db.selectShopSetting).mockResolvedValueOnce(null).mockResolvedValueOnce({ publicKey: "GEN-PUB", privateKey: "GEN-PRIV" });
    const vapid = await getVapid({});
    expect(db.insertShopSettingIfMissing).toHaveBeenCalledWith("vapid_keys", { publicKey: "GEN-PUB", privateKey: "GEN-PRIV" });
    expect(vapid?.publicKey).toBe("GEN-PUB");
  });

  it("reuses the stored pair on later starts", async () => {
    vi.mocked(db.selectShopSetting).mockResolvedValue({ publicKey: "STORED-PUB", privateKey: "STORED-PRIV" });
    expect((await getVapid({}))?.publicKey).toBe("STORED-PUB");
    expect(db.insertShopSettingIfMissing).not.toHaveBeenCalled();
  });

  it("is simply off (not an error) when the table is not there yet", async () => {
    vi.mocked(db.selectShopSetting).mockRejectedValue(new Error("relation shop_settings does not exist"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await getVapid({})).toBeNull();
    spy.mockRestore();
  });
});

describe("sending", () => {
  beforeEach(() => { vi.stubEnv("VAPID_PUBLIC_KEY", "ENV-PUB"); vi.stubEnv("VAPID_PRIVATE_KEY", "ENV-PRIV"); });

  it("sends the message to the browser's own address", async () => {
    sendNotification.mockResolvedValue({ statusCode: 201 });
    expect(await sendPush(target, payload)).toBe("sent");
    expect(sendNotification).toHaveBeenCalledWith({ endpoint: target.endpoint, keys: { p256dh: "p", auth: "a" } }, JSON.stringify(payload), expect.objectContaining({ TTL: 86400 }));
  });

  it("reports a removed subscription so it can be forgotten", async () => {
    sendNotification.mockRejectedValue(Object.assign(new Error("gone"), { statusCode: 410 }));
    expect(await sendPush(target, payload)).toBe("gone");
    sendNotification.mockRejectedValue(Object.assign(new Error("nope"), { statusCode: 404 }));
    expect(await sendPush(target, payload)).toBe("gone");
  });

  it("treats other failures as temporary", async () => {
    sendNotification.mockRejectedValue(Object.assign(new Error("boom"), { statusCode: 500 }));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await sendPush(target, payload)).toBe("failed");
    spy.mockRestore();
  });
});
