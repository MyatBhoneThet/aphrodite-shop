import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("public registration", () => {
  it("uses anonymous signup, does not force confirmation, and requests no role", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.example.com");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-test-key");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-test-key");

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          user: { id: "user-1", email: "new@example.com" },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    const { registerUser } = await import("../app/lib/supabase");
    const result = await registerUser({
      email: "new@example.com",
      password: "long-enough-password",
      fullName: "New User",
    });

    expect(result.requiresEmailVerification).toBe(true);
    expect(fetchMock).toHaveBeenCalledOnce();

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const payload = JSON.parse(String(init.body)) as Record<string, unknown>;
    const headers = new Headers(init.headers);

    expect(url).toBe("https://project.example.com/auth/v1/signup");
    expect(headers.get("apikey")).toBe("anon-test-key");
    expect(headers.get("Authorization")).toBe("Bearer anon-test-key");
    expect(payload).toEqual({
      email: "new@example.com",
      password: "long-enough-password",
      data: { full_name: "New User" },
    });
    expect(payload).not.toHaveProperty("email_confirm");
    expect(JSON.stringify(payload)).not.toContain("role");
  });
});
