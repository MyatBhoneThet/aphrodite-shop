import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../app/lib/supabase", async (importOriginal) => {
  const original = await importOriginal<typeof import("../app/lib/supabase")>();

  return {
    ...original,
    selectProfileByIdService: vi.fn(),
    updateProfileWholesaleService: vi.fn(),
    insertAuditLog: vi.fn(),
    selectCustomerProfiles: vi.fn(),
    selectPriceListById: vi.fn(),
    selectPriceLists: vi.fn(),
    insertTier: vi.fn(),
    selectTiersAdmin: vi.fn(),
    selectProductById: vi.fn(),
  };
});

import {
  adminCreateTier,
  adminListWholesaleAccounts,
  adminUpdateWholesaleAccount,
} from "../app/lib/backend";
import {
  insertAuditLog,
  insertTier,
  requireAdmin,
  requireBackoffice,
  selectCustomerProfiles,
  selectPriceListById,
  selectProductById,
  selectProfileByIdService,
  selectTiersAdmin,
  updateProfileWholesaleService,
  type CurrentUser,
  type Profile,
} from "../app/lib/supabase";

function profile(overrides: Partial<Profile> = {}): Profile {
  return {
    id: "user-1",
    email: "customer@example.com",
    full_name: "Customer",
    role: "normal",
    wholesale_status: "not_applied",
    price_list_id: null,
    phone: null,
    business_verified_at: "2026-09-03T00:00:00Z",
    ...overrides,
  };
}

function makeUser(overrides: Partial<Profile> = {}): CurrentUser {
  const p = profile(overrides);

  return { id: p.id, email: p.email, role: p.role, profile: p, accessToken: "tok" };
}

const admin = () => makeUser({ id: "admin-1", role: "admin" });
const business = { business_name: "Test reseller", business_review_note: "Called shop and verified business address and reseller purpose.", business_verified: true as const };

beforeEach(() => {
  vi.mocked(selectProfileByIdService).mockReset().mockResolvedValue(profile());
  vi.mocked(updateProfileWholesaleService).mockReset().mockResolvedValue(profile());
  vi.mocked(insertAuditLog).mockReset().mockResolvedValue(undefined);
  vi.mocked(selectCustomerProfiles).mockReset().mockResolvedValue([profile()]);
  vi.mocked(selectPriceListById).mockReset().mockResolvedValue({
    id: "list-1",
    name: "Standard Wholesale",
    description: null,
    is_active: true,
  });
  vi.mocked(insertTier).mockReset();
  vi.mocked(selectTiersAdmin).mockReset().mockResolvedValue([]);
  vi.mocked(selectProductById).mockReset().mockResolvedValue({
    id: 1,
    name: "MacBook Air M2",
    type: "laptop",
    category: "Laptop",
    brand: "Apple",
    price: 50_000,
    wholesale_price: null,
    image: "/x.png",
    model_3d: null,
    stock: "In Stock",
    stock_quantity: 10,
    specs: {},
    full_specs: {},
  });
});

describe("admin-only operations", () => {
  it("requireAdmin rejects non-admin users", () => {
    expect(() => requireAdmin(makeUser())).toThrowError();
    expect(() => requireAdmin(makeUser({ role: "wholesale" }))).toThrowError();
    expect(() => requireAdmin(makeUser({ role: "staff" }))).toThrowError();
    expect(() => requireAdmin(admin())).not.toThrowError();
  });

  it("requireBackoffice accepts staff and admins but rejects customers", () => {
    expect(() => requireBackoffice(makeUser())).toThrowError();
    expect(() => requireBackoffice(makeUser({ role: "wholesale" }))).toThrowError();
    expect(() => requireBackoffice(makeUser({ role: "staff" }))).not.toThrowError();
    expect(() => requireBackoffice(admin())).not.toThrowError();
  });

  it("a non-admin cannot grant wholesale access", async () => {
    await expect(
      adminUpdateWholesaleAccount(makeUser(), "user-2", { action: "grant", ...business })
    ).rejects.toMatchObject({ status: 403 });
    expect(updateProfileWholesaleService).not.toHaveBeenCalled();
  });

  it("a non-admin cannot list customer accounts", async () => {
    await expect(
      adminListWholesaleAccounts(makeUser({ role: "wholesale" }))
    ).rejects.toMatchObject({ status: 403 });
    expect(selectCustomerProfiles).not.toHaveBeenCalled();
  });

  it("a non-admin cannot edit pricing", async () => {
    await expect(
      adminCreateTier(makeUser({ role: "wholesale" }), {
        price_list_id: "list-1",
        product_id: 1,
        min_quantity: 10,
        unit_price: 48_000,
      })
    ).rejects.toMatchObject({ status: 403 });
    expect(insertTier).not.toHaveBeenCalled();
  });

  it("an admin cannot grant wholesale to their own account", async () => {
    await expect(
      adminUpdateWholesaleAccount(admin(), "admin-1", { action: "grant", ...business })
    ).rejects.toMatchObject({ status: 403 });
    expect(updateProfileWholesaleService).not.toHaveBeenCalled();
  });

  it("an admin account cannot be converted to wholesale", async () => {
    vi.mocked(selectProfileByIdService).mockResolvedValue(
      profile({ id: "admin-2", role: "admin" })
    );

    await expect(
      adminUpdateWholesaleAccount(admin(), "admin-2", { action: "grant", ...business })
    ).rejects.toMatchObject({ status: 409 });
    expect(updateProfileWholesaleService).not.toHaveBeenCalled();
  });

  it("granting updates the profile and the audit log", async () => {
    await adminUpdateWholesaleAccount(admin(), "user-1", {
      action: "grant",
      ...business,
      price_list_id: "list-1",
    });

    expect(updateProfileWholesaleService).toHaveBeenCalledWith("user-1", {
      role: "wholesale",
      wholesale_status: "approved",
      price_list_id: "list-1",
      business_name: business.business_name,
      business_verified_at: expect.any(String),
    });
    expect(insertAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        actor_id: "admin-1",
        action: "wholesale.account.grant",
      })
    );
  });

  it("granting twice is rejected", async () => {
    vi.mocked(selectProfileByIdService).mockResolvedValue(
      profile({ role: "wholesale", wholesale_status: "approved" })
    );

    await expect(
      adminUpdateWholesaleAccount(admin(), "user-1", { action: "grant", ...business })
    ).rejects.toMatchObject({ status: 409 });
    expect(updateProfileWholesaleService).not.toHaveBeenCalled();
  });

  it("revoking returns the account to retail and is audited", async () => {
    vi.mocked(selectProfileByIdService).mockResolvedValue(
      profile({ role: "wholesale", wholesale_status: "approved", price_list_id: "list-1" })
    );

    await adminUpdateWholesaleAccount(admin(), "user-1", { action: "revoke" });

    expect(updateProfileWholesaleService).toHaveBeenCalledWith("user-1", {
      role: "normal",
      wholesale_status: "not_applied",
      price_list_id: null,
      business_verified_at: null,
    });
    expect(insertAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "wholesale.account.revoke" })
    );
  });

  it("revoking an account without wholesale access is rejected", async () => {
    await expect(
      adminUpdateWholesaleAccount(admin(), "user-1", { action: "revoke" })
    ).rejects.toMatchObject({ status: 409 });
  });

  it("suspend requires an approved account; reactivate requires a suspended one", async () => {
    vi.mocked(selectProfileByIdService).mockResolvedValue(
      profile({ wholesale_status: "approved" })
    );

    await adminUpdateWholesaleAccount(admin(), "user-1", { action: "suspend" });
    expect(updateProfileWholesaleService).toHaveBeenCalledWith("user-1", {
      wholesale_status: "suspended",
    });

    await expect(
      adminUpdateWholesaleAccount(admin(), "user-1", { action: "reactivate" })
    ).rejects.toMatchObject({ status: 409 });

    vi.mocked(selectProfileByIdService).mockResolvedValue(
      profile({ wholesale_status: "suspended" })
    );

    await adminUpdateWholesaleAccount(admin(), "user-1", { action: "reactivate" });
    expect(updateProfileWholesaleService).toHaveBeenCalledWith("user-1", {
      wholesale_status: "approved",
    });
  });

  it("customers have no path to grant themselves wholesale access", async () => {
    // The only wholesale mutation in the API surface is the admin accounts
    // endpoint; a normal user calling it gets 403 before any write happens.
    await expect(
      adminUpdateWholesaleAccount(makeUser(), "user-1", { action: "grant", ...business })
    ).rejects.toMatchObject({ status: 403 });
    expect(updateProfileWholesaleService).not.toHaveBeenCalled();
    expect(insertAuditLog).not.toHaveBeenCalled();
  });
});

describe("tier validation", () => {
  it("duplicate minimum quantities are rejected as a conflict", async () => {
    vi.mocked(insertTier).mockRejectedValue(
      new Error(
        'duplicate key value violates unique constraint "product_price_tiers_price_list_id_product_id_min_quantity_key"'
      )
    );

    await expect(
      adminCreateTier(admin(), {
        price_list_id: "list-1",
        product_id: 1,
        min_quantity: 10,
        unit_price: 48_000,
      })
    ).rejects.toMatchObject({ status: 409 });
  });

  it("invalid effective date ranges are rejected", async () => {
    await expect(
      adminCreateTier(admin(), {
        price_list_id: "list-1",
        product_id: 1,
        min_quantity: 10,
        unit_price: 48_000,
        effective_from: "2026-08-01T00:00:00Z",
        effective_to: "2026-07-01T00:00:00Z",
      })
    ).rejects.toMatchObject({ status: 400 });
    expect(insertTier).not.toHaveBeenCalled();
  });

  it("tiers for nonexistent products are rejected", async () => {
    vi.mocked(selectProductById).mockResolvedValue(null as never);

    await expect(
      adminCreateTier(admin(), {
        price_list_id: "list-1",
        product_id: 999,
        min_quantity: 10,
        unit_price: 48_000,
      })
    ).rejects.toMatchObject({ status: 404 });
  });

  it("tiers for nonexistent price lists are rejected", async () => {
    vi.mocked(selectPriceListById).mockResolvedValue(null as never);

    await expect(
      adminCreateTier(admin(), {
        price_list_id: "3f9d8e60-0000-0000-0000-000000000000",
        product_id: 1,
        min_quantity: 10,
        unit_price: 48_000,
      })
    ).rejects.toMatchObject({ status: 404 });
  });
});
