import { describe, expect, it, vi } from "vitest";
import { checkHealth } from "../app/lib/health";

describe("checkHealth", () => {
  it("plain check never touches the database", async () => {
    const ping = vi.fn();
    const report = await checkHealth({ deep: false, configured: true, pingDatabase: ping });

    expect(report).toEqual({ ok: true, status: "ok", checks: { config: true } });
    expect(ping).not.toHaveBeenCalled();
  });

  it("is unavailable when the server is not configured, deep or not", async () => {
    const ping = vi.fn();
    expect(await checkHealth({ deep: false, configured: false, pingDatabase: ping })).toMatchObject({ ok: false, status: "unavailable" });
    expect(await checkHealth({ deep: true, configured: false, pingDatabase: ping })).toMatchObject({ ok: false });
    expect(ping).not.toHaveBeenCalled();
  });

  it("deep check passes when the database answers", async () => {
    const report = await checkHealth({ deep: true, configured: true, pingDatabase: async () => [1] });
    expect(report).toEqual({ ok: true, status: "ok", checks: { config: true, database: true } });
  });

  it("deep check fails when the database errors, without leaking the error", async () => {
    const report = await checkHealth({
      deep: true,
      configured: true,
      pingDatabase: async () => {
        throw new Error("password authentication failed for user postgres");
      },
    });
    expect(report).toEqual({ ok: false, status: "unavailable", checks: { config: true, database: false } });
    expect(JSON.stringify(report)).not.toContain("password");
  });

  it("deep check fails when the database is too slow", async () => {
    vi.useFakeTimers();
    const pending = checkHealth({ deep: true, configured: true, pingDatabase: () => new Promise(() => undefined), timeoutMs: 5_000 });
    await vi.advanceTimersByTimeAsync(5_001);
    expect(await pending).toMatchObject({ ok: false, checks: { database: false } });
    vi.useRealTimers();
  });
});
