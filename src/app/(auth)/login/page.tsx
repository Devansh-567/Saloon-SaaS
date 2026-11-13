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
 import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getVerifiedViewer } from "@/lib/auth";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const viewer = await getVerifiedViewer();
  if (viewer) redirect(viewer.user.platformRole === "SUPER_ADMIN" ? "/platform" : "/dashboard");
  const params = await searchParams;
  return <LoginForm next={params.next} initialError={params.error} />;
}

