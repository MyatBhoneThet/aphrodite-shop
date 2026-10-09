import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "../app/api/auth/oauth/callback/route";
import { exchangeOAuthCode, getProfile } from "../app/lib/supabase";
import { OAUTH_VERIFIER_COOKIE } from "../app/lib/oauth";

vi.mock("../app/lib/supabase", () => ({
  exchangeOAuthCode: vi.fn(),
  getProfile: vi.fn(),
}));
vi.mock("../app/lib/rate-limit", () => ({
  checkRateLimit: () => ({ allowed: true }),
}));

beforeEach(() => {
  vi.stubEnv("APP_URL", "https://shop.example.com");
  vi.mocked(exchangeOAuthCode).mockResolvedValue({
    access_token: "test-token",
    user: { id: "customer-1" },
  } as Awaited<ReturnType<typeof exchangeOAuthCode>>);
  vi.mocked(getProfile).mockResolvedValue({ role: "normal" } as Awaited<ReturnType<typeof getProfile>>);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

function callback(query = "code=test-code&provider=google") {
  return new NextRequest(`http://0.0.0.0:3000/api/auth/oauth/callback?${query}`, {
    headers: { cookie: `${OAUTH_VERIFIER_COOKIE}=test-verifier` },
  });
}

describe("OAuth callback behind a proxy", () => {
  it.each(["https://shop.example.com", "http://localhost:3000"])(
    "lands on %s after the first sign-in and sets the session",
    async (origin) => {
      vi.stubEnv("APP_URL", origin);
      const response = await GET(callback());
      expect(response.headers.get("location")).toBe(`${origin}/delivery-area`);
      expect(exchangeOAuthCode).toHaveBeenCalledWith("test-code", "test-verifier");
      expect(response.cookies.get("aphrodite_session")?.value).toBe("test-token");
      expect(response.cookies.get(OAUTH_VERIFIER_COOKIE)?.value).toBe("");
    }
  );

  it("preserves a safe destination and its query", async () => {
    const response = await GET(callback("code=test-code&next=%2Fcart%3Fstep%3D2"));
    expect(response.headers.get("location")).toBe("https://shop.example.com/cart?step=2");
  });

  it("rejects an external destination", async () => {
    const response = await GET(callback("code=test-code&next=https%3A%2F%2Fevil.example"));
    expect(response.headers.get("location")).toBe("https://shop.example.com/delivery-area");
  });

  it("sends administrators to their dashboard", async () => {
    vi.mocked(getProfile).mockResolvedValue({ role: "admin" } as NonNullable<Awaited<ReturnType<typeof getProfile>>>);
    const response = await GET(callback());
    expect(response.headers.get("location")).toBe("https://shop.example.com/admin/dashboard");
    expect(response.cookies.get("aphrodite_admin_session")?.value).toBe("test-token");
  });

  it("returns expired sign-ins to the public login page", async () => {
    const response = await GET(callback("provider=google"));
    const location = new URL(response.headers.get("location")!);
    expect(location.origin + location.pathname).toBe("https://shop.example.com/login");
    expect(location.searchParams.get("error")).toContain("expired");
    expect(exchangeOAuthCode).not.toHaveBeenCalled();
    expect(response.cookies.has("aphrodite_session")).toBe(false);
  });
});
