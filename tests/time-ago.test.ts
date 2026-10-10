import { describe, expect, it } from "vitest";
import { timeAgo } from "../app/lib/useNotifications";

const NOW = Date.parse("2026-10-12T12:00:00Z");
const ago = (seconds: number) => new Date(NOW - seconds * 1000).toISOString();

describe("timeAgo", () => {
  it("says 'now' for the last minute, then minutes, hours and days", () => {
    expect(timeAgo(ago(5), "en", NOW)).toMatch(/now|seconds? ago/);
    expect(timeAgo(ago(5 * 60), "en", NOW)).toBe("5 minutes ago");
    expect(timeAgo(ago(3 * 3600), "en", NOW)).toBe("3 hours ago");
    expect(timeAgo(ago(2 * 86400), "en", NOW)).toBe("2 days ago");
  });
  it("works in Burmese without throwing", () => {
    expect(timeAgo(ago(3600), "my", NOW).length).toBeGreaterThan(0);
  });
});
