import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { TenantContext } from "@/lib/auth";
import { zonedDateInput, zonedStartOfDay } from "@/lib/timezone";

export const AUDIT_CATEGORIES = [
  { id: "signin", label: "Sign in & security", prefixes: ["auth."] },
  { id: "bookings", label: "Bookings", prefixes: ["appointment."] },
  { id: "walkins", label: "Walk-ins", prefixes: ["queue."] },
  { id: "customers", label: "Customers", prefixes: ["customer."] },
  { id: "billing", label: "Bills & payments", prefixes: ["invoice.", "payment."] },
  { id: "expenses", label: "Expenses", prefixes: ["expense."] },
  { id: "stock", label: "Stock & suppliers", prefixes: ["product.", "stock.", "purchase.", "supplier."] },
  { id: "staff", label: "Staff & access", prefixes: ["team.", "invitation.", "role_permissions."] },
  { id: "hr", label: "Attendance, salary & leave", prefixes: ["employee.", "attendance.", "leave.", "advance.", "salary."] },
  { id: "setup", label: "Salon setup", prefixes: ["salon.", "branch.", "service.", "tax.", "logo.", "settings."] },
] as const;

export function auditCategory(action: string) {
  return AUDIT_CATEGORIES.find((category) => category.prefixes.some((prefix) => action.startsWith(prefix)))?.id || "other";
}

export function auditCategoryLabel(categoryId: string) {
  return AUDIT_CATEGORIES.find((category) => category.id === categoryId)?.label || "Other";
}

export function auditActionLabel(action: string) {
  const [head, ...rest] = action.split(".");
  const verb = rest.join(" ").replaceAll("_", " ");
  const text = verb ? `${head} ${verb}` : action;
  return text
    .replaceAll(".", " ")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export async function listAuditLogs(
  context: TenantContext,
  input: { page: number; pageSize: number; category?: string; actorId?: string; q?: string; from?: string; to?: string },
) {
  const category = AUDIT_CATEGORIES.find((item) => item.id === input.category);
  const where: Prisma.AuditLogWhereInput = {
    salonId: context.salon.id,
    ...(category ? { OR: category.prefixes.map((prefix) => ({ action: { startsWith: prefix } })) } : {}),
    ...(input.actorId ? { actorUserId: input.actorId } : {}),
    ...(input.q
      ? {
          AND: [
            {
              OR: [
                { action: { contains: input.q, mode: "insensitive" } },
                { entityType: { contains: input.q, mode: "insensitive" } },
                { actor: { name: { contains: input.q, mode: "insensitive" } } },
              ],
            },
          ],
        }
      : {}),
    ...(input.from || input.to
      ? {
          createdAt: {
            ...(input.from ? { gte: new Date(`${input.from}T00:00:00.000Z`) } : {}),
            ...(input.to ? { lte: new Date(`${input.to}T23:59:59.999Z`) } : {}),
          },
        }
      : {}),
  };
  const [items, total, actors] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: { actor: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: "desc" },
      skip: (input.page - 1) * input.pageSize,
      take: input.pageSize,
    }),
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where: { salonId: context.salon.id, actorUserId: { not: null } },
      select: { actorUserId: true, actor: { select: { id: true, name: true } } },
      distinct: ["actorUserId"],
      take: 50,
    }),
  ]);
  return {
    items: items.map((item) => ({
      id: item.id,
      action: item.action,
      actionLabel: auditActionLabel(item.action),
      category: auditCategory(item.action),
      categoryLabel: auditCategoryLabel(auditCategory(item.action)),
      entityType: item.entityType,
      entityId: item.entityId,
      metadata: item.metadata,
      ip: item.ip,
      actor: item.actor ? { id: item.actor.id, name: item.actor.name, email: item.actor.email } : null,
      createdAt: item.createdAt.toISOString(),
    })),
    total,
    pages: Math.ceil(total / input.pageSize),
    actors: actors
      .filter((row): row is { actorUserId: string; actor: { id: string; name: string } } => Boolean(row.actor))
      .map((row) => ({ id: row.actor.id, name: row.actor.name })),
  };
}

export async function getAuditSummary(context: TenantContext) {
  const now = Date.now();
  const since = new Date(now - 30 * 86400000);
  const rows = await prisma.auditLog.findMany({
    where: { salonId: context.salon.id, createdAt: { gte: since } },
    select: { action: true, actorUserId: true },
  });
  const counts = new Map<string, number>();
  rows.forEach((row) => {
    const category = auditCategory(row.action);
    counts.set(category, (counts.get(category) || 0) + 1);
  });
  const weekStart = new Date(now - 7 * 86400000);
  return {
    today: await prisma.auditLog.count({
      where: {
        salonId: context.salon.id,
        createdAt: { gte: zonedStartOfDay(zonedDateInput(new Date(), context.salon.timezone), context.salon.timezone) },
      },
    }),
    week: await prisma.auditLog.count({
      where: { salonId: context.salon.id, createdAt: { gte: weekStart } },
    }),
    month: rows.length,
    categories: AUDIT_CATEGORIES.map((category) => ({
      id: category.id,
      label: category.label,
      count: counts.get(category.id) || 0,
    })).filter((category) => category.count > 0),
  };
}
