import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../app/lib/supabase", async (importOriginal) => {
  const original = await importOriginal<typeof import("../app/lib/supabase")>();

  return {
    ...original,
    deleteRecentlyViewedRows: vi.fn(),
    selectPriceListById: vi.fn(),
    selectProductByIdService: vi.fn(),
    selectProductsByIdsService: vi.fn(),
    selectRecentlyViewedRows: vi.fn(),
    updateCustomerSettingsService: vi.fn(),
    upsertRecentlyViewedProduct: vi.fn(),
  };
});

import {
  getRecentlyViewedProducts,
  recordRecentlyViewedProduct,
  updateCustomerSettings,
} from "../app/lib/backend";
import {
  selectProductByIdService,
  selectProductsByIdsService,
  selectRecentlyViewedRows,
  updateCustomerSettingsService,
  upsertRecentlyViewedProduct,
  type CurrentUser,
  type ProductRow,
  type Profile,
} from "../app/lib/supabase";

function profile(overrides: Partial<Profile> = {}): Profile {
  return {
    id: "customer-1",
    email: "customer@example.com",
    full_name: "Customer",
    role: "normal",
    wholesale_status: "not_applied",
    price_list_id: null,
    phone: null,
    shipping_country: "Thailand",
    preferred_language: "en",
    order_updates_enabled: true,
    support_updates_enabled: true,
    marketing_emails_enabled: false,
    ...overrides,
  };
}

function user(overrides: Partial<Profile> = {}): CurrentUser {
  const customerProfile = profile(overrides);

  return {
    id: customerProfile.id,
    email: customerProfile.email,
    role: customerProfile.role,
    profile: customerProfile,
    accessToken: "customer-token",
  };
}

function productRow(id: number): ProductRow {
  return {
    id,
    name: `Product ${id}`,
    type: "laptop",
    category: "Laptop",
    brand: "Apple",
    price: 50_000 + id,
    wholesale_price: null,
    image: "/product.png",
    model_3d: null,
    stock: "In Stock",
    stock_quantity: 10,
    specs: {},
    full_specs: {},
  };
}

beforeEach(() => {
  vi.mocked(updateCustomerSettingsService)
    .mockReset()
    .mockImplementation(async (userId, fields) =>
      profile({ id: userId, ...fields })
    );
  vi.mocked(selectRecentlyViewedRows).mockReset().mockResolvedValue([
    {
      id: "history-2",
      user_id: "customer-1",
      product_id: 2,
      viewed_at: "2026-07-29T12:02:00.000Z",
    },
    {
      id: "history-1",
      user_id: "customer-1",
      product_id: 1,
      viewed_at: "2026-07-29T12:01:00.000Z",
    },
  ]);
  vi.mocked(selectProductsByIdsService)
    .mockReset()
    .mockResolvedValue([productRow(1), productRow(2)]);
  vi.mocked(selectProductByIdService)
    .mockReset()
    .mockResolvedValue(productRow(2));
  vi.mocked(upsertRecentlyViewedProduct).mockReset().mockResolvedValue({
    id: "history-2",
    user_id: "customer-1",
    product_id: 2,
    viewed_at: "2026-07-29T12:02:00.000Z",
  });
});

describe("customer account settings", () => {
  it("updates only the authenticated customer's profile", async () => {
    await updateCustomerSettings(user(), {
      full_name: "  Swan Yi  ",
      phone: " 081 234 5678 ",
      shipping_address_line1: " 123 Demo Road ",
      shipping_address_line2: "",
      shipping_city: " Bangkok ",
      shipping_state: " Bangkok ",
      shipping_postal_code: " 10110 ",
      shipping_country: " Thailand ",
      preferred_language: "my",
      order_updates_enabled: true,
      support_updates_enabled: true,
      marketing_emails_enabled: false,
    });

    expect(updateCustomerSettingsService).toHaveBeenCalledWith("customer-1", {
      full_name: "Swan Yi",
      phone: "081 234 5678",
      shipping_address_line1: "123 Demo Road",
      shipping_address_line2: null,
      shipping_city: "Bangkok",
      shipping_state: "Bangkok",
      shipping_postal_code: "10110",
      shipping_country: "Thailand",
      preferred_language: "my",
      order_updates_enabled: true,
      support_updates_enabled: true,
      marketing_emails_enabled: false,
    });
  });

  it("does not expose customer settings to an admin account", async () => {
    await expect(
      updateCustomerSettings(
        user({ id: "admin-1", role: "admin" }),
        {
          full_name: "Admin",
          phone: "",
          shipping_address_line1: "",
          shipping_address_line2: "",
          shipping_city: "",
          shipping_state: "",
          shipping_postal_code: "",
          shipping_country: "Thailand",
          preferred_language: "en",
          order_updates_enabled: true,
          support_updates_enabled: true,
          marketing_emails_enabled: false,
        }
      )
    ).rejects.toMatchObject({ status: 403 });

    expect(updateCustomerSettingsService).not.toHaveBeenCalled();
  });
});

describe("account-based recently viewed history", () => {
  it("loads history using only the authenticated customer id and keeps view order", async () => {
    const history = await getRecentlyViewedProducts(user());

    expect(selectRecentlyViewedRows).toHaveBeenCalledWith("customer-1", 8);
    expect(history.map((entry) => entry.product.id)).toEqual([2, 1]);
  });

  it("records a product under the authenticated customer id", async () => {
    await recordRecentlyViewedProduct(user(), 2);

    expect(upsertRecentlyViewedProduct).toHaveBeenCalledWith("customer-1", 2);
  });
});
