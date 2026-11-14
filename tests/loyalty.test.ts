import { describe, expect, it } from "vitest";
import {
  DEFAULT_LOYALTY_RULES,
  maxRedeemablePoints,
  parseLoyaltyRules,
  pointsEarned,
  redemptionProblem,
  redemptionValue,
  type LoyaltyRules,
} from "../src/lib/loyalty";
import { parseSalonSettings } from "../src/lib/settings";

const rules: LoyaltyRules = {
  enabled: true,
  earnPerCurrency: 0.1,
  valuePerPoint: 1,
  minRedeemPoints: 50,
  maxRedeemPercent: 40,
  perks: "",
};

describe("reward points rules", () => {
  it("earns points from the bill total", () => {
    expect(pointsEarned(1999, rules)).toBe(199);
    expect(pointsEarned(1999, { ...rules, enabled: false })).toBe(0);
    expect(pointsEarned(-5, rules)).toBe(0);
  });

  it("values points in money", () => {
    expect(redemptionValue(120, { ...rules, valuePerPoint: 0.25 })).toBe(30);
  });

  it("limits redeemable points by balance, minimum and bill share", () => {
    expect(maxRedeemablePoints(500, 1000, rules)).toBe(400);
    expect(maxRedeemablePoints(200, 1000, rules)).toBe(200);
    expect(maxRedeemablePoints(40, 1000, rules)).toBe(0);
    expect(maxRedeemablePoints(500, 1000, { ...rules, enabled: false })).toBe(0);
  });

  it("explains why a redemption is not allowed", () => {
    expect(redemptionProblem(0, 100, 1000, rules)).toBeNull();
    expect(redemptionProblem(60, 100, 1000, rules)).toBeNull();
    expect(redemptionProblem(150, 100, 1000, rules)).toMatch(/only 100/);
    expect(redemptionProblem(10, 100, 1000, rules)).toMatch(/at least 50/);
    expect(redemptionProblem(90, 500, 100, rules)).toMatch(/Only 40 points/);
    expect(redemptionProblem(60, 100, 1000, { ...rules, enabled: false })).toMatch(/cannot be used/);
  });

  it("falls back to the common rule when a branch has none", () => {
    expect(parseLoyaltyRules(null, rules)).toBe(rules);
    expect(parseLoyaltyRules({ earnPerCurrency: "bad" }, rules)).toBe(rules);
    expect(parseLoyaltyRules({ earnPerCurrency: 2 }, rules).earnPerCurrency).toBe(2);
  });

  it("keeps an old points-per-currency setting", () => {
    expect(parseSalonSettings({ loyaltyPointsPerCurrency: 3 }).loyalty.earnPerCurrency).toBe(3);
    expect(parseSalonSettings({}).loyalty).toEqual(DEFAULT_LOYALTY_RULES);
  });
});
