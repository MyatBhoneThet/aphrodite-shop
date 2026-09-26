import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../app/lib/supabase", async (importOriginal) => {
  const original = await importOriginal<typeof import("../app/lib/supabase")>();
  return {
    ...original,
    selectOrders: vi.fn(),
    selectProfilesByIdsService: vi.fn(),
    selectReturnRequests: vi.fn(),
  };
});

import { getOrders } from "../app/lib/backend";
import {
  selectOrders,
  selectProfilesByIdsService,
  selectReturnRequests,
  type CurrentUser,
  type OrderRow,
  type Profile,
  type ReturnRequestRow,
} from "../app/lib/supabase";

const adminProfile = {
  id: "admin-1",
  email: "admin@example.com",
  full_name: "Admin",
  role: "admin",
  wholesale_status: "not_applied",
  price_list_id: null,
  phone: null,
} satisfies Profile;

const admin: CurrentUser = {
  id: adminProfile.id,
  email: adminProfile.email,
  role: "admin",
  profile: adminProfile,
  accessToken: "token",
};

const staff: CurrentUser = {
  ...admin,
  id: "staff-1",
  email: "staff@example.com",
  role: "staff",
  profile: { ...adminProfile, id: "staff-1", email: "staff@example.com", role: "staff" },
};

const order = {
  id: "order-1",
  user_id: "customer-1",
  status: "delivered",
  total_amount: 100000,
  shipping_name: "Customer",
  shipping_phone: "0912345678",
  shipping_address: "Yangon",
  shipping_address_line1: "Yangon",
  shipping_address_line2: null,
  shipping_city: "Yangon",
  shipping_state: "Yangon",
  shipping_postal_code: null,
  shipping_country: "Myanmar",
  payment_method: "cash_on_delivery",
  payment_status: "collected",
  cancellation_request_status: "none",
  cancellation_reason: null,
  cancellation_requested_at: null,
  cancellation_resolved_at: null,
  return_request_status: "none",
  return_reason: null,
  return_requested_at: null,
  return_resolved_at: null,
  admin_order_note: null,
  notes: null,
  created_at: "2026-09-24T00:00:00Z",
  updated_at: "2026-09-24T00:00:00Z",
  profiles: null,
  order_items: [],
} satisfies OrderRow;

beforeEach(() => {
  vi.mocked(selectOrders).mockReset().mockResolvedValue([order]);
  vi.mocked(selectProfilesByIdsService).mockReset().mockResolvedValue([
    {
      id: "customer-1",
      email: "login@example.com",
      full_name: "Customer",
      role: "normal",
      wholesale_status: "not_applied",
      price_list_id: null,
      phone: "0912345678",
    },
  ]);
  vi.mocked(selectReturnRequests).mockReset().mockResolvedValue([]);
});

describe("admin order customer details", () => {
  it("redacts customer contact and location details from staff", async () => {
    const [result] = await getOrders(staff);

    expect(result.profiles?.email ?? "").toBe("");
    expect(result.shipping_phone).toBe("");
    expect(result.shipping_address).toBe("");
    expect(result.delivery_latitude).toBeNull();
    expect(result.return_pickup_address).toBeNull();
    expect(result.cancellation_refund_account_number).toBeNull();
    expect(selectProfilesByIdsService).not.toHaveBeenCalled();
  });

  it("fills a missing order profile with the customer's login email", async () => {
    const [result] = await getOrders(admin);

    expect(selectProfilesByIdsService).toHaveBeenCalledWith(["customer-1"]);
    expect(result.profiles?.email).toBe("login@example.com");
  });

  it("includes per-item customer returns even when the legacy order status is none", async () => {
    vi.mocked(selectReturnRequests).mockResolvedValue([
      {
        id: "return-1",
        order_id: "order-1",
        order_item_id: "line-1",
        customer_id: "customer-1",
        quantity: 1,
        reason_code: "defective",
        description: "Broken",
        preferred_resolution: "refund",
        resolution_granted: null,
        collection_method: "store_dropoff",
        pickup_address: null,
        status: "requested",
        unboxing_video_confirmed: true,
        admin_decision_note: null,
        decided_by: null,
        decided_at: null,
        review_requested_at: null,
        review_request_note: null,
        created_at: "2026-09-25T00:00:00Z",
        updated_at: "2026-09-25T00:00:00Z",
      } as ReturnRequestRow,
    ]);

    const [result] = await getOrders(admin);
    const adminResult = result as typeof result & {
      item_return_requests: ReturnRequestRow[];
    };
    expect(result.return_request_status).toBe("none");
    expect(adminResult.item_return_requests).toHaveLength(1);
    expect(adminResult.item_return_requests[0]?.status).toBe("requested");
  });
});
