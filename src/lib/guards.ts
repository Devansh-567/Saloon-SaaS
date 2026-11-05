import "server-only";
import { redirect } from "next/navigation";
import { PlatformRole } from "@prisma/client";
import { getTenantContext, getPendingMfaViewer, getVerifiedViewer } from "./auth";
import { hasPermission, type TenantContext } from "./auth";
import type { Permission } from "./permissions";

export async function requireUserPage() {
  const viewer = await getVerifiedViewer();
  if (!viewer) {
    const pending = await getPendingMfaViewer();
    redirect(pending ? "/mfa" : "/login");
  }
  return viewer;
}

export async function requireTenantPage(
  permission?: Permission,
  options: { skipPasswordGate?: boolean } = {},
): Promise<TenantContext> {
  const viewer = await getVerifiedViewer();
  if (!viewer) {
    const pending = await getPendingMfaViewer();
    redirect(pending ? "/mfa" : "/login");
  }
  if (viewer.user.platformRole === PlatformRole.SUPER_ADMIN) redirect("/platform");
  const context = await getTenantContext();
  if (!context) redirect("/login?error=no-access");
  if (context.salon.status !== "ACTIVE") redirect("/suspended");
  if (context.user.mustChangePassword && !options.skipPasswordGate) redirect("/profile?required=1");
  if (permission && !hasPermission(context, permission)) redirect("/dashboard");
  return context;
}
