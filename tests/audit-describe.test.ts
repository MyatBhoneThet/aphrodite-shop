import { describe, expect, it } from "vitest";
import { actionLabel, categoryById, categoryOf, changeSummary, targetLabel } from "../app/lib/audit-describe";

describe("audit log descriptions", () => {
  it("groups actions into categories by prefix", () => {
    expect(categoryOf("order.status.update")?.id).toBe("orders");
    expect(categoryOf("product.stock.sheet_write")?.id).toBe("products");
    expect(categoryOf("sheet_write_back_failed")?.id).toBe("products");
    expect(categoryOf("tier.delete")?.id).toBe("pricing");
    expect(categoryOf("return_request.approved")?.id).toBe("support");
    expect(categoryOf("something.else")).toBeNull();
    expect(categoryById("ads")?.prefixes).toEqual(["home_ad."]);
    expect(categoryById("nope")).toBeNull();
  });

  it("uses a friendly label, or tidies an unknown action", () => {
    expect(actionLabel("staff.grant")).toBe("Gave someone staff access");
    expect(actionLabel("return_request.refund_approved")).toBe("Return request · refund approved");
  });

  it("summarises what changed", () => {
    expect(changeSummary({ previous_data: { status: "pending", total: 10 }, new_data: { status: "confirmed", total: 10 } }))
      .toEqual(["status: pending → confirmed"]);
    expect(changeSummary({ previous_data: null, new_data: { name: "HP", price: 5 } })).toEqual(["name: HP", "price: 5"]);
    expect(changeSummary({ previous_data: { price: 5 }, new_data: null })).toEqual(["price was 5"]);
  });

  it("hides sensitive fields and nested data, and caps the lines", () => {
    const lines = changeSummary({
      previous_data: null,
      new_data: { bank_account_number: "123", token: "x", cells: [1, 2], a: 1, b: 2, c: 3, d: 4, e: 5 },
    });
    expect(lines.join(" ")).not.toMatch(/123|token|cells/);
    expect(lines).toHaveLength(4);
  });

  it("labels the target", () => {
    expect(targetLabel({ target_type: "order", target_id: "c0a1ce22-0000-4000-8000-000000000001" })).toBe("order #C0A1CE22");
    expect(targetLabel({ target_type: "price_list", target_id: "7" })).toBe("price list 7");
  });
});
