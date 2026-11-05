import type { Metadata } from "next";
import Link from "next/link";
import type { Role } from "@prisma/client";
import { requireTenantPage } from "@/lib/guards";
import { hasPermission } from "@/lib/auth";
import { listTeam, staffLimitInfo } from "@/services/team";
import { getSalonSettingsData } from "@/services/salon-config";
import { parseOverrides, type StaffRole } from "@/lib/permissions";
import { getRolePermissionMap } from "@/services/roles";
import { TeamPanel } from "@/components/team/team-panel";

export const metadata: Metadata = { title: "Team" };
export const dynamic = "force-dynamic";

const MANAGEABLE: Record<Role, StaffRole[]> = {
  OWNER: ["ADMIN", "MANAGER", "RECEPTIONIST", "STAFF"],
  ADMIN: ["MANAGER", "RECEPTIONIST", "STAFF"],
  MANAGER: ["RECEPTIONIST", "STAFF"],
  RECEPTIONIST: [],
  STAFF: [],
};

export default async function TeamPage({
  searchParams,
}: {
  searchParams: Promise<{ invite?: string }>;
}) {
  const context = await requireTenantPage("team.read");
  const params = await searchParams;
  const [team, settings, limits, rolePermissions] = await Promise.all([
    listTeam(context),
    getSalonSettingsData(context),
    staffLimitInfo(context),
    getRolePermissionMap(context),
  ]);

  return (
    <div className="stack" style={{ gap: 20 }}>
      <div className="page-head">
        <div>
          <h1>Team</h1>
          <p className="page-subtitle">
            {limits.maxStaff
              ? `${limits.staff} of ${limits.maxStaff} seats used on your plan.`
              : `${limits.staff} active team member${limits.staff === 1 ? "" : "s"}.`}
          </p>
        </div>
        {hasPermission(context, "roles.write") ? (
          <div className="page-actions">
            <Link href="/roles" className="btn btn-secondary">Roles &amp; access</Link>
          </div>
        ) : null}
      </div>
      <TeamPanel
        members={team.members.map((member) => ({
          ...member,
          role: member.role as StaffRole,
          permissionOverrides: parseOverrides(member.permissionOverrides),
        }))}
        invitations={team.invitations.map((invitation) => ({ ...invitation, role: invitation.role as StaffRole }))}
        branches={settings.branches.map((branch) => ({ id: branch.id, name: branch.name, active: branch.active }))}
        assignableRoles={MANAGEABLE[context.role]}
        currentUserId={context.user.id}
        timezone={context.salon.timezone}
        locale={context.salon.locale}
        canWrite={hasPermission(context, "team.write")}
        rolePermissions={rolePermissions}
        autoOpenInvite={params.invite === "1"}
      />
    </div>
  );
}
