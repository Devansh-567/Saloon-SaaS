import { describe, expect, it } from "vitest";
import {
  PERMISSIONS,
  effectivePermissions,
  parseOverrides,
  roleHasPermission,
} from "@/lib/permissions";

describe("effectivePermissions", () => {
  it("gives owners every permission and ignores revokes", () => {
    expect(effectivePermissions("OWNER", { revoke: ["settings.write"] })).toEqual([...PERMISSIONS]);
  });

  it("gives managers billing and team access but not settings or audit", () => {
    const permissions = effectivePermissions("MANAGER");
    expect(permissions).toContain("billing.refund");
    expect(permissions).toContain("team.write");
    expect(permissions).not.toContain("settings.write");
    expect(permissions).not.toContain("audit.read");
  });

  it("keeps receptionists out of refunds, inventory writes, and salary decisions", () => {
    const permissions = effectivePermissions("RECEPTIONIST");
    expect(permissions).toContain("billing.write");
    expect(permissions).toContain("hr.self");
    expect(permissions).not.toContain("billing.refund");
    expect(permissions).not.toContain("inventory.write");
    expect(permissions).not.toContain("hr.write");
  });

  it("gives managers HR access but not audit or role management", () => {
    const permissions = effectivePermissions("MANAGER");
    expect(permissions).toContain("hr.read");
    expect(permissions).toContain("hr.write");
    expect(permissions).toContain("hr.self");
    expect(permissions).not.toContain("roles.write");
    expect(permissions).not.toContain("audit.read");
  });

  it("keeps staff restricted to their own working surface defaults", () => {
    const permissions = effectivePermissions("STAFF");
    expect(permissions).toContain("appointments.read");
    expect(permissions).toContain("hr.self");
    expect(permissions).not.toContain("billing.read");
    expect(permissions).not.toContain("customers.write");
    expect(permissions).not.toContain("hr.read");
  });

  it("uses stored role permissions in place of defaults", () => {
    const permissions = effectivePermissions("MANAGER", undefined, ["billing.read", "customers.read"]);
    expect(permissions).toHaveLength(2);
    expect(permissions).toEqual(expect.arrayContaining(["billing.read", "customers.read"]));
    expect(effectivePermissions("MANAGER", undefined, [])).toEqual([]);
    expect(effectivePermissions("STAFF", undefined, ["not.real", "hr.self"])).toEqual(["hr.self"]);
  });

  it("applies member grants and revokes after role permissions", () => {
    const permissions = effectivePermissions(
      "RECEPTIONIST",
      { grant: ["billing.refund"], revoke: ["hr.self"] },
      ["billing.read", "hr.self"],
    );
    expect(permissions).toEqual(["billing.read", "billing.refund"]);
  });

  it("applies grants and revokes on top of defaults", () => {
    const permissions = effectivePermissions("STAFF", {
      grant: ["billing.read", "reports.read"],
      revoke: ["inventory.read"],
    });
    expect(permissions).toContain("billing.read");
    expect(permissions).toContain("reports.read");
    expect(permissions).not.toContain("inventory.read");
  });

  it("lets a revoke win over a conflicting grant", () => {
    const permissions = effectivePermissions("RECEPTIONIST", {
      grant: ["billing.refund"],
      revoke: ["billing.refund"],
    });
    expect(permissions).not.toContain("billing.refund");
  });

  it("returns unique permissions drawn from the canonical list", () => {
    const permissions = effectivePermissions("MANAGER", { grant: ["inventory.write"] });
    expect(permissions.every((permission) => PERMISSIONS.includes(permission))).toBe(true);
    expect(new Set(permissions).size).toBe(permissions.length);
  });
});

describe("parseOverrides", () => {
  it("returns empty overrides for malformed input", () => {
    expect(parseOverrides(null)).toEqual({});
    expect(parseOverrides("settings.write")).toEqual({});
    expect(parseOverrides({ grant: "billing.read" })).toEqual({ grant: [], revoke: [] });
  });

  it("drops unknown permissions and non-string entries", () => {
    expect(
      parseOverrides({ grant: ["billing.read", "not.a.permission", 42], revoke: ["team.write"] }),
    ).toEqual({ grant: ["billing.read"], revoke: ["team.write"] });
  });
});

describe("roleHasPermission", () => {
  it("checks effective permissions including overrides", () => {
    expect(roleHasPermission("STAFF", "billing.read")).toBe(false);
    expect(roleHasPermission("STAFF", "billing.read", { grant: ["billing.read"] })).toBe(true);
    expect(roleHasPermission("ADMIN", "audit.read")).toBe(true);
  });
});
