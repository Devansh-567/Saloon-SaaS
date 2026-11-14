import "server-only";
import { prisma } from "./prisma";
import { AppError } from "./errors";

export async function rateLimit(key: string, limit: number, windowMs: number) {
  const expiresAt = new Date(Date.now() + windowMs);
  const rows = await prisma.$queryRaw<Array<{ count: number; expiresAt: Date }>>`
    INSERT INTO "RateLimit" ("key", "count", "windowStart", "expiresAt")
    VALUES (${key}, 1, now(), ${expiresAt})
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "RateLimit"."expiresAt" <= now() THEN 1 ELSE "RateLimit"."count" + 1 END,
      "windowStart" = CASE WHEN "RateLimit"."expiresAt" <= now() THEN now() ELSE "RateLimit"."windowStart" END,
      "expiresAt" = CASE WHEN "RateLimit"."expiresAt" <= now() THEN ${expiresAt} ELSE "RateLimit"."expiresAt" END
    RETURNING "count", "expiresAt"`;
  const row = rows[0];
  if (!row) return;
  if (row.count > limit) {
    const retry = Math.max(1, Math.ceil((new Date(row.expiresAt).getTime() - Date.now()) / 1000));
    throw new AppError(429, "RATE_LIMITED", "Too many attempts. Please try again later.", { retryAfter: retry });
  }
  if (Math.random() < 0.01) {
    await prisma.rateLimit.deleteMany({ where: { expiresAt: { lt: new Date() } } }).catch(() => {});
  }
}
