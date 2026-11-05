import "server-only";
import type { z } from "zod";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { badRequest } from "@/lib/errors";
import { hashPassword, hashToken, randomToken } from "@/lib/crypto";
import { rateLimit } from "@/lib/rate-limit";
import { recordAudit } from "@/lib/audit";
import { emailIsConfigured, sendSystemEmail } from "@/services/notifications";
import type { forgotPasswordInput, resetPasswordInput } from "@/lib/validation";

const RESET_MINUTES = 60;

export async function requestPasswordReset(input: z.infer<typeof forgotPasswordInput>, meta: { ip: string }) {
  await rateLimit(`forgot-ip:${meta.ip}`, 8, 15 * 60_000);
  await rateLimit(`forgot-email:${input.email}`, 3, 60 * 60_000);
  const emailConfigured = emailIsConfigured();
  // Same answer whether or not the account exists, so nobody can probe for accounts.
  if (!emailConfigured) return { emailConfigured };
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user) return { emailConfigured };

  const token = randomToken(32);
  await prisma.passwordResetToken.deleteMany({ where: { userId: user.id, usedAt: null } });
  await prisma.passwordResetToken.create({
    data: { userId: user.id, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + RESET_MINUTES * 60_000) },
  });
  const link = `${env.APP_URL.replace(/\/$/, "")}/reset-password?token=${encodeURIComponent(token)}`;
  await sendSystemEmail({
    to: user.email,
    subject: "Reset your password",
    text: [
      `Hello ${user.name},`,
      "",
      "We received a request to reset your password. Open this link to choose a new one:",
      link,
      "",
      `The link works for ${RESET_MINUTES} minutes and can be used once.`,
      "If you did not ask for this, you can ignore this email. Your password has not changed.",
    ].join("\n"),
  });
  return { emailConfigured };
}

export async function resetPassword(input: z.infer<typeof resetPasswordInput>, meta: { ip: string }) {
  await rateLimit(`reset-ip:${meta.ip}`, 10, 15 * 60_000);
  const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash: hashToken(input.token) } });
  if (!record || record.usedAt || record.expiresAt.getTime() < Date.now()) {
    throw badRequest("This reset link has expired or was already used. Please ask for a new one.");
  }
  const passwordHash = await hashPassword(input.password);
  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: { passwordHash, mustChangePassword: false, failedAttempts: 0, lockedUntil: null },
    }),
    prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    // Sign the user out everywhere after a reset.
    prisma.session.deleteMany({ where: { userId: record.userId } }),
  ]);
  await recordAudit({
    actorUserId: record.userId,
    action: "auth.password_reset",
    entityType: "User",
    entityId: record.userId,
  });
}
