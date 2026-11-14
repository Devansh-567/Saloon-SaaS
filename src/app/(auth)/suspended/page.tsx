import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PlatformRole } from "@prisma/client";
import { getTenantContext, getVerifiedViewer } from "@/lib/auth";
import { Icon } from "@/components/ui/icons";
import { LogoutButton } from "@/components/auth/logout-button";

export const metadata: Metadata = { title: "Workspace suspended" };

export default async function SuspendedPage() {
  const viewer = await getVerifiedViewer();
  if (!viewer) redirect("/login");
  if (viewer.user.platformRole === PlatformRole.SUPER_ADMIN) redirect("/platform");
  const context = await getTenantContext();
  if (!context) redirect("/login?error=no-access");
  if (context.salon.status === "ACTIVE") redirect("/dashboard");

  return (
    <div className="auth-card">
      <div className="empty-icon" style={{ margin: "0 0 20px", width: 52, height: 52 }}>
        <Icon name="ban" />
      </div>
      <h1>Workspace suspended.</h1>
      <p className="auth-sub">
        Access to <strong>{context.salon.name}</strong> is paused. Your records are intact. Contact the platform administrator
        if you believe this is a mistake.
      </p>
      <div className="callout" style={{ marginBottom: 20 }}>
        Signed in as {context.user.email}. Suspension pauses salon access but does not delete data.
      </div>
      <LogoutButton className="btn btn-primary btn-block btn-lg" />
    </div>
  );
}
