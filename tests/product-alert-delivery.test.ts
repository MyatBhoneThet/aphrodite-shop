import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../app/lib/supabase", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../app/lib/supabase")>()),
  selectAllProductAlerts: vi.fn(),
  updateProductAlertBaseline: vi.fn(),
}));
vi.mock("../app/lib/mailer", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../app/lib/mailer")>()),
  sendMail: vi.fn(),
}));
vi.mock("../app/lib/notifications", () => ({ notifyProductAlert: vi.fn() }));

import { sendTriggeredProductAlertEmails } from "../app/lib/product-alert-email";
import { sendMail } from "../app/lib/mailer";
import { notifyProductAlert } from "../app/lib/notifications";
import { selectAllProductAlerts, updateProductAlertBaseline, type ProductAlertRow } from "../app/lib/supabase";

function alertRow(overrides: Partial<ProductAlertRow> = {}): ProductAlertRow {
  return {
    id: "alert-1",
    user_id: "u1",
    product_id: 14,
    kind: "price_drop",
    baseline_price: 700_000,
    baseline_stock: "In Stock",
    target_price: null,
    created_at: "2026-10-01T00:00:00Z",
    profiles: { email: "buyer@example.com", full_name: "Buyer" },
    products: {
      id: 14,
      name: "Dell Latitude 3420",
      type: "laptop",
      category: "Laptop",
      brand: "Dell",
      price: 650_000,
      image: "/p.png",
      model_3d: null,
      stock: "In Stock",
      specs: {},
      full_specs: {},
    } as never,
    ...overrides,
  };
}

beforeEach(() => {
  vi.mocked(selectAllProductAlerts).mockReset();
  vi.mocked(updateProductAlertBaseline).mockReset().mockResolvedValue(undefined as never);
  vi.mocked(sendMail).mockReset().mockResolvedValue({ status: "sent", sentAt: "now" });
  vi.mocked(notifyProductAlert).mockReset().mockResolvedValue("sent");
});

describe("followed-product alerts reach the phone and the bell", () => {
  it("notifies the customer and emails them, then moves the watch forward", async () => {
    vi.mocked(selectAllProductAlerts).mockResolvedValue([alertRow()]);

    expect(await sendTriggeredProductAlertEmails([14])).toBe(1);

    expect(notifyProductAlert).toHaveBeenCalledWith(
      "u1",
      "alert-1",
      expect.objectContaining({ id: 14, name: "Dell Latitude 3420" }),
      expect.objectContaining({ type: "price_drop", previousPrice: 700_000, currentPrice: 650_000, wasPending: false })
    );
    expect(sendMail).toHaveBeenCalledTimes(1);
    expect(updateProductAlertBaseline).toHaveBeenCalledWith("alert-1", 650_000, "In Stock");
  });

  it("still tells the customer on their phone when email is not set up", async () => {
    vi.mocked(selectAllProductAlerts).mockResolvedValue([alertRow()]);
    vi.mocked(sendMail).mockResolvedValue({ status: "not_configured" });

    expect(await sendTriggeredProductAlertEmails()).toBe(1);
    expect(updateProductAlertBaseline).toHaveBeenCalled();
  });

  it("works for a customer with no email address on file", async () => {
    vi.mocked(selectAllProductAlerts).mockResolvedValue([alertRow({ profiles: null })]);

    expect(await sendTriggeredProductAlertEmails()).toBe(1);
    expect(sendMail).not.toHaveBeenCalled();
    expect(notifyProductAlert).toHaveBeenCalled();
  });

  it("keeps the watch where it is when nothing could be delivered, so it is retried", async () => {
    vi.mocked(selectAllProductAlerts).mockResolvedValue([alertRow()]);
    vi.mocked(sendMail).mockResolvedValue({ status: "failed", error: "smtp down" });
    vi.mocked(notifyProductAlert).mockResolvedValue("failed");
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    expect(await sendTriggeredProductAlertEmails()).toBe(0);
    expect(updateProductAlertBaseline).not.toHaveBeenCalled();
  });

  it("sends nothing when the price has not dropped", async () => {
    vi.mocked(selectAllProductAlerts).mockResolvedValue([alertRow({ baseline_price: 650_000 })]);

    expect(await sendTriggeredProductAlertEmails()).toBe(0);
    expect(notifyProductAlert).not.toHaveBeenCalled();
    expect(sendMail).not.toHaveBeenCalled();
  });

  it("announces a back-in-stock product", async () => {
    const row = alertRow({ kind: "back_in_stock", baseline_stock: "Out of Stock" });
    vi.mocked(selectAllProductAlerts).mockResolvedValue([row]);

    expect(await sendTriggeredProductAlertEmails()).toBe(1);
    expect(notifyProductAlert).toHaveBeenCalledWith("u1", "alert-1", expect.anything(), { type: "back_in_stock" });
  });
});
