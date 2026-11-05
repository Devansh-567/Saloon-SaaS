import { describe, expect, it } from "vitest";
import { calculateInvoice } from "@/lib/invoice-calc";

const serviceLine = (unitPrice: number, taxRate = 10, commissionRate = 30) => ({
  quantity: 1,
  unitPrice,
  taxRate,
  commissionRate,
});

describe("calculateInvoice", () => {
  it("rejects an invoice without lines", () => {
    expect(() => calculateInvoice([], 0)).toThrow("At least one line is required");
  });

  it("computes subtotal, tax, total, and commission without a discount", () => {
    const result = calculateInvoice(
      [
        { quantity: 2, unitPrice: 50, taxRate: 10, commissionRate: 30 },
        { quantity: 1, unitPrice: 30, taxRate: 0, commissionRate: 20 },
      ],
      0,
    );

    expect(result.subtotal).toBe(130);
    expect(result.discount).toBe(0);
    expect(result.taxTotal).toBe(10);
    expect(result.total).toBe(140);
    expect(result.commissionTotal).toBe(36);
    expect(result.lines).toHaveLength(2);
    expect(result.lines[0]).toMatchObject({ gross: 100, netBase: 100, taxAmount: 10, lineTotal: 110 });
  });

  it("allocates a discount proportionally across lines", () => {
    const result = calculateInvoice([serviceLine(35), serviceLine(65)], 20);

    expect(result.discount).toBe(20);
    expect(result.lines[0].discountAmount).toBe(7);
    expect(result.lines[1].discountAmount).toBe(13);
    expect(result.lines[0].netBase).toBe(28);
    expect(result.lines[1].netBase).toBe(52);
    expect(result.taxTotal).toBe(8);
    expect(result.total).toBe(88);
    expect(result.commissionTotal).toBe(24);
  });

  it("makes the last line absorb allocation rounding", () => {
    const result = calculateInvoice([serviceLine(10), serviceLine(10), serviceLine(10)], 0.01);

    expect(result.lines.reduce((sum, line) => sum + line.discountAmount, 0)).toBe(0.01);
    expect(result.lines[2].discountAmount).toBe(0.01);
    expect(result.total).toBe(32.99);
  });

  it("clamps discounts to the subtotal and never below zero", () => {
    expect(calculateInvoice([serviceLine(40)], 500).discount).toBe(40);
    expect(calculateInvoice([serviceLine(40)], -10).discount).toBe(0);
    expect(calculateInvoice([serviceLine(40)], 500).total).toBe(0);
  });

  it("rounds money to two decimals", () => {
    const result = calculateInvoice([{ quantity: 3, unitPrice: 19.99, taxRate: 8.875, commissionRate: 15 }], 0);

    expect(result.subtotal).toBe(59.97);
    expect(result.taxTotal).toBe(5.32);
    expect(result.total).toBe(65.29);
    expect(result.lines[0].commissionAmount).toBe(9);
  });

  it("preserves line metadata from the input", () => {
    const result = calculateInvoice([{ ...serviceLine(50), serviceId: "svc_1", staffMembershipId: "mem_1" }], 0);

    expect(result.lines[0]).toMatchObject({ serviceId: "svc_1", staffMembershipId: "mem_1" });
  });
});
