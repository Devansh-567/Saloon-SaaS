import { NextRequest } from "next/server";
import { withApi, ok, readJson } from "@/lib/api";
import { requireApiTenant } from "@/lib/auth";
import { badRequest } from "@/lib/errors";
import { rolePermissionInput } from "@/lib/validation";
import { listRolePermissions, resetRolePermissions, updateRolePermissions } from "@/services/roles";
import type { StaffRole } from "@/lib/permissions";

export async function GET(request: NextRequest) {
  return withApi(request, async () => {
    const context = await requireApiTenant("roles.write");
    return ok(await listRolePermissions(context));
  });
}

export async function PATCH(request: NextRequest) {
  return withApi(request, async () => {
    const context = await requireApiTenant("roles.write");
    return ok(await updateRolePermissions(context, await readJson(request, rolePermissionInput)));
  });
}

export async function DELETE(request: NextRequest) {
  return withApi(request, async () => {
    const context = await requireApiTenant("roles.write");
    const role = request.nextUrl.searchParams.get("role") as Exclude<StaffRole, "OWNER"> | null;
    if (!role || !["ADMIN", "MANAGER", "RECEPTIONIST", "STAFF"].includes(role)) throw badRequest("Choose a valid role");
    return ok(await resetRolePermissions(context, role));
  });
}
