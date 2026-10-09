import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

// supabase.ts reads its connection settings once, at import time.
vi.hoisted(() => {
  vi.stubEnv("SUPABASE_URL", "https://project.supabase.co");
  vi.stubEnv("SUPABASE_ANON_KEY", "anon-key");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role-key");
});

import { insertAuditLog, selectOrderAuditEvents } from "../app/lib/supabase";

afterEach(() => {
  vi.unstubAllGlobals();
});

afterAll(() => {
  vi.unstubAllEnvs();
});

function stubFetch(response: Response) {
  const fetchMock = vi.fn(async () => response);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const AUDIT_ENTRY = {
  actor_id: "admin-1",
  action: "order.status.update",
  target_type: "order",
  target_id: "order-1",
};

describe("Supabase REST responses", () => {
  // PostgREST answers an insert sent with "Prefer: return=minimal" with 201 and
  // an EMPTY body. Treating that as JSON threw after the row was written, so
  // successful admin actions came back as 500 errors.
  it("accepts the empty 201 that a return=minimal insert returns", async () => {
    const fetchMock = stubFetch(new Response(null, { status: 201 }));

    await expect(insertAuditLog(AUDIT_ENTRY)).resolves.toBeUndefined();

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://project.supabase.co/rest/v1/audit_log");
    expect(init.method).toBe("POST");
    expect(new Headers(init.headers).get("Prefer")).toBe("return=minimal");
  });

  it("still parses a JSON body", async () => {
    const rows = [
      { action: "sheet_stock_deducted", new_data: {}, created_at: "2026-09-15T00:00:00Z" },
    ];
    stubFetch(
      new Response(JSON.stringify(rows), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    await expect(
      selectOrderAuditEvents("order-1", ["sheet_stock_deducted"])
    ).resolves.toEqual(rows);
  });

  it("still reports a failed request", async () => {
    stubFetch(
      new Response(JSON.stringify({ message: "permission denied for table audit_log" }), {
        status: 403,
      })
    );

    await expect(insertAuditLog(AUDIT_ENTRY)).rejects.toThrow(
      "permission denied for table audit_log"
    );
  });
});
