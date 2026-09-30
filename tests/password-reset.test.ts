import { afterEach, describe, expect, it, vi } from "vitest";

const mail = vi.hoisted(() => ({
  createTransport: vi.fn(),
  sendMail: vi.fn(),
}));

vi.mock("nodemailer", () => ({
  default: { createTransport: mail.createTransport },
}));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  vi.resetModules();
});

function stubSupabaseEnv() {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.example.com");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-test-key");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-test-key");
}

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

describe("recovery token minting", () => {
  it("uses the admin endpoint with the service role key", async () => {
    stubSupabaseEnv();

    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ hashed_token: "hashed-token-value" }));
    vi.stubGlobal("fetch", fetchMock);

    const { generatePasswordRecoveryToken } = await import(
      "../app/lib/supabase"
    );

    expect(await generatePasswordRecoveryToken("person@example.com")).toBe(
      "hashed-token-value"
    );

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = new Headers(init.headers);

    expect(url).toBe(
      "https://project.example.com/auth/v1/admin/generate_link"
    );
    expect(headers.get("Authorization")).toBe("Bearer service-test-key");
    expect(JSON.parse(String(init.body))).toEqual({
      type: "recovery",
      email: "person@example.com",
    });
  });

  it("reads the token from the older nested response shape", async () => {
    stubSupabaseEnv();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({ properties: { hashed_token: "nested-token" } })
      )
    );

    const { generatePasswordRecoveryToken } = await import(
      "../app/lib/supabase"
    );

    expect(await generatePasswordRecoveryToken("person@example.com")).toBe(
      "nested-token"
    );
  });
});

describe("redeeming a recovery token", () => {
  it("verifies with the anon key and never the service role key", async () => {
    stubSupabaseEnv();

    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        access_token: "recovery-access-token",
        refresh_token: "refresh",
        user: { id: "user-1", email: "person@example.com" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const { verifyRecoveryToken } = await import("../app/lib/supabase");
    const session = await verifyRecoveryToken("hashed-token-value");

    expect(session.access_token).toBe("recovery-access-token");

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = new Headers(init.headers);

    expect(url).toBe("https://project.example.com/auth/v1/verify");
    expect(headers.get("apikey")).toBe("anon-test-key");
    expect(headers.get("Authorization")).toBe("Bearer anon-test-key");
    expect(JSON.parse(String(init.body))).toEqual({
      type: "recovery",
      token_hash: "hashed-token-value",
    });
  });

  it("writes the new password with the session the token granted", async () => {
    stubSupabaseEnv();

    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ id: "user-1" }));
    vi.stubGlobal("fetch", fetchMock);

    const { updateUserPassword } = await import("../app/lib/supabase");
    await updateUserPassword("recovery-access-token", "brand-new-password");

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = new Headers(init.headers);

    expect(url).toBe("https://project.example.com/auth/v1/user");
    expect(init.method).toBe("PUT");
    expect(headers.get("Authorization")).toBe("Bearer recovery-access-token");
    expect(JSON.parse(String(init.body))).toEqual({
      password: "brand-new-password",
    });
  });
});

describe("the reset email", () => {
  it("carries the link and no other account detail", async () => {
    const { passwordResetEmailContent } = await import(
      "../app/lib/password-reset-email"
    );

    const url = "https://shop.example.com/reset-password?token=hashed-token";
    const content = passwordResetEmailContent(url);

    expect(content.subject).toBe("Reset your Aphrodite Myanmar password");
    expect(content.html).toContain(`href="${url}"`);
    expect(content.text).toContain(url);
    // Somebody who did not ask must be told that ignoring it is safe.
    expect(content.text).toMatch(/did not ask/i);
  });

  it("escapes a link so it cannot inject markup", async () => {
    const { passwordResetEmailContent } = await import(
      "../app/lib/password-reset-email"
    );

    const content = passwordResetEmailContent(
      'https://shop.example.com/reset-password?token="><script>x</script>'
    );

    expect(content.html).not.toContain("<script>");
    expect(content.html).toContain("&quot;&gt;&lt;script&gt;");
  });

  it("sends through the shop's Gmail account", async () => {
    vi.stubEnv("GMAIL_USER", "aphrodite.store.mm@gmail.com");
    vi.stubEnv("GMAIL_APP_PASSWORD", "abcd efgh ijkl mnop");
    mail.createTransport.mockReturnValue({ sendMail: mail.sendMail });

    const { sendPasswordResetEmail } = await import(
      "../app/lib/password-reset-email"
    );
    const result = await sendPasswordResetEmail(
      "person@example.com",
      "https://shop.example.com/reset-password?token=hashed-token"
    );

    expect(result.status).toBe("sent");
    // The App Password's display spaces must be stripped before login.
    expect(mail.createTransport.mock.calls[0][0]).toMatchObject({
      host: "smtp.gmail.com",
      auth: { pass: "abcdefghijklmnop" },
    });
    expect(mail.sendMail.mock.calls[0][0]).toMatchObject({
      to: "person@example.com",
      subject: "Reset your Aphrodite Myanmar password",
    });
  });

  it("reports rather than throws when no mail provider is configured", async () => {
    const { sendPasswordResetEmail } = await import(
      "../app/lib/password-reset-email"
    );

    expect(
      (
        await sendPasswordResetEmail(
          "person@example.com",
          "https://shop.example.com/reset-password?token=t"
        )
      ).status
    ).toBe("not_configured");
  });
});

describe("reset request validation", () => {
  it("requires a token and a password of at least 8 characters", async () => {
    const { passwordResetSchema } = await import("../app/lib/validation");

    expect(
      passwordResetSchema.safeParse({ token: "t", password: "short" }).success
    ).toBe(false);
    expect(passwordResetSchema.safeParse({ password: "long-enough" }).success).toBe(
      false
    );
    expect(
      passwordResetSchema.safeParse({ token: "t", password: "long-enough" })
        .success
    ).toBe(true);
  });
});
