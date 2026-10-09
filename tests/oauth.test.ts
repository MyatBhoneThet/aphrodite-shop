import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

function stubSupabaseEnv() {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.example.com");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-test-key");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-test-key");
}

describe("PKCE helpers", () => {
  it("derives the S256 challenge Supabase expects", async () => {
    const { createCodeChallenge, createCodeVerifier } = await import(
      "../app/lib/oauth"
    );

    const verifier = createCodeVerifier();
    // RFC 7636 requires 43-128 unreserved characters.
    expect(verifier).toMatch(/^[A-Za-z0-9\-._~]{43,128}$/);

    const challenge = await createCodeChallenge(verifier);
    expect(challenge).toMatch(/^[A-Za-z0-9\-_]{43}$/);
    // Base64url: no padding or characters needing URL escaping.
    expect(challenge).not.toContain("=");
    expect(challenge).toBe(await createCodeChallenge(verifier));

    // A known vector from RFC 7636 appendix B.
    expect(
      await createCodeChallenge(
        "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"
      )
    ).toBe("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
  });

  it("generates a different verifier every time", async () => {
    const { createCodeVerifier } = await import("../app/lib/oauth");
    const verifiers = new Set(
      Array.from({ length: 50 }, () => createCodeVerifier())
    );

    expect(verifiers.size).toBe(50);
  });
});

describe("safeNextPath", () => {
  it("keeps ordinary in-app destinations", async () => {
    const { safeNextPath } = await import("../app/lib/oauth");

    expect(safeNextPath("/cart")).toBe("/cart");
    expect(safeNextPath("/orders?page=2")).toBe("/orders?page=2");
  });

  it("refuses anything that could leave this site", async () => {
    const { OAUTH_DEFAULT_NEXT_PATH, safeNextPath } = await import(
      "../app/lib/oauth"
    );

    for (const attack of [
      "https://evil.example",
      "//evil.example",
      "/\\evil.example",
      "http://evil.example/path",
      "javascript:alert(1)",
      "/ok\nLocation: https://evil.example",
      "",
      null,
      undefined,
    ]) {
      expect(safeNextPath(attack)).toBe(OAUTH_DEFAULT_NEXT_PATH);
    }
  });
});

describe("Supabase OAuth requests", () => {
  it("asks for the PKCE flow on the authorize URL", async () => {
    stubSupabaseEnv();

    const { oauthAuthorizeUrl } = await import("../app/lib/supabase");
    const url = new URL(
      oauthAuthorizeUrl({
        provider: "google",
        redirectTo: "https://shop.example.com/api/auth/oauth/callback?next=%2Fcart",
        codeChallenge: "challenge-value",
      })
    );

    expect(url.origin + url.pathname).toBe(
      "https://project.example.com/auth/v1/authorize"
    );
    expect(url.searchParams.get("provider")).toBe("google");
    expect(url.searchParams.get("code_challenge")).toBe("challenge-value");
    expect(url.searchParams.get("code_challenge_method")).toBe("s256");
    // The callback URL survives intact, with its own `next` still encoded so
    // Supabase hands it back unchanged.
    expect(url.searchParams.get("redirect_to")).toBe(
      "https://shop.example.com/api/auth/oauth/callback?next=%2Fcart"
    );
  });

  it("exchanges the code with the verifier, using the anon key", async () => {
    stubSupabaseEnv();

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          access_token: "access-token",
          refresh_token: "refresh-token",
          user: { id: "user-1", email: "person@example.com" },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    const { exchangeOAuthCode } = await import("../app/lib/supabase");
    const session = await exchangeOAuthCode("auth-code", "code-verifier");

    expect(session.access_token).toBe("access-token");

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = new Headers(init.headers);

    expect(url).toBe("https://project.example.com/auth/v1/token?grant_type=pkce");
    expect(headers.get("apikey")).toBe("anon-test-key");
    // The service role key must never take part in a user-initiated exchange.
    expect(headers.get("Authorization")).toBe("Bearer anon-test-key");
    expect(JSON.parse(String(init.body))).toEqual({
      auth_code: "auth-code",
      code_verifier: "code-verifier",
    });
  });
});
