import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

/**
 * Supabase reads its configuration once, at module load, so every stub has to
 * be in place before the dynamic import below -- hence `vi.resetModules()` in
 * the teardown above.
 */
function stubSupabaseEnv() {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.example.com");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-test-key");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-test-key");
}

function stubLineEnv() {
  vi.stubEnv("LINE_LOGIN_CHANNEL_ID", "line-channel-id");
  vi.stubEnv("LINE_LOGIN_CHANNEL_SECRET", "line-channel-secret");
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** The form body of the nth fetch call, as a plain object. */
function formBody(fetchMock: ReturnType<typeof vi.fn>, index: number) {
  const [, init] = fetchMock.mock.calls[index] as [string, RequestInit];
  return Object.fromEntries(new URLSearchParams(String(init.body)));
}

describe("enabledSocialProviders", () => {
  it("offers every provider whose credentials are present", async () => {
    stubSupabaseEnv();
    stubLineEnv();

    const { enabledSocialProviders } = await import("../app/lib/social-login");

    // Fixed display order, not the order anything was configured in.
    expect(enabledSocialProviders()).toEqual(["google", "facebook", "line"]);
  });

  it("hides LINE until its channel credentials are set", async () => {
    stubSupabaseEnv();

    const { enabledSocialProviders } = await import("../app/lib/social-login");

    // Google and Facebook need nothing here: their keys live in Supabase.
    expect(enabledSocialProviders()).toEqual(["google", "facebook"]);
  });

  it("offers nothing at all when Supabase is unconfigured", async () => {
    const { enabledSocialProviders } = await import("../app/lib/social-login");

    expect(enabledSocialProviders()).toEqual([]);
  });

  it("lets SOCIAL_LOGIN_PROVIDERS narrow the list", async () => {
    stubSupabaseEnv();
    stubLineEnv();
    // Spacing, case and ordering are the operator's business, not ours.
    vi.stubEnv("SOCIAL_LOGIN_PROVIDERS", " LINE , google ");

    const { enabledSocialProviders } = await import("../app/lib/social-login");

    expect(enabledSocialProviders()).toEqual(["google", "line"]);
  });

  it("ignores names it does not recognise rather than breaking the page", async () => {
    stubSupabaseEnv();
    vi.stubEnv("SOCIAL_LOGIN_PROVIDERS", "google,tiktok");

    const { enabledSocialProviders } = await import("../app/lib/social-login");

    expect(enabledSocialProviders()).toEqual(["google"]);
  });

  it("still requires credentials for a provider that was named", async () => {
    stubSupabaseEnv();
    vi.stubEnv("SOCIAL_LOGIN_PROVIDERS", "google,line");

    const { enabledSocialProviders } = await import("../app/lib/social-login");

    // LINE was asked for, but its channel credentials are absent.
    expect(enabledSocialProviders()).toEqual(["google"]);
  });
});

describe("Google through Supabase", () => {
  it("carries the provider through to the callback, PKCE intact", async () => {
    stubSupabaseEnv();

    const { oauthAuthorizeUrl } = await import("../app/lib/supabase");
    const url = new URL(
      oauthAuthorizeUrl({
        provider: "google",
        redirectTo:
          "https://shop.example.com/api/auth/oauth/callback?next=%2Fcart&provider=google",
        codeChallenge: "challenge-value",
      })
    );

    expect(url.searchParams.get("provider")).toBe("google");
    expect(url.searchParams.get("code_challenge_method")).toBe("s256");
    // The callback URL survives intact, so the callback can name the service
    // in any message it has to show.
    expect(url.searchParams.get("redirect_to")).toBe(
      "https://shop.example.com/api/auth/oauth/callback?next=%2Fcart&provider=google"
    );
  });
});

describe("Facebook through Supabase", () => {
  it("reuses the shared PKCE callback, only the provider differs", async () => {
    stubSupabaseEnv();

    const { oauthAuthorizeUrl } = await import("../app/lib/supabase");
    const url = new URL(
      oauthAuthorizeUrl({
        provider: "facebook",
        redirectTo:
          "https://shop.example.com/api/auth/oauth/callback?next=%2Fcart&provider=facebook",
        codeChallenge: "challenge-value",
      })
    );

    expect(url.origin + url.pathname).toBe(
      "https://project.example.com/auth/v1/authorize"
    );
    expect(url.searchParams.get("provider")).toBe("facebook");
    expect(url.searchParams.get("code_challenge_method")).toBe("s256");
  });
});

describe("timingSafeEquals", () => {
  it("matches identical values and rejects everything else", async () => {
    const { timingSafeEquals } = await import("../app/lib/oauth");

    expect(timingSafeEquals("abc123", "abc123")).toBe(true);
    expect(timingSafeEquals("abc123", "abc124")).toBe(false);
    // A shared prefix must not be treated as a match.
    expect(timingSafeEquals("abc123", "abc")).toBe(false);
    expect(timingSafeEquals("", "")).toBe(true);
  });
});

describe("LINE authorize URL", () => {
  it("asks for an id_token with PKCE, state and nonce", async () => {
    stubLineEnv();

    const { lineAuthorizeUrl, lineCallbackUrl } = await import(
      "../app/lib/line-auth"
    );

    const redirectUri = lineCallbackUrl("https://shop.example.com");
    expect(redirectUri).toBe(
      "https://shop.example.com/api/auth/oauth/line/callback"
    );

    const url = new URL(
      lineAuthorizeUrl({
        redirectUri,
        state: "state-value",
        nonce: "nonce-value",
        codeChallenge: "challenge-value",
      })
    );

    expect(url.origin + url.pathname).toBe(
      "https://access.line.me/oauth2/v2.1/authorize"
    );
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("client_id")).toBe("line-channel-id");
    expect(url.searchParams.get("redirect_uri")).toBe(redirectUri);
    expect(url.searchParams.get("state")).toBe("state-value");
    expect(url.searchParams.get("nonce")).toBe("nonce-value");
    expect(url.searchParams.get("code_challenge")).toBe("challenge-value");
    // LINE spells the method in upper case, unlike GoTrue's "s256".
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    // Without `email` there is no address to attach an account to.
    expect(url.searchParams.get("scope")).toBe("openid profile email");
    // The channel secret must never travel through the browser.
    expect(url.search).not.toContain("line-channel-secret");
  });

  it("refuses to start when the channel is not configured", async () => {
    const { isLineLoginConfigured, lineAuthorizeUrl } = await import(
      "../app/lib/line-auth"
    );

    expect(isLineLoginConfigured()).toBe(false);
    expect(() =>
      lineAuthorizeUrl({
        redirectUri: "https://shop.example.com/api/auth/oauth/line/callback",
        state: "s",
        nonce: "n",
        codeChallenge: "c",
      })
    ).toThrow(/not configured/i);
  });
});

describe("resolveLineIdentity", () => {
  it("redeems the code with PKCE, then has LINE verify its own id_token", async () => {
    stubLineEnv();

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ id_token: "line-id-token" }))
      .mockResolvedValueOnce(
        jsonResponse({
          sub: "U1234",
          email: "Customer@Example.com",
          name: "  Nilar  ",
        })
      );
    vi.stubGlobal("fetch", fetchMock);

    const { resolveLineIdentity } = await import("../app/lib/line-auth");

    const identity = await resolveLineIdentity({
      code: "auth-code",
      redirectUri: "https://shop.example.com/api/auth/oauth/line/callback",
      codeVerifier: "code-verifier",
      nonce: "nonce-value",
    });

    const [tokenUrl] = fetchMock.mock.calls[0] as [string];
    expect(tokenUrl).toBe("https://api.line.me/oauth2/v2.1/token");
    expect(formBody(fetchMock, 0)).toEqual({
      grant_type: "authorization_code",
      code: "auth-code",
      redirect_uri: "https://shop.example.com/api/auth/oauth/line/callback",
      client_id: "line-channel-id",
      client_secret: "line-channel-secret",
      code_verifier: "code-verifier",
    });

    const [verifyUrl] = fetchMock.mock.calls[1] as [string];
    expect(verifyUrl).toBe("https://api.line.me/oauth2/v2.1/verify");
    // Sending the nonce and the channel id is what makes LINE reject a token
    // minted for another sign-in, or for another channel.
    expect(formBody(fetchMock, 1)).toEqual({
      id_token: "line-id-token",
      client_id: "line-channel-id",
      nonce: "nonce-value",
    });

    // GoTrue folds addresses to lower case; matching that here stops
    // "Customer@..." and "customer@..." becoming two accounts.
    expect(identity).toEqual({
      sub: "U1234",
      email: "customer@example.com",
      name: "Nilar",
    });
  });

  it("reports no email when the channel lacks LINE's email permission", async () => {
    stubLineEnv();

    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(jsonResponse({ id_token: "line-id-token" }))
        .mockResolvedValueOnce(jsonResponse({ sub: "U1234", name: "Nilar" }))
    );

    const { resolveLineIdentity } = await import("../app/lib/line-auth");

    const identity = await resolveLineIdentity({
      code: "auth-code",
      redirectUri: "https://shop.example.com/api/auth/oauth/line/callback",
      codeVerifier: "code-verifier",
      nonce: "nonce-value",
    });

    // The callback turns this into "use another sign-in method" rather than
    // inventing an address.
    expect(identity.email).toBeNull();
  });

  it("stops at the token step when LINE rejects the code", async () => {
    stubLineEnv();

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(
          { error: "invalid_grant", error_description: "code expired" },
          400
        )
      );
    vi.stubGlobal("fetch", fetchMock);

    const { resolveLineIdentity } = await import("../app/lib/line-auth");

    await expect(
      resolveLineIdentity({
        code: "auth-code",
        redirectUri: "https://shop.example.com/api/auth/oauth/line/callback",
        codeVerifier: "code-verifier",
        nonce: "nonce-value",
      })
    ).rejects.toThrow("code expired");

    // No verify call: a failed exchange must not reach the next step.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("refuses an id_token LINE will not vouch for", async () => {
    stubLineEnv();

    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(jsonResponse({ id_token: "line-id-token" }))
        .mockResolvedValueOnce(
          jsonResponse(
            { error: "invalid_request", error_description: "invalid nonce" },
            400
          )
        )
    );

    const { resolveLineIdentity } = await import("../app/lib/line-auth");

    await expect(
      resolveLineIdentity({
        code: "auth-code",
        redirectUri: "https://shop.example.com/api/auth/oauth/line/callback",
        codeVerifier: "code-verifier",
        nonce: "replayed-nonce",
      })
    ).rejects.toThrow("invalid nonce");
  });
});

describe("createSessionForVerifiedEmail", () => {
  it("mints the link as the service role, then redeems it as the anon key", async () => {
    stubSupabaseEnv();

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ hashed_token: "hashed-token" }))
      .mockResolvedValueOnce(
        jsonResponse({
          access_token: "access-token",
          refresh_token: "refresh-token",
          user: { id: "user-1", email: "customer@example.com" },
        })
      );
    vi.stubGlobal("fetch", fetchMock);

    const { createSessionForVerifiedEmail } = await import(
      "../app/lib/supabase"
    );

    const session = await createSessionForVerifiedEmail("Customer@Example.com");
    expect(session.access_token).toBe("access-token");

    const [linkUrl, linkInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(linkUrl).toBe(
      "https://project.example.com/auth/v1/admin/generate_link"
    );
    expect(new Headers(linkInit.headers).get("apikey")).toBe("service-test-key");
    expect(JSON.parse(String(linkInit.body))).toEqual({
      type: "magiclink",
      email: "customer@example.com",
    });

    const [verifyUrl, verifyInit] = fetchMock.mock.calls[1] as [
      string,
      RequestInit,
    ];
    expect(verifyUrl).toBe("https://project.example.com/auth/v1/verify");
    // The session itself is created with the anon key, exactly as it would be
    // if the customer had clicked the link in an email.
    expect(new Headers(verifyInit.headers).get("apikey")).toBe("anon-test-key");
    expect(new Headers(verifyInit.headers).get("Authorization")).toBe(
      "Bearer anon-test-key"
    );
    expect(JSON.parse(String(verifyInit.body))).toEqual({
      type: "magiclink",
      token_hash: "hashed-token",
    });
  });

  it("reads the token from `properties` on older GoTrue releases", async () => {
    stubSupabaseEnv();

    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          jsonResponse({ properties: { hashed_token: "nested-token" } })
        )
        .mockResolvedValueOnce(
          jsonResponse({
            access_token: "access-token",
            refresh_token: "refresh-token",
            user: { id: "user-1" },
          })
        )
    );

    const { createSessionForVerifiedEmail } = await import(
      "../app/lib/supabase"
    );

    await expect(
      createSessionForVerifiedEmail("customer@example.com")
    ).resolves.toMatchObject({ access_token: "access-token" });
  });

  it("refuses to carry on when Supabase returns no token", async () => {
    stubSupabaseEnv();

    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({}));
    vi.stubGlobal("fetch", fetchMock);

    const { createSessionForVerifiedEmail } = await import(
      "../app/lib/supabase"
    );

    await expect(
      createSessionForVerifiedEmail("customer@example.com")
    ).rejects.toThrow(/sign-in token/i);

    // Nothing is redeemed, so no session is created.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("createFederatedUser", () => {
  it("creates a confirmed, passwordless account with no role of its own", async () => {
    stubSupabaseEnv();

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({ id: "user-1", email: "customer@example.com" })
      );
    vi.stubGlobal("fetch", fetchMock);

    const { createFederatedUser } = await import("../app/lib/supabase");

    const user = await createFederatedUser({
      email: "Customer@Example.com",
      fullName: "Nilar",
    });

    expect(user.id).toBe("user-1");

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://project.example.com/auth/v1/admin/users");

    const body = JSON.parse(String(init.body));
    expect(body).toEqual({
      email: "customer@example.com",
      email_confirm: true,
      user_metadata: { full_name: "Nilar" },
    });
    // No password is set, and no role is asked for: the
    // `on_auth_user_created` trigger always writes 'normal'.
    expect(body).not.toHaveProperty("password");
    expect(body).not.toHaveProperty("role");
  });
});
