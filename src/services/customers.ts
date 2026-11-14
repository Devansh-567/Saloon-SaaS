import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { TenantContext } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { notFound } from "@/lib/errors";
import { asNumber, dateOnlyFromInput, isoDateOnly } from "@/lib/utils";
import type { z } from "zod";
import type { customerInput, customerNoteInput, followUpInput, followUpUpdate } from "@/lib/validation";

type CustomerInput = z.infer<typeof customerInput>;
type FollowUpInput = z.infer<typeof followUpInput>;
type FollowUpUpdate = z.infer<typeof followUpUpdate>;
type CustomerNoteInput = z.infer<typeof customerNoteInput>;

export function customerDto(customer: {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string | null;
  notes: string | null;
  preferences: string | null;
  tags: string[];
  birthday: Date | null;
  anniversary: Date | null;
  preferredStaffMembershipId: string | null;
  marketingOptIn: boolean;
  source: string | null;
  lastVisitAt: Date | null;
  nextFollowUpAt: Date | null;
  loyaltyPoints: number;
  totalVisits: number;
  totalSpent: Prisma.Decimal;
  createdAt: Date;
}) {
  return {
    id: customer.id,
    firstName: customer.firstName,
    lastName: customer.lastName,
    name: `${customer.firstName} ${customer.lastName}`.trim(),
    phone: customer.phone,
    email: customer.email,
    notes: customer.notes,
    preferences: customer.preferences,
    tags: customer.tags,
    birthday: customer.birthday ? isoDateOnly(customer.birthday) : null,
    anniversary: customer.anniversary ? isoDateOnly(customer.anniversary) : null,
    preferredStaffMembershipId: customer.preferredStaffMembershipId,
    marketingOptIn: customer.marketingOptIn,
    source: customer.source,
    lastVisitAt: customer.lastVisitAt?.toISOString() || null,
    nextFollowUpAt: customer.nextFollowUpAt?.toISOString() || null,
    loyaltyPoints: customer.loyaltyPoints,
    totalVisits: customer.totalVisits,
    totalSpent: asNumber(customer.totalSpent),
    createdAt: customer.createdAt.toISOString(),
  };
}

function dateOnlyOrNull(value: string | null | undefined) {
  return value ? dateOnlyFromInput(value) : null;
}

export async function listCustomerStaff(context: TenantContext) {
  const members = await prisma.membership.findMany({
    where: { salonId: context.salon.id, active: true },
    include: { user: { select: { name: true } } },
    orderBy: { user: { name: "asc" } },
  });
  return members.map((member) => ({ id: member.id, name: member.user.name }));
}

export async function listCustomers(context: TenantContext, input: { q?: string; page: number; pageSize: number }) {
  const where: Prisma.CustomerWhereInput = {
    salonId: context.salon.id,
    ...(input.q
      ? {
          OR: [
            { firstName: { contains: input.q, mode: "insensitive" } },
            { lastName: { contains: input.q, mode: "insensitive" } },
            { phone: { contains: input.q } },
            { email: { contains: input.q, mode: "insensitive" } },
            { tags: { has: input.q } },
          ],
        }
      : {}),
  };
  const [items, total] = await prisma.$transaction([
    prisma.customer.findMany({
      where,
      include: { preferredStaff: { include: { user: { select: { name: true } } } } },
      orderBy: { createdAt: "desc" },
      skip: (input.page - 1) * input.pageSize,
      take: input.pageSize,
    }),
    prisma.customer.count({ where }),
  ]);
  return {
    items: items.map((customer) => ({
      ...customerDto(customer),
      preferredStaff: customer.preferredStaff?.user.name || null,
    })),
    total,
    pages: Math.ceil(total / input.pageSize),
  };
}

export async function getCustomer(context: TenantContext, customerId: string) {
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, salonId: context.salon.id },
    include: {
      appointments: {
        orderBy: { startAt: "desc" },
        take: 20,
        include: { service: { select: { name: true } }, staff: { include: { user: { select: { name: true } } } } },
      },
      invoices: {
        orderBy: { createdAt: "desc" },
        take: 20,
        select: { id: true, number: true, total: true, status: true, createdAt: true },
      },
      queueTickets: { orderBy: { createdAt: "desc" }, take: 5 },
      preferredStaff: { include: { user: { select: { name: true } } } },
      notesTimeline: {
        orderBy: { createdAt: "desc" },
        take: 30,
        include: { createdBy: { select: { name: true } } },
      },
      followUps: {
        orderBy: [{ status: "asc" }, { dueAt: "asc" }],
        take: 30,
        include: { assignedTo: { include: { user: { select: { name: true } } } } },
      },
    },
  });
  if (!customer) return null;
  const serviceCounts = new Map<string, number>();
  customer.appointments.forEach((appointment) => {
    serviceCounts.set(appointment.service.name, (serviceCounts.get(appointment.service.name) || 0) + 1);
  });
  const favoriteService = [...serviceCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || null;
  return {
    ...customerDto(customer),
    preferredStaff: customer.preferredStaff?.user.name || null,
    appointments: customer.appointments.map((a) => ({
      id: a.id,
      service: a.service.name,
      staff: a.staff.user.name,
      startAt: a.startAt.toISOString(),
      status: a.status,
    })),
    invoices: customer.invoices.map((i) => ({
      id: i.id,
      number: i.number,
      total: asNumber(i.total),
      status: i.status,
      createdAt: i.createdAt.toISOString(),
    })),
    queueTickets: customer.queueTickets.map((q) => ({
      id: q.id,
      queueNumber: q.queueNumber,
      status: q.status,
      createdAt: q.createdAt.toISOString(),
    })),
    notesTimeline: customer.notesTimeline.map((note) => ({
      id: note.id,
      body: note.body,
      author: note.createdBy?.name || "System",
      createdAt: note.createdAt.toISOString(),
    })),
    followUps: customer.followUps.map((followUp) => ({
      id: followUp.id,
      title: followUp.title,
      notes: followUp.notes,
      dueAt: followUp.dueAt.toISOString(),
      status: followUp.status,
      assignedTo: followUp.assignedTo?.user.name || null,
      assignedToMembershipId: followUp.assignedToMembershipId,
      completedAt: followUp.completedAt?.toISOString() || null,
    })),
    insights: {
      favoriteService,
      averageSpend: customer.totalVisits
        ? Math.round((asNumber(customer.totalSpent) / customer.totalVisits) * 100) / 100
        : 0,
      lastVisitAt: customer.lastVisitAt?.toISOString() || null,
    },
  };
}

async function assertPreferredStaff(context: TenantContext, membershipId: string | null | undefined) {
  if (!membershipId) return;
  const member = await prisma.membership.findFirst({
    where: { id: membershipId, salonId: context.salon.id, active: true },
  });
  if (!member) throw notFound("Preferred staff member not found");
}

export async function createCustomer(context: TenantContext, input: CustomerInput) {
  await assertPreferredStaff(context, input.preferredStaffMembershipId);
  const customer = await prisma.customer.create({
    data: {
      salonId: context.salon.id,
      firstName: input.firstName,
      lastName: input.lastName,
      phone: input.phone,
      email: input.email,
      notes: input.notes,
      preferences: input.preferences || null,
      tags: input.tags,
      birthday: dateOnlyOrNull(input.birthday),
      anniversary: dateOnlyOrNull(input.anniversary),
      preferredStaffMembershipId: input.preferredStaffMembershipId,
      marketingOptIn: input.marketingOptIn,
      source: input.source || null,
    },
  });
  await recordAudit({
    salonId: context.salon.id,
    actorUserId: context.user.id,
    action: "customer.created",
    entityType: "Customer",
    entityId: customer.id,
    metadata: { name: customer.firstName, tags: input.tags },
  });
  return customerDto(customer);
}

export async function updateCustomer(context: TenantContext, customerId: string, input: Partial<CustomerInput>) {
  const existing = await prisma.customer.findFirst({ where: { id: customerId, salonId: context.salon.id } });
  if (!existing) throw notFound("Customer not found");
  await assertPreferredStaff(context, input.preferredStaffMembershipId);
  const customer = await prisma.customer.update({
    where: { id: customerId },
    data: {
      ...(input.firstName !== undefined ? { firstName: input.firstName } : {}),
      ...(input.lastName !== undefined ? { lastName: input.lastName } : {}),
      ...(input.phone !== undefined ? { phone: input.phone } : {}),
      ...(input.email !== undefined ? { email: input.email } : {}),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
      ...(input.preferences !== undefined ? { preferences: input.preferences ?? null } : {}),
      ...(input.tags !== undefined ? { tags: input.tags } : {}),
      ...(input.birthday !== undefined ? { birthday: dateOnlyOrNull(input.birthday) } : {}),
      ...(input.anniversary !== undefined ? { anniversary: dateOnlyOrNull(input.anniversary) } : {}),
      ...(input.preferredStaffMembershipId !== undefined
        ? { preferredStaffMembershipId: input.preferredStaffMembershipId }
        : {}),
      ...(input.marketingOptIn !== undefined ? { marketingOptIn: input.marketingOptIn } : {}),
      ...(input.source !== undefined ? { source: input.source ?? null } : {}),
    },
  });
  await recordAudit({
    salonId: context.salon.id,
    actorUserId: context.user.id,
    action: "customer.updated",
    entityType: "Customer",
    entityId: customer.id,
    metadata: { name: customer.firstName },
  });
  return customerDto(customer);
}

export async function addCustomerNote(context: TenantContext, customerId: string, input: CustomerNoteInput) {
  const customer = await prisma.customer.findFirst({ where: { id: customerId, salonId: context.salon.id } });
  if (!customer) throw notFound("Customer not found");
  const note = await prisma.customerNote.create({
    data: { salonId: context.salon.id, customerId, body: input.body, createdById: context.user.id },
  });
  await recordAudit({
    salonId: context.salon.id,
    actorUserId: context.user.id,
    action: "customer.note_added",
    entityType: "Customer",
    entityId: customerId,
    metadata: { noteId: note.id },
  });
  return { id: note.id, createdAt: note.createdAt.toISOString() };
}

async function syncNextFollowUp(customerId: string) {
  const next = await prisma.customerFollowUp.findFirst({
    where: { customerId, status: "OPEN" },
    orderBy: { dueAt: "asc" },
    select: { dueAt: true },
  });
  await prisma.customer.update({
    where: { id: customerId },
    data: { nextFollowUpAt: next?.dueAt || null },
  });
}

export async function createFollowUp(context: TenantContext, customerId: string, input: FollowUpInput) {
  const customer = await prisma.customer.findFirst({ where: { id: customerId, salonId: context.salon.id } });
  if (!customer) throw notFound("Customer not found");
  if (input.assignedToMembershipId) {
    const member = await prisma.membership.findFirst({
      where: { id: input.assignedToMembershipId, salonId: context.salon.id, active: true },
    });
    if (!member) throw notFound("Assigned staff member not found");
  }
  const followUp = await prisma.customerFollowUp.create({
    data: {
      salonId: context.salon.id,
      customerId,
      title: input.title,
      notes: input.notes || null,
      dueAt: input.dueAt,
      assignedToMembershipId: input.assignedToMembershipId,
      createdById: context.user.id,
    },
  });
  await syncNextFollowUp(customerId);
  await recordAudit({
    salonId: context.salon.id,
    actorUserId: context.user.id,
    action: "customer.follow_up_created",
    entityType: "CustomerFollowUp",
    entityId: followUp.id,
    metadata: { customer: customer.firstName, dueAt: input.dueAt.toISOString() },
  });
  return { id: followUp.id };
}

export async function updateFollowUp(context: TenantContext, followUpId: string, input: FollowUpUpdate) {
  const existing = await prisma.customerFollowUp.findFirst({
    where: { id: followUpId, salonId: context.salon.id },
  });
  if (!existing) throw notFound("Follow-up not found");
  const completedAt = input.status === "DONE" ? new Date() : input.status === "OPEN" ? null : existing.completedAt;
  const followUp = await prisma.customerFollowUp.update({
    where: { id: followUpId },
    data: {
      ...(input.status !== undefined ? { status: input.status, completedAt } : {}),
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
      ...(input.dueAt !== undefined ? { dueAt: input.dueAt } : {}),
      ...(input.assignedToMembershipId !== undefined
        ? { assignedToMembershipId: input.assignedToMembershipId }
        : {}),
    },
  });
  await syncNextFollowUp(existing.customerId);
  await recordAudit({
    salonId: context.salon.id,
    actorUserId: context.user.id,
    action: input.status ? `customer.follow_up_${input.status.toLowerCase()}` : "customer.follow_up_updated",
    entityType: "CustomerFollowUp",
    entityId: followUpId,
    metadata: { customerId: existing.customerId },
  });
  return { id: followUp.id, status: followUp.status };
}

export async function deleteFollowUp(context: TenantContext, followUpId: string) {
  const existing = await prisma.customerFollowUp.findFirst({
    where: { id: followUpId, salonId: context.salon.id },
  });
  if (!existing) throw notFound("Follow-up not found");
  await prisma.customerFollowUp.delete({ where: { id: followUpId } });
  await syncNextFollowUp(existing.customerId);
  await recordAudit({
    salonId: context.salon.id,
    actorUserId: context.user.id,
    action: "customer.follow_up_deleted",
    entityType: "CustomerFollowUp",
    entityId: followUpId,
  });
  return { id: followUpId };
}

export async function listUpcomingFollowUps(context: TenantContext, limit = 8) {
  const rows = await prisma.customerFollowUp.findMany({
    where: { salonId: context.salon.id, status: "OPEN" },
    include: {
      customer: { select: { id: true, firstName: true, lastName: true, phone: true } },
      assignedTo: { include: { user: { select: { name: true } } } },
    },
    orderBy: { dueAt: "asc" },
    take: limit,
  });
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    dueAt: row.dueAt.toISOString(),
    overdue: row.dueAt < new Date(),
    customer: {
      id: row.customer.id,
      name: `${row.customer.firstName} ${row.customer.lastName}`.trim(),
      phone: row.customer.phone,
    },
    assignedTo: row.assignedTo?.user.name || null,
  }));
}
