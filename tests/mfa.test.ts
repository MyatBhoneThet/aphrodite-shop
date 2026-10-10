import { describe, expect, it } from "vitest";
import { computeMfaState, decodeClaims, FRESH_WINDOW_SECONDS, requireFreshAuth, type AuthFactor } from "../app/lib/mfa";
import type { CurrentUser } from "../app/lib/supabase";

const NOW = 1_800_000_000;
const token = (claims: Record<string, unknown>) =>
  `h.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.s`;
const totp = (status = "verified"): AuthFactor => ({ id: "f1", status, factor_type: "totp" });
const aal2 = (age = 30) =>
  token({ aal: "aal2", iat: NOW - age, amr: [{ method: "totp", timestamp: NOW - age }, { method: "password", timestamp: NOW - age - 20 }] });
const aal1 = (age = 30) => token({ aal: "aal1", iat: NOW - age, amr: [{ method: "password", timestamp: NOW - age }] });

describe("reading the token", () => {
  it("decodes claims and survives garbage", () => {
    expect(decodeClaims(aal2()).aal).toBe("aal2");
    expect(decodeClaims("nonsense")).toEqual({});
    expect(decodeClaims("a.%%%.c")).toEqual({});
  });
});

describe("two-step state", () => {
  it("leaves customers alone", () => {
    const state = computeMfaState({ role: "normal", factors: [], token: aal1(), now: NOW, env: {} });
    expect(state.pending).toBeNull();
    expect(state.fresh).toBe(true);
  });

  it("holds an enrolled admin back until a code is confirmed", () => {
    const held = computeMfaState({ role: "admin", factors: [totp()], token: aal1(), now: NOW, env: {} });
    expect(held).toMatchObject({ enrolled: true, aal: "aal1", pending: "verify", fresh: false });
    const ok = computeMfaState({ role: "admin", factors: [totp()], token: aal2(), now: NOW, env: {} });
    expect(ok).toMatchObject({ aal: "aal2", pending: null, fresh: true });
  });

  it("does not hold back an admin who has not set it up, unless required for everyone", () => {
    expect(computeMfaState({ role: "admin", factors: [], token: aal1(), now: NOW, env: {} }).pending).toBeNull();
    expect(computeMfaState({ role: "staff", factors: [], token: aal1(), now: NOW, env: { ADMIN_MFA_REQUIRED: "all" } as never }).pending).toBe("enroll");
    expect(computeMfaState({ role: "admin", factors: [totp("unverified")], token: aal1(), now: NOW, env: {} }).enrolled).toBe(false);
  });

  it("an enrolled admin is only 'fresh' for ten minutes after a code", () => {
    const at = (age: number) => computeMfaState({ role: "admin", factors: [totp()], token: aal2(age), now: NOW, env: {} }).fresh;
    expect(at(60)).toBe(true);
    expect(at(FRESH_WINDOW_SECONDS + 5)).toBe(false);
  });

  it("an admin without two-step is fresh only just after signing in with the password", () => {
    const at = (age: number) => computeMfaState({ role: "admin", factors: [], token: aal1(age), now: NOW, env: {} }).fresh;
    expect(at(60)).toBe(true);
    expect(at(3 * 3600)).toBe(false);
  });
});

describe("risky-action gate", () => {
  const user = (mfa: unknown) => ({ id: "u", role: "admin", mfa }) as unknown as CurrentUser;
  const fresh = { realRole: "admin", enrolled: true, aal: "aal2", pending: null, fresh: true, recentSignIn: true, factors: [] };

  it("passes only when freshly confirmed", () => {
    expect(() => requireFreshAuth(user(fresh))).not.toThrow();
  });
  it("asks again when stale, with the right wording", () => {
    expect(() => requireFreshAuth(user({ ...fresh, fresh: false }))).toThrow(/authenticator/);
    expect(() => requireFreshAuth(user({ ...fresh, enrolled: false, fresh: false }))).toThrow(/password/);
  });
  it("fails closed with no two-step information, and refuses held-back sessions", () => {
    expect(() => requireFreshAuth(user(undefined))).toThrow();
    expect(() => requireFreshAuth(user({ ...fresh, pending: "verify", fresh: false }))).toThrow();
  });
});
