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
