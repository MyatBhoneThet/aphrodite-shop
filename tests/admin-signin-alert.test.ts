import { describe, expect, it } from "vitest";
import { alertRecipients, describeDevice, signInAlertEmail } from "../app/lib/admin-signin";

describe("admin sign-in alert", () => {
  it("describes the device in plain words", () => {
    expect(describeDevice("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605 Chrome/120 Safari/537")).toBe("Chrome on macOS");
    expect(describeDevice("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) AppleWebKit Version/17 Safari/604")).toBe("Safari on iOS");
    expect(describeDevice(null)).toBe("Unknown browser on unknown device");
  });

  it("emails the account plus any extra alert addresses, once each", () => {
    expect(alertRecipients("Owner@Shop.com", {})).toEqual(["owner@shop.com"]);
    expect(alertRecipients("a@shop.com", { ADMIN_ALERT_EMAIL: "boss@x.com, A@shop.com ,," })).toEqual(["a@shop.com", "boss@x.com"]);
  });

  it("escapes anything that came from outside", () => {
    const mail = signInAlertEmail({ name: '<img src=x onerror=alert(1)>', email: "a@b.c", role: "Administrator", ip: "1.2.3.4", device: "Chrome on macOS", when: "2026-10-10 09:00", method: "Email and password" });
    expect(mail.html).not.toContain("<img");
    expect(mail.html).toContain("&lt;img");
    expect(mail.text).toContain("1.2.3.4");
    expect(mail.subject).toMatch(/New admin sign-in/);
  });
});
