import { describe, expect, it } from "vitest";
import { invoiceInput, refundInput } from "../src/lib/validation";

const branchId = "ckx0000000000000000000000";
const item = { kind: "SERVICE" as const, serviceId: "ckx0000000000000000000001", quantity: 1 };

describe("bill validation", () => {
  it("accepts a walk-in bill with no customer", () => {
    const parsed = invoiceInput.parse({ branchId, customerId: "", items: [item] });
    expect(parsed.customerId).toBeNull();
    expect(parsed.payments).toEqual([]);
  });

  it("accepts split payments and an idempotency key", () => {
    const parsed = invoiceInput.parse({
      branchId,
      items: [item],
      idempotencyKey: "abcdef12-3456",
      payments: [
        { method: "CASH", amount: 100 },
        { method: "UPI", amount: 50.5, reference: "ref1" },
      ],
    });
    expect(parsed.payments).toHaveLength(2);
  });

  it("rejects zero or negative payments and unknown methods", () => {
    expect(() => invoiceInput.parse({ branchId, items: [item], payments: [{ method: "CASH", amount: 0 }] })).toThrow();
    expect(() => invoiceInput.parse({ branchId, items: [item], payments: [{ method: "BITCOIN", amount: 5 }] })).toThrow();
  });

  it("rejects more than five payment lines and a too-short key", () => {
    const many = Array.from({ length: 6 }, () => ({ method: "CASH", amount: 1 }));
    expect(() => invoiceInput.parse({ branchId, items: [item], payments: many })).toThrow();
    expect(() => invoiceInput.parse({ branchId, items: [item], idempotencyKey: "x" })).toThrow();
  });

  it("defaults refund restock to false", () => {
    const parsed = refundInput.parse({ amount: 10, method: "CASH", reason: "unhappy" });
    expect(parsed.restockProducts).toBe(false);
  });
});
