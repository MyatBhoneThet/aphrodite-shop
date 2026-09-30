import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Regression cover for a silent failure in production: every delivered order
 * was recorded as `receipt_email_status = "not_configured"` and no customer
 * ever got a receipt.
 *
 * The cause was not the mail server. Orders are read under the *caller's*
 * access token, with the customer's profile as a PostgREST embed. When an
 * admin marks an order delivered, that caller is the admin -- and without the
 * "Admins read all profiles" policy actually applied to the database, the
 * embed comes back null instead of erroring. sendOrderEmail then found no
 * recipient and reported "not_configured", which reads like missing mail
 * credentials and sent everyone looking in the wrong place.
 */

vi.mock("../app/lib/supabase", async (importOriginal) => {
  const original = await importOriginal<typeof import("../app/lib/supabase")>();
  return {
    ...original,
    selectOrderById: vi.fn(),
    selectProfileByIdService: vi.fn(),
    updateOrderStatus: vi.fn(),
    insertAuditLog: vi.fn(),
  };
});

// Replaced outright rather than spread from the original: loading the real
// module would pull in the mail transport (and nodemailer) for a test that
// only cares which address the email was addressed to.
vi.mock("../app/lib/receipt-email", () => ({
  makeReceiptNumber: (id: string) => `AP-${id}`,
  sendOrderEmail: vi.fn(),
}));

import { notifyOrderDelivered } from "../app/lib/backend";
import { sendOrderEmail } from "../app/lib/receipt-email";
import {
  selectOrderById,
  selectProfileByIdService,
  updateOrderStatus,
  type CurrentUser,
  type OrderRow,
  type Profile,
} from "../app/lib/supabase";

const admin = {
  id: "admin-1",
  email: "admin@aphrodite.com",
  role: "admin",
  accessToken: "admin-token",
} as unknown as CurrentUser;

/** What an admin's own token really returns: no embedded profile. */
const orderWithoutProfile = {
  id: "order-1",
  user_id: "customer-1",
  status: "delivered",
  receipt_email_status: null,
  shipping_name: "Swan Yi",
  profiles: null,
} as unknown as OrderRow;

const customer = {
  id: "customer-1",
  email: "customer@example.com",
  full_name: "Swan Yi",
  role: "normal",
  order_updates_enabled: true,
} as unknown as Profile;

beforeEach(() => {
  vi.mocked(selectOrderById).mockReset();
  vi.mocked(selectProfileByIdService).mockReset();
  vi.mocked(updateOrderStatus).mockReset();
  vi.mocked(sendOrderEmail).mockReset();

  vi.mocked(selectOrderById).mockResolvedValue(orderWithoutProfile);
  vi.mocked(selectProfileByIdService).mockResolvedValue(customer);
  vi.mocked(updateOrderStatus).mockResolvedValue(undefined as never);
  vi.mocked(sendOrderEmail).mockResolvedValue({
    status: "sent",
    sentAt: "2026-09-20T08:35:03.000Z",
  });
});

describe("delivered receipt recipient", () => {
  it("still emails the customer when the admin's token cannot read their profile", async () => {
    await notifyOrderDelivered(admin, "order-1");

    expect(sendOrderEmail).toHaveBeenCalledTimes(1);

    // The address must reach sendOrderEmail, which reads order.profiles.email.
    const [order] = vi.mocked(sendOrderEmail).mock.calls[0];
    expect(order.profiles?.email).toBe("customer@example.com");
    expect(order.profiles?.full_name).toBe("Swan Yi");

    // ...and the outcome is recorded as sent, not "not_configured".
    expect(updateOrderStatus).toHaveBeenCalledWith(
      "order-1",
      "delivered",
      "admin-token",
      expect.objectContaining({
        receiptEmailStatus: "sent",
        receiptSentAt: "2026-09-20T08:35:03.000Z",
      })
    );
  });

  it("does not look up a profile it was already given", async () => {
    vi.mocked(selectOrderById).mockResolvedValue({
      ...orderWithoutProfile,
      profiles: { email: "embedded@example.com", full_name: "Embedded", role: "normal" },
    } as unknown as OrderRow);

    await notifyOrderDelivered(admin, "order-1");

    const [order] = vi.mocked(sendOrderEmail).mock.calls[0];
    expect(order.profiles?.email).toBe("embedded@example.com");
    // Only the "order updates enabled?" read, never a second one for contact.
    expect(vi.mocked(selectProfileByIdService)).toHaveBeenCalledTimes(1);
  });

  it("sends nothing, and never throws, when the customer has no address at all", async () => {
    vi.mocked(selectProfileByIdService).mockResolvedValue({
      ...customer,
      email: "",
    } as unknown as Profile);
    vi.mocked(sendOrderEmail).mockResolvedValue({ status: "not_configured" });

    await expect(notifyOrderDelivered(admin, "order-1")).resolves.toBeUndefined();

    const [order] = vi.mocked(sendOrderEmail).mock.calls[0];
    expect(order.profiles?.email).toBeFalsy();
  });

  it("leaves an already-sent receipt alone", async () => {
    vi.mocked(selectOrderById).mockResolvedValue({
      ...orderWithoutProfile,
      receipt_email_status: "sent",
    } as unknown as OrderRow);

    await notifyOrderDelivered(admin, "order-1");

    expect(sendOrderEmail).not.toHaveBeenCalled();
  });
});
