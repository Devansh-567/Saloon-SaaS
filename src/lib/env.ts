import "server-only";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_URL: z.string().url(),
  DATABASE_URL: z.string().min(1),
  APP_SECRET: z.string().min(32),
  MFA_ENCRYPTION_KEY: z.string().min(32),
  STORAGE_ROOT: z.string().min(1).default("./storage"),
  MAX_UPLOAD_MB: z.coerce.number().int().positive().max(25).default(5),
  SESSION_TTL_HOURS: z.coerce.number().int().positive().default(12),
  SESSION_IDLE_MINUTES: z.coerce.number().int().positive().default(120),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().optional(),
  SMTP_SECURE: z
    .string()
    .optional()
    .transform((v) => v === "true"),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  MAIL_FROM: z.string().optional(),
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_SMS_FROM: z.string().optional(),
  TWILIO_WHATSAPP_FROM: z.string().optional(),
  TRIAL_DAYS: z.coerce.number().int().positive().default(14),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  throw new Error(`Invalid environment configuration: ${parsed.error.issues.map((i) => i.path.join(".")).join(", ")}`);
}

export const env = parsed.data;
