import { describe, expect, it } from "vitest";
import { NAV_GROUPS, PAGE_TITLES, QUICK_ACTIONS } from "../src/lib/nav";
import { paymentMethodLabel } from "../src/lib/utils";
import { BRAND } from "../src/lib/brand";

const JARGON = /walk-?in|invoice|queue|\bvoid\b|refund|\bsku\b|payroll|\bmfa\b|loyalty/i;

describe("plain-English labels", () => {
  it("menu items, page titles and quick actions avoid jargon", () => {
    const labels = [
      ...NAV_GROUPS.flatMap((group) => [group.label, ...group.items.map((item) => item.label)]),
      ...PAGE_TITLES.map(([, title]) => title),
      ...QUICK_ACTIONS.map((action) => action.label),
    ];
    for (const label of labels) expect(label).not.toMatch(JARGON);
  });

  it("uses the simple names for the main actions", () => {
    const quick = QUICK_ACTIONS.map((action) => action.label);
    expect(quick).toContain("New Bill");
    expect(quick).toContain("Add Customer");
    expect(quick).toContain("Add Expense");
    expect(quick).toContain("Add to Waiting List");
    expect(NAV_GROUPS.flatMap((g) => g.items).find((i) => i.href === "/queue")?.label).toBe("Waiting List");
  });

  it("shows friendly payment method names", () => {
    expect(paymentMethodLabel("BANK")).toBe("Bank transfer");
    expect(paymentMethodLabel("CASH")).toBe("Cash");
    expect(paymentMethodLabel("SOMETHING")).toBe("SOMETHING");
  });
});

describe("company branding", () => {
  it("has a name and both logo paths configured", () => {
    expect(BRAND.name.length).toBeGreaterThan(0);
    expect(BRAND.logoSrc).toMatch(/^\/brand\//);
    expect(BRAND.logoOnDarkSrc).toMatch(/^\/brand\//);
  });
});
