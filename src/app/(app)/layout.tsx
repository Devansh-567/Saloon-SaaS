import { redirect } from "next/navigation";
import { requireTenantPage } from "@/lib/guards";
import { mySalons } from "@/services/auth-service";
import { ROLE_LABELS } from "@/lib/permissions";
import { parseSalonSettings } from "@/lib/settings";
import { AppShell } from "@/components/layout/app-shell";

export const dynamic = "force-dynamic";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const context = await requireTenantPage(undefined, { skipPasswordGate: true });
  if (context.user.mustChangePassword) redirect("/profile?required=1");
  const salons = await mySalons(context);
  const settings = parseSalonSettings(context.salon.settings);

  return (
    <AppShell
      user={{ id: context.user.id, name: context.user.name, email: context.user.email }}
      salon={{ id: context.salon.id, name: context.salon.name, logoFileId: context.salon.logoFileId, currency: context.salon.currency }}
      branch={context.branch?.name || null}
      roleLabel={ROLE_LABELS[context.role]}
      permissions={context.permissions}
      salons={salons.map((membership) => ({ id: membership.salon.id, name: membership.salon.name }))}
      accentColor={settings.accentColor}
    >
      {children}
    </AppShell>
  );
}
