import "server-only";
import { cookies } from "next/headers";
import { Prisma, PlatformRole, type Salon, type Session, type User, type Membership, type Branch } from "@prisma/client";
import { prisma } from "./prisma";
import { env } from "./env";
import { hashToken, randomToken } from "./crypto";
import { AppError, forbidden, unauthorized } from "./errors";
import { effectivePermissions, type Permission, type StaffRole } from "./permissions";

export const SESSION_COOKIE = "salon_session";
const PENDING_MFA_MINUTES = 10;

type SessionViewer = {
  session: Session;
  user: User;
};

export type TenantContext = {
  user: User;
  session: Session;
  salon: Salon;
  membership: Membership;
  branch: Branch | null;
  role: StaffRole;
  permissions: Permission[];
};

const sessionInclude = { user: true } satisfies Prisma.SessionInclude;

function sessionCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
    priority: "high" as const,
  };
}

export async function createSession(
  userId: string,
  mfaVerified: boolean,
  meta: { ip?: string; userAgent?: string } = {},
) {
  const token = randomToken();
  const ttlSeconds = mfaVerified
    ? env.SESSION_TTL_HOURS * 60 * 60
    : PENDING_MFA_MINUTES * 60;
  const session = await prisma.session.create({
    data: {
      tokenHash: hashToken(token),
      userId,
      mfaVerified,
      expiresAt: new Date(Date.now() + ttlSeconds * 1000),
      ip: meta.ip,
      userAgent: meta.userAgent?.slice(0, 300),
    },
  });
  const store = await cookies();
  store.set(SESSION_COOKIE, token, sessionCookieOptions(ttlSeconds));
  return session;
}

export async function refreshSessionAfterMfa(sessionId: string) {
  const ttlSeconds = env.SESSION_TTL_HOURS * 60 * 60;
  const session = await prisma.session.update({
    where: { id: sessionId },
    data: {
      mfaVerified: true,
      expiresAt: new Date(Date.now() + ttlSeconds * 1000),
      lastSeenAt: new Date(),
    },
  });
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (token) {
    (await cookies()).set(SESSION_COOKIE, token, sessionCookieOptions(ttlSeconds));
  }
  return session;
}

export async function readSession(): Promise<SessionViewer | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: sessionInclude,
  });
  if (!session) return null;
  const now = new Date();
  if (session.expiresAt <= now || now.getTime() - session.lastSeenAt.getTime() > env.SESSION_IDLE_MINUTES * 60000) {
    await prisma.session.deleteMany({ where: { id: session.id } });
    return null;
  }
  if (now.getTime() - session.lastSeenAt.getTime() > 5 * 60000) {
    await prisma.session.update({ where: { id: session.id }, data: { lastSeenAt: now } });
  }
  if (session.user.lockedUntil && session.user.lockedUntil > now) {
    await prisma.session.deleteMany({ where: { id: session.id } });
    return null;
  }
  return { session, user: session.user };
}

export async function getVerifiedViewer() {
  const viewer = await readSession();
  if (!viewer || !viewer.session.mfaVerified) return null;
  return viewer;
}

export async function getPendingMfaViewer() {
  const viewer = await readSession();
  if (!viewer || viewer.session.mfaVerified || !viewer.user.mfaEnabled) return null;
  return viewer;
}

export async function resolveTenant(viewer: SessionViewer): Promise<TenantContext | null> {
  if (viewer.user.platformRole === PlatformRole.SUPER_ADMIN) return null;
  const membership = await prisma.membership.findFirst({
    where: {
      userId: viewer.user.id,
      active: true,
      ...(viewer.session.salonId ? { salonId: viewer.session.salonId } : {}),
    },
    include: { salon: true, branch: true },
  });
  const resolved =
    membership ||
    (viewer.session.salonId
      ? await prisma.membership.findFirst({
          where: { userId: viewer.user.id, active: true },
          include: { salon: true, branch: true },
        })
      : null);
  if (!resolved) return null;
  if (resolved.salonId !== viewer.session.salonId) {
    await prisma.session.update({ where: { id: viewer.session.id }, data: { salonId: resolved.salonId } }).catch(() => {});
  }
  const role = resolved.role as StaffRole;
  const rolePermissions = await prisma.salonRolePermission.findUnique({
    where: { salonId_role: { salonId: resolved.salonId, role: resolved.role } },
    select: { permissions: true },
  });
  return {
    user: viewer.user,
    session: viewer.session,
    salon: resolved.salon,
    membership: resolved,
    branch: resolved.branch,
    role,
    permissions: effectivePermissions(role, resolved.permissionOverrides, rolePermissions?.permissions),
  };
}

export async function getTenantContext() {
  const viewer = await getVerifiedViewer();
  if (!viewer) return null;
  return resolveTenant(viewer);
}

export function hasPermission(context: TenantContext, permission: Permission) {
  return context.permissions.includes(permission);
}

export function requirePermission(context: TenantContext, permission: Permission) {
  if (!hasPermission(context, permission)) throw forbidden();
  return context;
}

export async function requireApiTenant(permission?: Permission) {
  const viewer = await getVerifiedViewer();
  if (!viewer) throw unauthorized();
  const context = await resolveTenant(viewer);
  if (!context) throw forbidden("No active salon membership");
  if (context.salon.status !== "ACTIVE") throw new AppError(403, "SALON_SUSPENDED", "This salon is suspended");
  if (permission) requirePermission(context, permission);
  return context;
}

export async function requireApiUser() {
  const viewer = await getVerifiedViewer();
  if (!viewer) throw unauthorized();
  return viewer;
}

export async function requirePlatformApi() {
  const viewer = await getVerifiedViewer();
  if (!viewer) throw unauthorized();
  if (viewer.user.platformRole !== PlatformRole.SUPER_ADMIN) throw forbidden();
  return viewer;
}

export async function requirePlatformPage() {
  const viewer = await getVerifiedViewer();
  if (!viewer) {
    const pending = await getPendingMfaViewer();
    return { viewer: null, redirectTo: pending ? "/mfa" : "/login" };
  }
  if (viewer.user.platformRole !== PlatformRole.SUPER_ADMIN) return { viewer: null, redirectTo: "/dashboard" };
  return { viewer, redirectTo: null };
}

export async function setActiveSalon(sessionId: string, salonId: string) {
  await prisma.session.update({ where: { id: sessionId }, data: { salonId } });
}

export async function destroySession() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (token) await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  const store = await cookies();
  store.set(SESSION_COOKIE, "", { ...sessionCookieOptions(0), maxAge: 0 });
}

export async function revokeOtherSessions(userId: string, currentSessionId: string) {
  await prisma.session.deleteMany({ where: { userId, id: { not: currentSessionId } } });
}
