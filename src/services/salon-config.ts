import "server-only";
import { Prisma } from "@prisma/client";
import type { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { TenantContext } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { badRequest, notFound } from "@/lib/errors";
import { parseSalonSettings, salonSettingsSchema } from "@/lib/settings";
import { asNumber } from "@/lib/utils";
import type { branchInput, categoryInput, salonProfileInput, serviceInput, taxRateInput } from "@/lib/validation";

type ServiceInput = z.infer<typeof serviceInput>;
type BranchInput = z.infer<typeof branchInput>;
type CategoryInput = z.infer<typeof categoryInput>;
type TaxRateInput = z.infer<typeof taxRateInput>;
type SalonProfileInput = z.infer<typeof salonProfileInput>;

export const serviceInclude = {
  category: { select: { id: true, name: true } },
  taxRate: { select: { id: true, name: true, rate: true } },
  productUsage: { include: { product: { select: { id: true, name: true, unit: true } } } },
} satisfies Prisma.ServiceInclude;

type ServiceFull = Prisma.ServiceGetPayload<{ include: typeof serviceInclude }>;

function serviceDto(service: ServiceFull) {
  return {
    id: service.id,
    name: service.name,
    description: service.description,
    price: asNumber(service.price),
    durationMin: service.durationMin,
    active: service.active,
    commissionRate: service.commissionRate === null ? null : asNumber(service.commissionRate),
    category: service.category,
    taxRate: service.taxRate ? { id: service.taxRate.id, name: service.taxRate.name, rate: asNumber(service.taxRate.rate) } : null,
    productUsage: service.productUsage.map((usage) => ({
      productId: usage.productId,
      quantity: usage.quantity,
      name: usage.product.name,
      unit: usage.product.unit,
    })),
  };
}

export async function getSalonSettingsData(context: TenantContext) {
  const [branches, categories, taxRates, services, staff, subscription] = await Promise.all([
    prisma.branch.findMany({ where: { salonId: context.salon.id }, orderBy: { createdAt: "asc" } }),
    prisma.serviceCategory.findMany({ where: { salonId: context.salon.id }, orderBy: { name: "asc" } }),
    prisma.taxRate.findMany({ where: { salonId: context.salon.id }, orderBy: { name: "asc" } }),
    prisma.service.findMany({ where: { salonId: context.salon.id }, include: serviceInclude, orderBy: { name: "asc" } }),
    prisma.membership.findMany({
      where: { salonId: context.salon.id, active: true },
      include: { user: { select: { name: true, email: true } }, staffProfile: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.subscription.findUnique({ where: { salonId: context.salon.id }, include: { plan: true } }),
  ]);
  return {
    salon: {
      id: context.salon.id,
      name: context.salon.name,
      email: context.salon.email,
      phone: context.salon.phone,
      address: context.salon.address,
      timezone: context.salon.timezone,
      currency: context.salon.currency,
      locale: context.salon.locale,
      logoFileId: context.salon.logoFileId,
      settings: parseSalonSettings(context.salon.settings),
    },
    branches,
    categories,
    taxRates: taxRates.map((tax) => ({ ...tax, rate: asNumber(tax.rate) })),
    services: services.map(serviceDto),
    staff: staff.map((member) => ({
      id: member.id,
      name: member.user.name,
      email: member.user.email,
      role: member.role,
      branchId: member.branchId,
      schedule: member.staffProfile?.schedule || [],
    })),
    subscription: subscription
      ? {
          status: subscription.status,
          trialEndsAt: subscription.trialEndsAt?.toISOString() || null,
          currentPeriodEnd: subscription.currentPeriodEnd?.toISOString() || null,
          plan: { id: subscription.plan.id, name: subscription.plan.name, features: subscription.plan.features, limits: subscription.plan.limits },
        }
      : null,
  };
}

export async function updateSalon(context: TenantContext, input: Partial<SalonProfileInput>, settingsInput?: unknown) {
  let settingsUpdate: Record<string, unknown> | undefined;
  if (settingsInput !== undefined) {
    const current = parseSalonSettings(context.salon.settings);
    const patch = salonSettingsSchema.partial().parse(settingsInput);
    settingsUpdate = { ...current, ...patch };
  }
  const updated = await prisma.salon.update({
    where: { id: context.salon.id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.email !== undefined ? { email: input.email } : {}),
      ...(input.phone !== undefined ? { phone: input.phone } : {}),
      ...(input.address !== undefined ? { address: input.address } : {}),
      ...(input.timezone !== undefined ? { timezone: input.timezone } : {}),
      ...(input.currency !== undefined ? { currency: input.currency } : {}),
      ...(input.locale !== undefined ? { locale: input.locale } : {}),
      ...(settingsUpdate ? { settings: settingsUpdate as Prisma.InputJsonValue } : {}),
    },
  });
  await recordAudit({
    salonId: context.salon.id,
    actorUserId: context.user.id,
    action: "salon.updated",
    entityType: "Salon",
    entityId: context.salon.id,
  });
  return { ...updated, settings: parseSalonSettings(updated.settings) };
}

async function enforceBranchLimit(context: TenantContext) {
  const subscription = await prisma.subscription.findUnique({
    where: { salonId: context.salon.id },
    include: { plan: true },
  });
  const limits = (subscription?.plan.limits || {}) as { maxBranches?: number };
  if (limits.maxBranches) {
    const count = await prisma.branch.count({ where: { salonId: context.salon.id, active: true } });
    if (count >= limits.maxBranches) throw badRequest(`Your plan allows up to ${limits.maxBranches} branches`);
  }
}

export async function createBranch(context: TenantContext, input: BranchInput) {
  await enforceBranchLimit(context);
  const branch = await prisma.branch.create({
    data: {
      salonId: context.salon.id,
      name: input.name,
      phone: input.phone,
      address: input.address,
      isPrimary: false,
    },
  });
  await recordAudit({
    salonId: context.salon.id,
    actorUserId: context.user.id,
    action: "branch.created",
    entityType: "Branch",
    entityId: branch.id,
  });
  return branch;
}

export async function updateBranch(context: TenantContext, id: string, input: Partial<BranchInput> & { active?: boolean }) {
  const branch = await prisma.branch.findFirst({ where: { id, salonId: context.salon.id } });
  if (!branch) throw notFound("Branch not found");
  if (branch.isPrimary && input.active === false) throw badRequest("The primary branch cannot be deactivated");
  return prisma.branch.update({ where: { id }, data: input });
}

export async function createCategory(context: TenantContext, input: CategoryInput) {
  return prisma.serviceCategory.create({ data: { salonId: context.salon.id, name: input.name } });
}

export async function deleteCategory(context: TenantContext, id: string) {
  const category = await prisma.serviceCategory.findFirst({ where: { id, salonId: context.salon.id } });
  if (!category) throw notFound("Category not found");
  await prisma.serviceCategory.delete({ where: { id } });
}

export async function createTaxRate(context: TenantContext, input: TaxRateInput) {
  return prisma.taxRate.create({ data: { salonId: context.salon.id, name: input.name, rate: input.rate, active: input.active } });
}

export async function updateTaxRate(context: TenantContext, id: string, input: Partial<TaxRateInput>) {
  const tax = await prisma.taxRate.findFirst({ where: { id, salonId: context.salon.id } });
  if (!tax) throw notFound("Tax rate not found");
  return prisma.taxRate.update({ where: { id }, data: input });
}

async function validateServiceReferences(context: TenantContext, input: Partial<ServiceInput>) {
  if (input.categoryId) {
    const category = await prisma.serviceCategory.findFirst({ where: { id: input.categoryId, salonId: context.salon.id } });
    if (!category) throw badRequest("Category not found");
  }
  if (input.taxRateId) {
    const tax = await prisma.taxRate.findFirst({ where: { id: input.taxRateId, salonId: context.salon.id } });
    if (!tax) throw badRequest("Tax rate not found");
  }
  if (input.productUsage?.length) {
    const ids = [...new Set(input.productUsage.map((p) => p.productId))];
    const count = await prisma.product.count({ where: { id: { in: ids }, salonId: context.salon.id } });
    if (count !== ids.length) throw badRequest("One or more products were not found");
  }
}

export async function createService(context: TenantContext, input: ServiceInput) {
  await validateServiceReferences(context, input);
  const service = await prisma.service.create({
    data: {
      salonId: context.salon.id,
      name: input.name,
      description: input.description,
      categoryId: input.categoryId,
      taxRateId: input.taxRateId,
      price: input.price,
      durationMin: input.durationMin,
      commissionRate: input.commissionRate ?? null,
      active: input.active,
      productUsage: {
        create: input.productUsage.map((usage) => ({ productId: usage.productId, quantity: usage.quantity })),
      },
    },
    include: serviceInclude,
  });
  await recordAudit({
    salonId: context.salon.id,
    actorUserId: context.user.id,
    action: "service.created",
    entityType: "Service",
    entityId: service.id,
  });
  return serviceDto(service);
}

export async function updateService(context: TenantContext, id: string, input: Partial<ServiceInput>) {
  const existing = await prisma.service.findFirst({ where: { id, salonId: context.salon.id } });
  if (!existing) throw notFound("Service not found");
  await validateServiceReferences(context, input);
  const service = await prisma.$transaction(async (tx) => {
    if (input.productUsage) {
      await tx.serviceProduct.deleteMany({ where: { serviceId: id } });
      if (input.productUsage.length) {
        await tx.serviceProduct.createMany({
          data: input.productUsage.map((usage) => ({ serviceId: id, productId: usage.productId, quantity: usage.quantity })),
        });
      }
    }
    return tx.service.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.categoryId !== undefined ? { categoryId: input.categoryId } : {}),
        ...(input.taxRateId !== undefined ? { taxRateId: input.taxRateId } : {}),
        ...(input.price !== undefined ? { price: input.price } : {}),
        ...(input.durationMin !== undefined ? { durationMin: input.durationMin } : {}),
        ...(input.commissionRate !== undefined ? { commissionRate: input.commissionRate } : {}),
        ...(input.active !== undefined ? { active: input.active } : {}),
      },
      include: serviceInclude,
    });
  });
  await recordAudit({
    salonId: context.salon.id,
    actorUserId: context.user.id,
    action: "service.updated",
    entityType: "Service",
    entityId: id,
  });
  return serviceDto(service);
}

export async function listBookableStaff(context: TenantContext, branchId?: string) {
  const staff = await prisma.membership.findMany({
    where: {
      salonId: context.salon.id,
      active: true,
      ...(branchId ? { OR: [{ branchId }, { branchId: null }] } : {}),
    },
    include: {
      user: { select: { name: true } },
      staffProfile: { select: { color: true, schedule: true } },
    },
    orderBy: { createdAt: "asc" },
  });
  return staff.map((member) => ({
    id: member.id,
    name: member.user.name,
    branchId: member.branchId,
    color: member.staffProfile?.color || "#8c6a52",
    schedule: member.staffProfile?.schedule || [],
  }));
}
