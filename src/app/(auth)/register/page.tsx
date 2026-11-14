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
