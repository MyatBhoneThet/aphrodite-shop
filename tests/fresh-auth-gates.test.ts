import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../app/lib/supabase", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../app/lib/supabase")>()),
  selectProductByIdService: vi.fn(),
  patchProductColumns: vi.fn(),
  deleteProduct: vi.fn(),
  insertAuditLog: vi.fn(),
  selectProfileByEmailService: vi.fn(),
  setProfileRoleService: vi.fn(),
  selectProfileByIdService: vi.fn(),
  deleteAuthUserService: vi.fn(),
}));

import { adminDeleteStaff, adminGrantStaff, removeProduct } from "../app/lib/backend";
import * as db from "../app/lib/supabase";
import type { CurrentUser } from "../app/lib/supabase";

const base = { realRole: "admin", enrolled: true, aal: "aal2", pending: null, recentSignIn: true, factors: [] };
const admin = (mfa: unknown) => ({ id: "admin-1", role: "admin", mfa }) as unknown as CurrentUser;
const fresh = admin({ ...base, fresh: true });
const stale = admin({ ...base, fresh: false });

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(db.insertAuditLog).mockResolvedValue(undefined);
  vi.mocked(db.patchProductColumns).mockResolvedValue(undefined);
  vi.mocked(db.selectProductByIdService).mockResolvedValue({ id: 5, name: "X", price: 1 } as never);
  vi.mocked(db.selectProfileByEmailService).mockResolvedValue({ id: "p1", role: "normal", email: "a@b.c" } as never);
  vi.mocked(db.setProfileRoleService).mockResolvedValue({ id: "p1" } as never);
  vi.mocked(db.selectProfileByIdService).mockResolvedValue({ id: "p2", role: "staff", email: "s@b.c" } as never);
});

describe("risky actions need a fresh confirmation", () => {
  it("deleting a product", async () => {
    await expect(removeProduct(stale, 5)).rejects.toMatchObject({ code: "reauth_required" });
    expect(db.patchProductColumns).not.toHaveBeenCalled();
    // Deleting moves the product to Recently deleted; nothing is erased yet.
    await removeProduct(fresh, 5);
    expect(db.patchProductColumns).toHaveBeenCalledWith(5, expect.objectContaining({ stock_quantity: 0 }));
    expect(db.deleteProduct).not.toHaveBeenCalled();
  });

  it("giving someone staff access", async () => {
    await expect(adminGrantStaff(stale, "a@b.c")).rejects.toMatchObject({ code: "reauth_required" });
    expect(db.setProfileRoleService).not.toHaveBeenCalled();
    await adminGrantStaff(fresh, "a@b.c");
    expect(db.setProfileRoleService).toHaveBeenCalledWith("p1", "staff");
  });

  it("removing staff access", async () => {
    await expect(adminDeleteStaff(stale, "p2")).rejects.toMatchObject({ code: "reauth_required" });
    expect(db.deleteAuthUserService).not.toHaveBeenCalled();
    await adminDeleteStaff(fresh, "p2");
    expect(db.deleteAuthUserService).toHaveBeenCalledWith("p2");
  });

  it("a stolen, held-back session gets nowhere (it is a customer there anyway)", async () => {
    const held = { id: "admin-1", role: "normal", mfa: { ...base, pending: "verify", fresh: false } } as unknown as CurrentUser;
    await expect(removeProduct(held, 5)).rejects.toMatchObject({ status: 403 });
    expect(db.patchProductColumns).not.toHaveBeenCalled();
    expect(db.deleteProduct).not.toHaveBeenCalled();
  });
});
