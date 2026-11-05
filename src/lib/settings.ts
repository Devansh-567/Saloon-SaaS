import { z } from "zod";

export const salonSettingsSchema = z.object({
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#8c6a52"),
  receiptHeader: z.string().max(200).default(""),
  receiptFooter: z.string().max(300).default(""),
  showLogo: z.boolean().default(true),
  loyaltyPointsPerCurrency: z.number().min(0).max(100).default(1),
  invoiceDueDays: z.number().int().min(0).max(365).default(7),
  allowWalkIns: z.boolean().default(true),
  notifyOnInvoice: z.boolean().default(false),
});

export type SalonSettings = z.infer<typeof salonSettingsSchema>;

export const DEFAULT_SALON_SETTINGS: SalonSettings = salonSettingsSchema.parse({});

export function parseSalonSettings(value: unknown): SalonSettings {
  const parsed = salonSettingsSchema.safeParse(value || {});
  return parsed.success ? parsed.data : DEFAULT_SALON_SETTINGS;
}

export const platformSettingsSchema = z.object({
  platformName: z.string().min(2).max(80).default("Salon SaaS"),
  supportEmail: z.union([z.literal(""), z.string().email()]).default(""),
  trialDays: z.number().int().min(0).max(365).default(14),
  notice: z.string().max(300).default(""),
});

export type PlatformSettings = z.infer<typeof platformSettingsSchema>;

export const DEFAULT_PLATFORM_SETTINGS: PlatformSettings = platformSettingsSchema.parse({});
