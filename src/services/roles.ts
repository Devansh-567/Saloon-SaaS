import "server-only";
import type { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { TenantContext } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { forbidden } from "@/lib/errors";
import {
  PERMISSIONS,
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
  defaultPermissionsFor,
  effectivePermissions,
  sanitizePermissions,
  type Permission,
  type StaffRole,
} from "@/lib/permissions";
import type { rolePermissionInput } from "@/lib/validation";

export const EDITABLE_ROLES: Exclude<StaffRole, "OWNER">[] = ["ADMIN", "MANAGER", "RECEPTIONIST", "STAFF"];

type RolePermissionInput = z.infer<typeof rolePermissionInput>;

export async function getRolePermissionMap(context: TenantContext): Promise<Record<StaffRole, Permission[]>> {
  const rows = await prisma.salonRolePermission.findMany({
    where: { salonId: context.salon.id },
    select: { role: true, permissions: true },
  });
  const stored = new Map(rows.map((row) => [row.role as StaffRole, sanitizePermissions(row.permissions)]));
  return {
    OWNER: [...PERMISSIONS],
    ADMIN: stored.get("ADMIN") ?? defaultPermissionsFor("ADMIN"),
    MANAGER: stored.get("MANAGER") ?? defaultPermissionsFor("MANAGER"),
    RECEPTIONIST: stored.get("RECEPTIONIST") ?? defaultPermissionsFor("RECEPTIONIST"),
    STAFF: stored.get("STAFF") ?? defaultPermissionsFor("STAFF"),
  };
}

export async function listRolePermissions(context: TenantContext) {
  const map = await getRolePermissionMap(context);
  return EDITABLE_ROLES.map((role) => ({
    role,
    label: ROLE_LABELS[role],
    description: ROLE_DESCRIPTIONS[role],
    permissions: map[role],
    customised: map[role].join("|") !== defaultPermissionsFor(role).join("|"),
  }));
}

export async function updateRolePermissions(context: TenantContext, input: RolePermissionInput) {
  if (!context.permissions.includes("roles.write")) throw forbidden("You cannot change role permissions");
  const requested = [...new Set(input.permissions)];
  const beyondActor = requested.filter((permission) => !context.permissions.includes(permission));
  if (beyondActor.length) throw forbidden("You cannot give a role more access than you have");
  const role = input.role as StaffRole;
  await prisma.salonRolePermission.upsert({
    where: { salonId_role: { salonId: context.salon.id, role: input.role } },
    create: {
      salonId: context.salon.id,
      role: input.role,
      permissions: requested,
      updatedById: context.user.id,
    },
    update: { permissions: requested, updatedById: context.user.id },
  });
  await recordAudit({
    salonId: context.salon.id,
    actorUserId: context.user.id,
    action: "role_permissions.updated",
    entityType: "SalonRolePermission",
    entityId: `${context.salon.id}:${input.role}`,
    metadata: { role: input.role, permissions: requested },
  });
  return { role, permissions: effectivePermissions(role, undefined, requested) };
}

export async function resetRolePermissions(context: TenantContext, role: Exclude<StaffRole, "OWNER">) {
  if (!context.permissions.includes("roles.write")) throw forbidden("You cannot change role permissions");
  await prisma.salonRolePermission.deleteMany({ where: { salonId: context.salon.id, role } });
  await recordAudit({
    salonId: context.salon.id,
    actorUserId: context.user.id,
    action: "role_permissions.reset",
    entityType: "SalonRolePermission",
    entityId: `${context.salon.id}:${role}`,
    metadata: { role },
  });
  return { role, permissions: defaultPermissionsFor(role) };
}
