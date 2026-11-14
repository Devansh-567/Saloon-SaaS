import { BRAND } from "./brand";
import { z } from "zod";
import { DEFAULT_LOYALTY_RULES, loyaltyRulesSchema } from "./loyalty";

export const salonSettingsSchema = z.object({
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#8c6a52"),
  receiptHeader: z.string().max(200).default(""),
  receiptFooter: z.string().max(300).default(""),
  showLogo: z.boolean().default(true),
  loyalty: loyaltyRulesSchema.default(DEFAULT_LOYALTY_RULES),
  invoiceDueDays: z.number().int().min(0).max(365).default(7),
  allowWalkIns: z.boolean().default(true),
  notifyOnInvoice: z.boolean().default(false),
});

export type SalonSettings = z.infer<typeof salonSettingsSchema>;

export const DEFAULT_SALON_SETTINGS: SalonSettings = salonSettingsSchema.parse({});

export function parseSalonSettings(value: unknown): SalonSettings {
  const raw = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const input =
    raw.loyalty === undefined && typeof raw.loyaltyPointsPerCurrency === "number"
      ? { ...raw, loyalty: { earnPerCurrency: raw.loyaltyPointsPerCurrency } }
      : raw;
  const parsed = salonSettingsSchema.safeParse(input);
  return parsed.success ? parsed.data : DEFAULT_SALON_SETTINGS;
}

export const platformSettingsSchema = z.object({
  platformName: z.string().min(2).max(80).default(BRAND.name),
  supportEmail: z.union([z.literal(""), z.string().email()]).default(""),
  trialDays: z.number().int().min(0).max(365).default(14),
  notice: z.string().max(300).default(""),
});

export type PlatformSettings = z.infer<typeof platformSettingsSchema>;

export const DEFAULT_PLATFORM_SETTINGS: PlatformSettings = platformSettingsSchema.parse({});
