import { z } from "zod";
import { roundMoney } from "./utils";

export const loyaltyRulesSchema = z.object({
  enabled: z.boolean().default(true),
  earnPerCurrency: z.number().min(0).max(100).default(1),
  valuePerPoint: z.number().min(0).max(1000).default(0.1),
  minRedeemPoints: z.number().int().min(0).max(1000000).default(100),
  maxRedeemPercent: z.number().min(0).max(100).default(50),
  perks: z.string().trim().max(300).default(""),
});

export type LoyaltyRules = z.infer<typeof loyaltyRulesSchema>;

export const DEFAULT_LOYALTY_RULES: LoyaltyRules = loyaltyRulesSchema.parse({});

export function parseLoyaltyRules(value: unknown, fallback: LoyaltyRules): LoyaltyRules {
  if (value === null || value === undefined) return fallback;
  const parsed = loyaltyRulesSchema.safeParse(value);
  return parsed.success ? parsed.data : fallback;
}

export function pointsEarned(total: number, rules: LoyaltyRules) {
  return rules.enabled ? Math.floor(Math.max(0, total) * rules.earnPerCurrency) : 0;
}

export function redemptionValue(points: number, rules: LoyaltyRules) {
  return roundMoney(points * rules.valuePerPoint);
}

export function maxRedeemablePoints(balance: number, billSubtotal: number, rules: LoyaltyRules) {
  if (!rules.enabled || rules.valuePerPoint <= 0 || balance < rules.minRedeemPoints) return 0;
  const cap = Math.floor((billSubtotal * rules.maxRedeemPercent) / 100 / rules.valuePerPoint);
  return Math.max(0, Math.min(balance, cap));
}

export function redemptionProblem(points: number, balance: number, billSubtotal: number, rules: LoyaltyRules) {
  if (points <= 0) return null;
  if (!rules.enabled || rules.valuePerPoint <= 0) return "Reward points cannot be used at this branch";
  if (points > balance) return `This customer has only ${balance} reward points`;
  if (points < rules.minRedeemPoints) return `Use at least ${rules.minRedeemPoints} points at a time`;
  const allowed = maxRedeemablePoints(balance, billSubtotal, rules);
  if (points > allowed) return `Only ${allowed} points can be used on this bill`;
  return null;
}
