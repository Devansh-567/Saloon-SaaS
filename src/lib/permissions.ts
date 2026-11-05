export const PERMISSIONS = [
  "appointments.read",
  "appointments.write",
  "queue.read",
  "queue.write",
  "customers.read",
  "customers.write",
  "billing.read",
  "billing.write",
  "billing.refund",
  "services.read",
  "services.write",
  "inventory.read",
  "inventory.write",
  "expenses.read",
  "expenses.write",
  "reports.read",
  "team.read",
  "team.write",
  "hr.read",
  "hr.write",
  "hr.self",
  "settings.write",
  "roles.write",
  "audit.read",
  "notifications.send",
] as const;

export type Permission = (typeof PERMISSIONS)[number];
export type StaffRole = "OWNER" | "ADMIN" | "MANAGER" | "RECEPTIONIST" | "STAFF";

export const ROLE_LABELS: Record<StaffRole, string> = {
  OWNER: "Owner",
  ADMIN: "Administrator",
  MANAGER: "Manager",
  RECEPTIONIST: "Receptionist",
  STAFF: "Staff",
};

export const ROLE_DESCRIPTIONS: Record<StaffRole, string> = {
  OWNER: "Full control of the salon. This role always has every permission.",
  ADMIN: "Runs the salon day to day and can change most settings.",
  MANAGER: "Leads the floor, staff, stock, and money reports.",
  RECEPTIONIST: "Handles bookings, customers, the waiting list, and bills.",
  STAFF: "Sees their own work and the services they need for the day.",
};

export const PERMISSION_LABELS: Record<Permission, string> = {
  "appointments.read": "See bookings",
  "appointments.write": "Create and change bookings",
  "queue.read": "See the waiting list",
  "queue.write": "Manage the waiting list",
  "customers.read": "See customer details",
  "customers.write": "Add and edit customers",
  "billing.read": "See bills and payments",
  "billing.write": "Create bills and take payments",
  "billing.refund": "Give money back to customers",
  "services.read": "See services and prices",
  "services.write": "Add and change services",
  "inventory.read": "See stock",
  "inventory.write": "Manage stock and suppliers",
  "expenses.read": "See expenses",
  "expenses.write": "Add and change expenses",
  "reports.read": "See reports",
  "team.read": "See the staff list",
  "team.write": "Invite and edit staff",
  "hr.read": "See everyone's attendance, salary, and leave",
  "hr.write": "Manage attendance, salary, advances, and staff documents",
  "hr.self": "See own work, payslips, and request leave",
  "settings.write": "Change business settings",
  "roles.write": "Change what each role can do",
  "audit.read": "See the activity log",
  "notifications.send": "Send messages to customers",
};

export const PERMISSION_GROUPS: Array<{ label: string; permissions: Permission[] }> = [
  { label: "Front desk", permissions: ["appointments.read", "appointments.write", "queue.read", "queue.write", "customers.read", "customers.write"] },
  { label: "Money", permissions: ["billing.read", "billing.write", "billing.refund", "expenses.read", "expenses.write", "reports.read"] },
  { label: "Salon setup", permissions: ["services.read", "services.write", "inventory.read", "inventory.write"] },
  { label: "Staff", permissions: ["team.read", "team.write", "hr.read", "hr.write", "hr.self"] },
  { label: "Administration", permissions: ["settings.write", "roles.write", "audit.read", "notifications.send"] },
];

const ALL: Permission[] = [...PERMISSIONS];
const ROLE_DEFAULTS: Record<StaffRole, Permission[]> = {
  OWNER: ALL,
  ADMIN: ALL,
  MANAGER: [
    "appointments.read",
    "appointments.write",
    "queue.read",
    "queue.write",
    "customers.read",
    "customers.write",
    "billing.read",
    "billing.write",
    "billing.refund",
    "services.read",
    "services.write",
    "inventory.read",
    "inventory.write",
    "expenses.read",
    "expenses.write",
    "reports.read",
    "team.read",
    "team.write",
    "hr.read",
    "hr.write",
    "hr.self",
    "notifications.send",
  ],
  RECEPTIONIST: [
    "appointments.read",
    "appointments.write",
    "queue.read",
    "queue.write",
    "customers.read",
    "customers.write",
    "billing.read",
    "billing.write",
    "services.read",
    "inventory.read",
    "team.read",
    "hr.self",
    "notifications.send",
  ],
  STAFF: [
    "appointments.read",
    "appointments.write",
    "queue.read",
    "customers.read",
    "services.read",
    "inventory.read",
    "hr.self",
  ],
};

export function defaultPermissionsFor(role: StaffRole): Permission[] {
  return [...ROLE_DEFAULTS[role]];
}

export function sanitizePermissions(input: unknown): Permission[] {
  if (!Array.isArray(input)) return [];
  return PERMISSIONS.filter((permission) => input.includes(permission));
}

export function isPermission(value: unknown): value is Permission {
  return typeof value === "string" && (PERMISSIONS as readonly string[]).includes(value);
}

export type PermissionOverrides = { grant?: Permission[]; revoke?: Permission[] };

export function parseOverrides(value: unknown): PermissionOverrides {
  if (!value || typeof value !== "object") return {};
  const obj = value as Record<string, unknown>;
  const clean = (input: unknown): Permission[] => {
    if (!Array.isArray(input)) return [];
    return input.filter(isPermission);
  };
  return { grant: clean(obj.grant), revoke: clean(obj.revoke) };
}

export function effectivePermissions(
  role: StaffRole,
  overrides?: unknown,
  rolePermissions?: readonly string[] | null,
): Permission[] {
  if (role === "OWNER") return ALL;
  const base = Array.isArray(rolePermissions) ? sanitizePermissions(rolePermissions) : ROLE_DEFAULTS[role];
  const defaults = new Set(base);
  const { grant = [], revoke = [] } = parseOverrides(overrides);
  grant.forEach((p) => defaults.add(p));
  revoke.forEach((p) => defaults.delete(p));
  return PERMISSIONS.filter((p) => defaults.has(p));
}

export function roleHasPermission(
  role: StaffRole,
  permission: Permission,
  overrides?: unknown,
  rolePermissions?: readonly string[] | null,
) {
  return effectivePermissions(role, overrides, rolePermissions).includes(permission);
}
