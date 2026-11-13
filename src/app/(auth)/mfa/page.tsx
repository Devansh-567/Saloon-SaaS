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
 import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getPendingMfaViewer, getVerifiedViewer } from "@/lib/auth";
import { MfaForm } from "@/components/auth/mfa-form";

export const metadata: Metadata = { title: "Two-factor verification" };

export default async function MfaPage() {
  const verified = await getVerifiedViewer();
  if (verified) redirect(verified.user.platformRole === "SUPER_ADMIN" ? "/platform" : "/dashboard");
  const pending = await getPendingMfaViewer();
  if (!pending) redirect("/login");
  return <MfaForm />;
}

