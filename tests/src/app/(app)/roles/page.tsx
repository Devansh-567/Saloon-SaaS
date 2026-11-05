import type { Metadata } from "next";
import { requireTenantPage } from "@/lib/guards";
import { listRolePermissions } from "@/services/roles";
import { ROLE_LABELS, type Permission, type StaffRole } from "@/lib/permissions";
import { RolePermissionEditor } from "@/components/roles/role-permission-editor";

export const metadata: Metadata = { title: "Roles & access" };
export const dynamic = "force-dynamic";

export default async function RolesPage() {
  const context = await requireTenantPage("roles.write");
  const roles = await listRolePermissions(context);
  return (
    <div className="stack" style={{ gap: 20 }}>
      <div className="page-head">
        <div>
          <h1>Roles &amp; access</h1>
          <p className="page-subtitle">
            Decide what managers, receptionists, and staff can see and do. The owner always keeps full access.
          </p>
        </div>
      </div>
      <RolePermissionEditor
        roles={roles.map((row) => ({
          ...row,
          role: row.role as Exclude<StaffRole, "OWNER">,
          label: ROLE_LABELS[row.role],
          permissions: row.permissions as Permission[],
        }))}
        actorPermissions={context.permissions}
      />
    </div>
  );
}
