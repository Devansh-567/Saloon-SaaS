import "server-only";
import type { z } from "zod";
import { PlatformRole, Role } from "@prisma/client";
import { generateSecret, generateURI, verify as verifyTotp } from "otplib";
import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";
import { AppError, badRequest, conflict, forbidden, unauthorized } from "@/lib/errors";
import {
  DUMMY_PASSWORD_HASH,
  decryptSecret,
  encryptSecret,
  generateRecoveryCodes,
  hashPassword,
  hashRecoveryCode,
  safeEqual,
  verifyPassword,
} from "@/lib/crypto";
import {
  createSession,
  refreshSessionAfterMfa,
  revokeOtherSessions,
  setActiveSalon,
  type TenantContext,
} from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { recordAudit } from "@/lib/audit";
import { slugify } from "@/lib/utils";
import type { loginInput, mfaEnableInput, mfaVerifyInput, passwordChangeInput, registerInput } from "@/lib/validation";

type RegisterInput = z.infer<typeof registerInput>;
type LoginInput = z.infer<typeof loginInput>;

async function uniqueSlug(name: string) {
  const base = slugify(name) || "salon";
  let slug = base;
  let suffix = 2;
  while (await prisma.salon.findUnique({ where: { slug } })) {
    slug = `${base}-${suffix}`;
    suffix += 1;
  }
  return slug;
}

export async function registerOwner(input: RegisterInput, meta: { ip: string; userAgent?: string }) {
  await rateLimit(`register:${meta.ip}`, 5, 3600_000);
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw conflict("An account with this email already exists");
  const passwordHash = await hashPassword(input.password);
  const slug = await uniqueSlug(input.salonName);
  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { email: input.email, name: input.name, phone: input.phone, passwordHash },
    });
    const salon = await tx.salon.create({
      data: {
        name: input.salonName,
        slug,
        email: input.email,
        phone: input.phone,
        timezone: input.timezone,
        currency: input.currency,
        ownerId: user.id,
      },
    });
    await tx.branch.create({
      data: { salonId: salon.id, name: "Main branch", isPrimary: true, phone: input.phone },
    });
    const membership = await tx.membership.create({
      data: { salonId: salon.id, userId: user.id, role: Role.OWNER },
    });
    await tx.staffProfile.create({ data: { membershipId: membership.id } });
    return { user, salon };
  });
  await recordAudit({
    salonId: result.salon.id,
    actorUserId: result.user.id,
    action: "auth.registered_owner",
    entityType: "Salon",
    entityId: result.salon.id,
    ip: meta.ip,
  });
  await createSession(result.user.id, true, meta);
  return { user: result.user, salon: result.salon };
}

export async function loginUser(input: LoginInput, meta: { ip: string; userAgent?: string }) {
  await Promise.all([
    rateLimit(`login:ip:${meta.ip}`, 20, 15 * 60000),
    rateLimit(`login:email:${input.email}`, 10, 15 * 60000),
  ]);
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user) {
    await verifyPassword(input.password, DUMMY_PASSWORD_HASH);
    await recordAudit({ action: "auth.login_failed", entityType: "User", ip: meta.ip, metadata: { email: input.email } });
    throw unauthorized("Invalid email or password");
  }
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    throw new AppError(423, "ACCOUNT_LOCKED", "Too many failed attempts. Try again later.");
  }
  const valid = await verifyPassword(input.password, user.passwordHash);
  if (!valid) {
    const failedAttempts = user.failedAttempts + 1;
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedAttempts,
        lockedUntil: failedAttempts >= 5 ? new Date(Date.now() + 15 * 60000) : null,
      },
    });
    await recordAudit({
      actorUserId: user.id,
      action: "auth.login_failed",
      entityType: "User",
      entityId: user.id,
      ip: meta.ip,
    });
    throw unauthorized("Invalid email or password");
  }
  await prisma.user.update({
    where: { id: user.id },
    data: { failedAttempts: 0, lockedUntil: null },
  });
  const mfaVerified = !user.mfaEnabled;
  await createSession(user.id, mfaVerified, meta);
  if (!mfaVerified) {
    await recordAudit({
      actorUserId: user.id,
      action: "auth.password_verified",
      entityType: "User",
      entityId: user.id,
      ip: meta.ip,
    });
    return { mfaRequired: true, user: publicUser(user), redirectTo: "/mfa" };
  }
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  const membership = await prisma.membership.findFirst({
    where: { userId: user.id, active: true },
    orderBy: { createdAt: "asc" },
  });
  await recordAudit({
    salonId: membership?.salonId,
    actorUserId: user.id,
    action: "auth.login_succeeded",
    entityType: "User",
    entityId: user.id,
    ip: meta.ip,
  });
  return {
    mfaRequired: false,
    user: publicUser(user),
    redirectTo: user.platformRole === PlatformRole.SUPER_ADMIN ? "/platform" : membership ? "/dashboard" : "/login?error=no-access",
  };
}

function publicUser(user: { id: string; email: string; name: string; platformRole: PlatformRole; mustChangePassword: boolean; mfaEnabled: boolean }) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    platformRole: user.platformRole,
    mustChangePassword: user.mustChangePassword,
    mfaEnabled: user.mfaEnabled,
  };
}

export async function verifyMfaLogin(input: z.infer<typeof mfaVerifyInput>) {
  const { getPendingMfaViewer } = await import("@/lib/auth");
  const viewer = await getPendingMfaViewer();
  if (!viewer) throw unauthorized("MFA challenge expired");
  await rateLimit(`mfa:${viewer.user.id}`, 10, 10 * 60000);
  if (!viewer.user.mfaSecret) throw unauthorized("MFA is not configured");
  const secret = decryptSecret(viewer.user.mfaSecret);
  let totpValid = false;
  if (/^\d{6}$/.test(input.code)) {
    const result = await verifyTotp({ secret, token: input.code, epochTolerance: 30 }).catch(() => ({ valid: false }));
    totpValid = result.valid;
  }
  let recoveryUsed = false;
  if (!totpValid) {
    const hashed = hashRecoveryCode(input.code);
    const index = viewer.user.mfaRecoveryCodes.findIndex((code) => safeEqual(code, hashed));
    if (index >= 0) {
      recoveryUsed = true;
      await prisma.user.update({
        where: { id: viewer.user.id },
        data: { mfaRecoveryCodes: viewer.user.mfaRecoveryCodes.filter((_, i) => i !== index) },
      });
    }
  }
  if (!totpValid && !recoveryUsed) {
    await recordAudit({
      actorUserId: viewer.user.id,
      action: "auth.mfa_failed",
      entityType: "User",
      entityId: viewer.user.id,
    });
    throw unauthorized("Invalid verification code");
  }
  await refreshSessionAfterMfa(viewer.session.id);
  await prisma.user.update({ where: { id: viewer.user.id }, data: { lastLoginAt: new Date() } });
  const membership = await prisma.membership.findFirst({
    where: { userId: viewer.user.id, active: true },
    orderBy: { createdAt: "asc" },
  });
  await recordAudit({
    salonId: membership?.salonId,
    actorUserId: viewer.user.id,
    action: "auth.login_succeeded",
    entityType: "User",
    entityId: viewer.user.id,
    metadata: { recoveryUsed },
  });
  return {
    user: publicUser(viewer.user),
    redirectTo: viewer.user.platformRole === PlatformRole.SUPER_ADMIN ? "/platform" : "/dashboard",
  };
}

export async function beginMfaSetup(context: TenantContext) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: context.user.id } });
  if (user.mfaEnabled) throw conflict("MFA is already enabled");
  const secret = generateSecret();
  await prisma.user.update({
    where: { id: user.id },
    data: { mfaSecret: encryptSecret(secret), mfaEnabled: false },
  });
  const uri = generateURI({ issuer: context.salon.name, label: user.email, secret });
  const qrCode = await QRCode.toDataURL(uri, { margin: 1, width: 240 });
  return { secret, uri, qrCode };
}

export async function enableMfa(context: TenantContext, input: z.infer<typeof mfaEnableInput>) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: context.user.id } });
  if (user.mfaEnabled) throw conflict("MFA is already enabled");
  if (!user.mfaSecret) throw badRequest("Start MFA setup first");
  const secret = decryptSecret(user.mfaSecret);
  const result = await verifyTotp({ secret, token: input.code, epochTolerance: 30 });
  if (!result.valid) throw badRequest("Invalid authenticator code");
  const { codes, hashes } = generateRecoveryCodes();
  await prisma.user.update({
    where: { id: user.id },
    data: { mfaEnabled: true, mfaRecoveryCodes: hashes },
  });
  await revokeOtherSessions(user.id, context.session.id);
  await recordAudit({
    salonId: context.salon.id,
    actorUserId: user.id,
    action: "auth.mfa_enabled",
    entityType: "User",
    entityId: user.id,
  });
  return { recoveryCodes: codes };
}

export async function disableMfa(context: TenantContext, input: { password: string; code: string }) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: context.user.id } });
  if (!(await verifyPassword(input.password, user.passwordHash))) throw badRequest("Password is incorrect");
  if (!user.mfaEnabled || !user.mfaSecret) throw badRequest("MFA is not enabled");
  const secret = decryptSecret(user.mfaSecret);
  const result = /^\d{6}$/.test(input.code)
    ? await verifyTotp({ secret, token: input.code, epochTolerance: 30 }).catch(() => ({ valid: false }))
    : { valid: false };
  const recovery = user.mfaRecoveryCodes.find((code) => safeEqual(code, hashRecoveryCode(input.code)));
  if (!result.valid && !recovery) throw badRequest("Invalid authentication code");
  await prisma.user.update({
    where: { id: user.id },
    data: { mfaEnabled: false, mfaSecret: null, mfaRecoveryCodes: [] },
  });
  await revokeOtherSessions(user.id, context.session.id);
  await recordAudit({
    salonId: context.salon.id,
    actorUserId: user.id,
    action: "auth.mfa_disabled",
    entityType: "User",
    entityId: user.id,
  });
}

export async function changePassword(context: TenantContext, input: z.infer<typeof passwordChangeInput>) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: context.user.id } });
  if (!(await verifyPassword(input.currentPassword, user.passwordHash))) throw badRequest("Current password is incorrect");
  if (await verifyPassword(input.newPassword, user.passwordHash)) throw badRequest("Choose a password you have not used here");
  const hash = await hashPassword(input.newPassword);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: hash, mustChangePassword: false },
  });
  await revokeOtherSessions(user.id, context.session.id);
  await recordAudit({
    salonId: context.salon.id,
    actorUserId: user.id,
    action: "auth.password_changed",
    entityType: "User",
    entityId: user.id,
  });
}

export async function switchSalon(context: TenantContext, salonId: string) {
  if (salonId === context.salon.id) return context.salon;
  const membership = await prisma.membership.findFirst({
    where: { userId: context.user.id, salonId, active: true },
    include: { salon: true },
  });
  if (!membership) throw forbidden("You are not a member of that salon");
  if (membership.salon.status !== "ACTIVE") throw forbidden("That salon is suspended");
  await setActiveSalon(context.session.id, salonId);
  return membership.salon;
}

export async function mySalons(context: TenantContext) {
  return prisma.membership.findMany({
    where: { userId: context.user.id, active: true, salon: { status: "ACTIVE" } },
    include: { salon: { select: { id: true, name: true } } },
    orderBy: { createdAt: "asc" },
  });
}
