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
 import { redirect } from "next/navigation";
import { requirePlatformPage } from "@/lib/auth";
import { PlatformShell } from "@/components/platform/platform-shell";

export const dynamic = "force-dynamic";

export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  const { viewer, redirectTo } = await requirePlatformPage();
  if (!viewer) redirect(redirectTo!);
  if (viewer.user.mustChangePassword) redirect("/profile?required=1");

  return (
    <PlatformShell user={{ name: viewer.user.name, email: viewer.user.email }}>
      {children}
    </PlatformShell>
  );
}

