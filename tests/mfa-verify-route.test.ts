import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "../app/api/auth/mfa/verify/route";
import { authenticateBackoffice } from "../app/lib/mfa-routes";
import { mfaChallengeAndVerify } from "../app/lib/supabase";

vi.mock("../app/lib/mfa-routes", async (importOriginal) => ({
  ...await importOriginal<typeof import("../app/lib/mfa-routes")>(),
  authenticateBackoffice: vi.fn(),
}));
vi.mock("../app/lib/supabase", () => ({ mfaChallengeAndVerify: vi.fn() }));
vi.mock("../app/lib/admin-signin", () => ({ scheduleSignInAlert: vi.fn() }));
vi.mock("../app/lib/admin-audit", () => ({ recordAdminAction: vi.fn() }));

const factors = [
  { id: "previous-phone", status: "verified", factor_type: "totp" },
  { id: "current-phone", status: "verified", factor_type: "totp" },
];

function withAuthenticators(available = factors) {
  vi.mocked(authenticateBackoffice).mockResolvedValue({
    accessToken: "password-session",
    profile: {},
    mfa: { realRole: "admin", pending: "verify", factors: available },
  } as Awaited<ReturnType<typeof authenticateBackoffice>>);
}

function verify(body: Record<string, string>) {
  return POST(new NextRequest("https://shop.example/api/auth/mfa/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }));
}

beforeEach(() => {
  vi.resetAllMocks();
  withAuthenticators();
  vi.mocked(mfaChallengeAndVerify).mockResolvedValue({
    access_token: "verified-session",
  } as Awaited<ReturnType<typeof mfaChallengeAndVerify>>);
});

describe("authenticator selection", () => {
  it("verifies against the selected device even when it is the second one", async () => {
    const response = await verify({ code: "012345", factor_id: "current-phone" });

    expect(response.status).toBe(200);
    expect(mfaChallengeAndVerify).toHaveBeenCalledExactlyOnceWith("password-session", "current-phone", "012345");
  });

  it("asks for a choice when several devices are enrolled", async () => {
    const response = await verify({ code: "012345" });

    expect(response.status).toBe(400);
    expect((await response.json()).error).toContain("Choose the authenticator");
    expect(mfaChallengeAndVerify).not.toHaveBeenCalled();
  });

  it("keeps code-only verification working for a single device", async () => {
    withAuthenticators([factors[1]]);
    expect((await verify({ code: "012345" })).status).toBe(200);
    expect(mfaChallengeAndVerify).toHaveBeenCalledExactlyOnceWith("password-session", "current-phone", "012345");
  });

  it("rejects a device outside the signed-in account and any code Supabase rejects", async () => {
    expect((await verify({ code: "012345", factor_id: "foreign-device" })).status).toBe(400);
    expect(mfaChallengeAndVerify).not.toHaveBeenCalled();

    vi.mocked(mfaChallengeAndVerify).mockRejectedValue(new Error("Invalid TOTP"));
    const invalidCode = await verify({ code: "012345", factor_id: "current-phone" });
    expect(invalidCode.status).toBe(400);
    expect(invalidCode.headers.has("set-cookie")).toBe(false);
  });
});
