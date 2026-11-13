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
import { RegisterForm } from "@/components/auth/register-form";

export const metadata: Metadata = { title: "Create your salon" };
export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  const viewer = await getVerifiedViewer();
  if (viewer) redirect("/dashboard");
  return <RegisterForm />;
}

