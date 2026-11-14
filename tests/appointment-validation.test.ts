import { describe, expect, it } from "vitest";
import { appointmentInput, purchaseInput } from "../src/lib/validation";

const ids = {
  branchId: "ckx0000000000000000000000",
  serviceId: "ckx0000000000000000000001",
  staffMembershipId: "ckx0000000000000000000002",
};

describe("booking an appointment", () => {
  it("accepts a typed name for a new customer", () => {
    const parsed = appointmentInput.parse({ ...ids, customerId: "", newCustomerName: "Riya Sharma", startAt: "2026-11-20T10:00:00Z" });
    expect(parsed.customerId).toBeNull();
    expect(parsed.newCustomerName).toBe("Riya Sharma");
  });

  it("needs either a customer or a name", () => {
    expect(() => appointmentInput.parse({ ...ids, customerId: "", startAt: "2026-11-20T10:00:00Z" })).toThrow();
  });
});

describe("recording a stock purchase", () => {
  it("allows empty or missing notes", () => {
    const base = {
      purchasedAt: "2026-11-20T10:00:00Z",
      items: [{ productId: "ckx0000000000000000000003", quantity: 2, unitCost: 100 }],
    };
    expect(purchaseInput.parse({ ...base, notes: null }).notes).toBeUndefined();
    expect(purchaseInput.parse({ ...base, notes: "" }).notes).toBeUndefined();
    expect(purchaseInput.parse(base).notes).toBeUndefined();
  });
});
