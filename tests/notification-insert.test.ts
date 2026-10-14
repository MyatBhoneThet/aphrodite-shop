import { afterEach, describe, expect, it, vi } from "vitest";

// supabase.ts reads its connection settings once, at import time.
vi.hoisted(() => {
  vi.stubEnv("SUPABASE_URL", "https://project.supabase.co");
  vi.stubEnv("SUPABASE_ANON_KEY", "anon-key");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role-key");
});

import { insertNotification } from "../app/lib/supabase";

const entry = {
  user_id: "11111111-1111-4111-8111-111111111111",
  kind: "order_placed",
  title: "Order #ABCD1234",
  body: "We received your order.",
  link: "/orders/abcd",
  dedupe_key: "order:abcd:placed",
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("insertNotification", () => {
  it("is a plain insert: no ON CONFLICT clause, which the partial index cannot satisfy", async () => {
    const fetchMock = vi.fn(async () => Response.json([{ id: "n1", ...entry }], { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);

    const row = await insertNotification(entry);

    expect(row).toMatchObject({ id: "n1" });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://project.supabase.co/rest/v1/notifications");
    expect(url).not.toContain("on_conflict");
    expect(init.method).toBe("POST");
  });

  it("says 'already announced' when the same event arrives twice", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json(
          {
            code: "23505",
            message: 'duplicate key value violates unique constraint "notifications_dedupe_idx"',
          },
          { status: 409 }
        )
      )
    );

    await expect(insertNotification(entry)).resolves.toBeNull();
  });

  it("still reports a real failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ message: "permission denied for table notifications" }, { status: 403 }))
    );

    await expect(insertNotification(entry)).rejects.toThrow(/permission denied/);
  });

  it("does not hide a duplicate-looking error on an event with no dedupe key", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ message: "duplicate key value violates unique constraint" }, { status: 409 }))
    );

    await expect(insertNotification({ ...entry, dedupe_key: null })).rejects.toThrow(/duplicate key/);
  });
});
