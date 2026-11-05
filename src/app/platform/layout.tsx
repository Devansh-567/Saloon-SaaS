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
