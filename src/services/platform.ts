import "server-only";
import { PlatformRole, Prisma, SalonStatus, SubscriptionStatus, Role } from "@prisma/client";
import type { z } from "zod";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { badRequest, conflict, notFound } from "@/lib/errors";
import { hashPassword } from "@/lib/crypto";
import { recordAudit } from "@/lib/audit";
import { slugify, asNumber } from "@/lib/utils";
import { DEFAULT_PLATFORM_SETTINGS, parseSalonSettings, platformSettingsSchema } from "@/lib/settings";
import type { platformSalonInput, platformSettingsUpdate, planInput, subscriptionInput, templateInput } from "@/lib/validation";
import type { TenantContext } from "@/lib/auth";

type PlatformSalonInput = z.infer<typeof platformSalonInput>;
type PlanInput = z.infer<typeof planInput>;
type SubscriptionInput = z.infer<typeof subscriptionInput>;
type TemplateInput = z.infer<typeof templateInput>;
type SettingsInput = z.infer<typeof platformSettingsUpdate>;

async function uniqueSlug(name: string) {
  const base = slugify(name) || "salon";
  let slug = base;
  let suffix = 2;
  while (await prisma.salon.findUnique({ where: { slug } })) {
    slug = `${base}-${suffix}`;
    suffix += 1;
  }
  return slug;
}

export async function listPlatformSalons(input: { q?: string; status?: SalonStatus; page: number; pageSize: number }) {
  const where: Prisma.SalonWhereInput = {
    ...(input.status ? { status: input.status } : {}),
    ...(input.q
      ? {
          OR: [
            { name: { contains: input.q, mode: "insensitive" } },
            { email: { contains: input.q, mode: "insensitive" } },
            { owner: { name: { contains: input.q, mode: "insensitive" } } },
            { owner: { email: { contains: input.q, mode: "insensitive" } } },
          ],
        }
      : {}),
  };
  const [items, total] = await prisma.$transaction([
    prisma.salon.findMany({
      where,
      include: {
        owner: { select: { name: true, email: true } },
        _count: { select: { memberships: true, branches: true, customers: true } },
        plans: { include: { plan: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (input.page - 1) * input.pageSize,
      take: input.pageSize,
    }),
    prisma.salon.count({ where }),
  ]);
  return {
    items: items.map((salon) => ({
      id: salon.id,
      name: salon.name,
      slug: salon.slug,
      email: salon.email,
      phone: salon.phone,
      status: salon.status,
      createdAt: salon.createdAt.toISOString(),
      owner: salon.owner,
      memberCount: salon._count.memberships,
      branchCount: salon._count.branches,
      customerCount: salon._count.customers,
      subscription: salon.plans
        ? { id: salon.plans.id, status: salon.plans.status, plan: salon.plans.plan.name }
        : null,
    })),
    total,
    pages: Math.ceil(total / input.pageSize),
  };
}

export async function getPlatformDashboard() {
  const [salonCount, activeSalons, suspendedSalons, customerCount, appointmentCount, invoiceTotals, subscriptions, recentSalons, recentAudit] =
    await Promise.all([
      prisma.salon.count(),
      prisma.salon.count({ where: { status: "ACTIVE" } }),
      prisma.salon.count({ where: { status: "SUSPENDED" } }),
      prisma.customer.count(),
      prisma.appointment.count(),
      prisma.invoice.aggregate({
        where: { status: { notIn: ["VOID", "DRAFT"] } },
        _sum: { total: true },
      }),
      prisma.subscription.findMany({
        include: { plan: { select: { monthlyPrice: true, name: true } }, salon: { select: { name: true } } },
      }),
      prisma.salon.findMany({
        orderBy: { createdAt: "desc" },
        take: 6,
        select: { id: true, name: true, status: true, createdAt: true },
      }),
      prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 8, include: { salon: { select: { name: true } } } }),
    ]);
  const mrr = subscriptions
    .filter((subscription) => subscription.status === "ACTIVE")
    .reduce((sum, subscription) => sum + asNumber(subscription.plan.monthlyPrice), 0);
  const planCounts = subscriptions.reduce((map, subscription) => {
    map.set(subscription.plan.name, (map.get(subscription.plan.name) || 0) + 1);
    return map;
  }, new Map<string, number>());
  return {
    salonCount,
    activeSalons,
    suspendedSalons,
    customerCount,
    appointmentCount,
    gmv: asNumber(invoiceTotals._sum.total),
    mrr,
    activeSubscriptions: subscriptions.filter((s) => s.status === "ACTIVE").length,
    trials: subscriptions.filter((s) => s.status === "TRIALING").length,
    planCounts: [...planCounts.entries()].map(([name, count]) => ({ name, count })),
    recentSalons: recentSalons.map((salon) => ({ ...salon, createdAt: salon.createdAt.toISOString() })),
    recentAudit: recentAudit.map((log) => ({
      id: log.id,
      action: log.action,
      entityType: log.entityType,
      salon: log.salon?.name || "Platform",
      createdAt: log.createdAt.toISOString(),
    })),
  };
}

export async function onboardSalon(actorUserId: string, input: PlatformSalonInput) {
  let plan = null;
  if (input.planId) {
    plan = await prisma.plan.findFirst({ where: { id: input.planId, active: true } });
    if (!plan) throw badRequest("Plan not found or inactive");
  }
  const existingUser = await prisma.user.findUnique({ where: { email: input.ownerEmail } });
  if (existingUser?.platformRole === PlatformRole.SUPER_ADMIN) throw badRequest("A platform administrator cannot own a salon");
  const passwordHash = existingUser ? null : await hashPassword(input.ownerPassword);
  const slug = await uniqueSlug(input.salonName);
  const salon = await prisma.$transaction(async (tx) => {
    const owner = existingUser
      ? existingUser
      : await tx.user.create({
          data: {
            email: input.ownerEmail,
            name: input.ownerName,
            phone: input.phone,
            passwordHash: passwordHash!,
            mustChangePassword: true,
          },
        });
    const created = await tx.salon.create({
      data: {
        name: input.salonName,
        slug,
        email: input.ownerEmail,
        phone: input.phone,
        timezone: input.timezone,
        currency: input.currency,
        ownerId: owner.id,
        settings: parseSalonSettings({}),
      },
    });
    await tx.branch.create({
      data: { salonId: created.id, name: "Main branch", isPrimary: true, phone: input.phone },
    });
    const membership = await tx.membership.create({
      data: { salonId: created.id, userId: owner.id, role: Role.OWNER },
    });
    await tx.staffProfile.create({ data: { membershipId: membership.id } });
    if (plan) {
      const trialEndsAt = new Date(Date.now() + env.TRIAL_DAYS * 86400000);
      await tx.subscription.create({
        data: {
          salonId: created.id,
          planId: plan.id,
          status: SubscriptionStatus.TRIALING,
          trialEndsAt,
          currentPeriodEnd: trialEndsAt,
        },
      });
    }
    return created;
  });
  await recordAudit({
    salonId: salon.id,
    actorUserId,
    action: "platform.salon_onboarded",
    entityType: "Salon",
    entityId: salon.id,
    metadata: { ownerEmail: input.ownerEmail, planId: plan?.id },
  });
  return { id: salon.id, slug: salon.slug };
}

export async function updateSalonStatus(actorUserId: string, salonId: string, status: SalonStatus) {
  if (!Object.values(SalonStatus).includes(status)) throw badRequest("Invalid salon status");
  const salon = await prisma.salon.findUnique({ where: { id: salonId } });
  if (!salon) throw notFound("Salon not found");
  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.salon.update({ where: { id: salonId }, data: { status } });
    if (status === "SUSPENDED") {
      await tx.session.deleteMany({ where: { salonId } });
    }
    return result;
  });
  await recordAudit({
    salonId,
    actorUserId,
    action: status === "SUSPENDED" ? "platform.salon_suspended" : "platform.salon_activated",
    entityType: "Salon",
    entityId: salonId,
  });
  return updated;
}

export async function setSubscription(actorUserId: string, salonId: string, input: SubscriptionInput) {
  const plan = await prisma.plan.findFirst({ where: { id: input.planId } });
  if (!plan) throw badRequest("Plan not found");
  const salon = await prisma.salon.findUnique({ where: { id: salonId } });
  if (!salon) throw notFound("Salon not found");
  const subscription = await prisma.subscription.upsert({
    where: { salonId },
    create: {
      salonId,
      planId: input.planId,
      status: input.status,
      trialEndsAt: input.trialEndsAt,
      currentPeriodEnd: input.currentPeriodEnd,
    },
    update: {
      planId: input.planId,
      status: input.status,
      trialEndsAt: input.trialEndsAt,
      currentPeriodEnd: input.currentPeriodEnd,
    },
    include: { plan: true },
  });
  await recordAudit({
    salonId,
    actorUserId,
    action: "platform.subscription_updated",
    entityType: "Subscription",
    entityId: subscription.id,
    metadata: { plan: plan.name, status: input.status },
  });
  return subscription;
}

export async function listPlans() {
  return prisma.plan.findMany({
    include: { _count: { select: { subscriptions: true } } },
    orderBy: { monthlyPrice: "asc" },
  });
}

export async function createPlan(input: PlanInput) {
  const plan = await prisma.plan.create({
    data: {
      name: input.name,
      slug: input.slug,
      description: input.description,
      monthlyPrice: input.monthlyPrice,
      yearlyPrice: input.yearlyPrice,
      features: input.features,
      limits: input.limits,
      active: input.active,
    },
  });
  return plan;
}

export async function updatePlan(actorUserId: string, id: string, input: Partial<PlanInput>) {
  const plan = await prisma.plan.findUnique({ where: { id } });
  if (!plan) throw notFound("Plan not found");
  if (input.slug && input.slug !== plan.slug) {
    const clash = await prisma.plan.findUnique({ where: { slug: input.slug } });
    if (clash) throw conflict("A plan with this slug already exists");
  }
  const updated = await prisma.plan.update({ where: { id }, data: input });
  await recordAudit({
    actorUserId,
    action: "platform.plan_updated",
    entityType: "Plan",
    entityId: id,
    metadata: { name: updated.name },
  });
  return updated;
}

export async function getPlatformSettings() {
  const record = await prisma.platformSetting.findUnique({ where: { key: "platform" } });
  if (!record) return DEFAULT_PLATFORM_SETTINGS;
  const parsed = platformSettingsSchema.safeParse(record.value);
  return parsed.success ? parsed.data : DEFAULT_PLATFORM_SETTINGS;
}

export async function updatePlatformSettings(actorUserId: string, input: SettingsInput) {
  const settings = await prisma.platformSetting.upsert({
    where: { key: "platform" },
    create: { key: "platform", value: input },
    update: { value: input },
  });
  await recordAudit({
    actorUserId,
    action: "platform.settings_updated",
    entityType: "PlatformSetting",
    entityId: "platform",
  });
  return platformSettingsSchema.parse(settings.value);
}

export async function listTemplates() {
  return prisma.notificationTemplate.findMany({
    where: { salonId: null },
    orderBy: [{ key: "asc" }, { channel: "asc" }],
  });
}

export async function upsertTemplate(actorUserId: string, input: TemplateInput) {
  const template = await prisma.notificationTemplate.upsert({
    where: { scope_key_channel: { scope: "global", key: input.key, channel: input.channel } },
    create: { scope: "global", salonId: null, ...input },
    update: { subject: input.subject, body: input.body, enabled: input.enabled },
  });
  await recordAudit({
    actorUserId,
    action: "platform.template_updated",
    entityType: "NotificationTemplate",
    entityId: template.id,
    metadata: { key: input.key, channel: input.channel },
  });
  return template;
}

export async function deleteTemplate(actorUserId: string, id: string) {
  const template = await prisma.notificationTemplate.findFirst({ where: { id, salonId: null } });
  if (!template) throw notFound("Template not found");
  await prisma.notificationTemplate.delete({ where: { id } });
  await recordAudit({
    actorUserId,
    action: "platform.template_deleted",
    entityType: "NotificationTemplate",
    entityId: id,
  });
}

export async function listAuditLogs(input: { page: number; pageSize: number; salonId?: string; q?: string }) {
  const where: Prisma.AuditLogWhereInput = {
    ...(input.salonId ? { salonId: input.salonId } : {}),
    ...(input.q
      ? {
          OR: [
            { action: { contains: input.q, mode: "insensitive" } },
            { entityType: { contains: input.q, mode: "insensitive" } },
            { actor: { email: { contains: input.q, mode: "insensitive" } } },
          ],
        }
      : {}),
  };
  const [items, total] = await prisma.$transaction([
    prisma.auditLog.findMany({
      where,
      include: { salon: { select: { name: true } }, actor: { select: { name: true, email: true } } },
      orderBy: { createdAt: "desc" },
      skip: (input.page - 1) * input.pageSize,
      take: input.pageSize,
    }),
    prisma.auditLog.count({ where }),
  ]);
  return {
    items: items.map((log) => ({
      id: log.id,
      action: log.action,
      entityType: log.entityType,
      entityId: log.entityId,
      salon: log.salon?.name || "Platform",
      actor: log.actor?.name || "System",
      metadata: log.metadata,
      createdAt: log.createdAt.toISOString(),
    })),
    total,
    pages: Math.ceil(total / input.pageSize),
  };
}

export async function listNotificationLogs(input: { page: number; pageSize: number; status?: string }) {
  const where: Prisma.NotificationLogWhereInput = input.status
    ? { status: input.status as never }
    : {};
  const [items, total] = await prisma.$transaction([
    prisma.notificationLog.findMany({
      where,
      include: { salon: { select: { name: true } }, template: { select: { key: true } } },
      orderBy: { createdAt: "desc" },
      skip: (input.page - 1) * input.pageSize,
      take: input.pageSize,
    }),
    prisma.notificationLog.count({ where }),
  ]);
  return {
    items: items.map((log) => ({
      id: log.id,
      channel: log.channel,
      templateKey: log.templateKey,
      recipient: log.recipient,
      status: log.status,
      error: log.error,
      salon: log.salon?.name || "Platform",
      createdAt: log.createdAt.toISOString(),
    })),
    total,
    pages: Math.ceil(total / input.pageSize),
  };
}

export async function listSalonOptions() {
  return prisma.salon.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } });
}

export function tenantPlanDto(context: TenantContext) {
  return prisma.subscription.findUnique({ where: { salonId: context.salon.id }, include: { plan: true } });
}
