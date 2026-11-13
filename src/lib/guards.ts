# Copyright (c) 2026 Devansh Singh
# All Rights Reserved.
#
# This software and its source code are proprietary
# and confidential property of Guru AI Technologies.
#
# Unauthorized copying, modification, distribution,
# or use of this software, in whole or in part,
# is strictly prohibited without prior written
# permission from Guru AI Technologies.
// 2026 Devansh Singh
// Guru AI Technologies
 import "server-only";
import { redirect } from "next/navigation";
import { PlatformRole } from "@prisma/client";
import { getTenantContext, getPendingMfaViewer, getVerifiedViewer } from "./auth";
import { hasPermission, type TenantContext } from "./auth";
import type { Permission } from "./permissions";

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

