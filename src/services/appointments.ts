import "server-only";
import { AppointmentStatus, Prisma, type Appointment } from "@prisma/client";
import type { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { TenantContext } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { badRequest, conflict, notFound } from "@/lib/errors";
import { asNumber } from "@/lib/utils";
import type { appointmentInput, appointmentUpdate } from "@/lib/validation";

type AppointmentInput = z.infer<typeof appointmentInput>;
type AppointmentUpdate = z.infer<typeof appointmentUpdate>;

const includeAppointment = {
  customer: { select: { id: true, firstName: true, lastName: true, phone: true, email: true } },
  service: { select: { id: true, name: true, price: true, durationMin: true } },
  staff: { select: { id: true, user: { select: { name: true } } } },
  branch: { select: { id: true, name: true } },
} satisfies Prisma.AppointmentInclude;

type AppointmentWithRelations = Prisma.AppointmentGetPayload<{ include: typeof includeAppointment }>;

export function appointmentDto(appointment: AppointmentWithRelations) {
  return {
    id: appointment.id,
    customer: {
      id: appointment.customer.id,
      name: `${appointment.customer.firstName} ${appointment.customer.lastName}`.trim(),
      phone: appointment.customer.phone,
      email: appointment.customer.email,
    },
    service: {
      id: appointment.service.id,
      name: appointment.service.name,
      price: asNumber(appointment.service.price),
      durationMin: appointment.service.durationMin,
    },
    staff: { id: appointment.staff.id, name: appointment.staff.user.name },
    branch: appointment.branch,
    startAt: appointment.startAt.toISOString(),
    endAt: appointment.endAt.toISOString(),
    status: appointment.status,
    notes: appointment.notes,
    walkIn: appointment.walkIn,
    createdAt: appointment.createdAt.toISOString(),
  };
}

function staffScope(context: TenantContext): Prisma.AppointmentWhereInput {
  return context.role === "STAFF" ? { staffMembershipId: context.membership.id } : {};
}

async function assertStaffAccess(context: TenantContext, appointment: Appointment) {
  if (context.role === "STAFF" && appointment.staffMembershipId !== context.membership.id) {
    throw notFound("Appointment not found");
  }
  return appointment;
}

export async function listAppointments(
  context: TenantContext,
  input: { from?: Date; to?: Date; status?: AppointmentStatus; page: number; pageSize: number; q?: string },
) {
  const where: Prisma.AppointmentWhereInput = {
    salonId: context.salon.id,
    ...staffScope(context),
    ...(input.from || input.to
      ? { startAt: { ...(input.from ? { gte: input.from } : {}), ...(input.to ? { lte: input.to } : {}) } }
      : {}),
    ...(input.status ? { status: input.status } : {}),
    ...(input.q
      ? {
          OR: [
            { customer: { firstName: { contains: input.q, mode: "insensitive" } } },
            { customer: { lastName: { contains: input.q, mode: "insensitive" } } },
            { customer: { phone: { contains: input.q } } },
            { service: { name: { contains: input.q, mode: "insensitive" } } },
          ],
        }
      : {}),
  };
  const [items, total] = await prisma.$transaction([
    prisma.appointment.findMany({
      where,
      include: includeAppointment,
      orderBy: { startAt: "asc" },
      skip: (input.page - 1) * input.pageSize,
      take: input.pageSize,
    }),
    prisma.appointment.count({ where }),
  ]);
  return { items: items.map(appointmentDto), total, pages: Math.ceil(total / input.pageSize) };
}

export async function getAppointment(context: TenantContext, id: string) {
  const appointment = await prisma.appointment.findFirst({
    where: { id, salonId: context.salon.id },
    include: includeAppointment,
  });
  if (!appointment) return null;
  if (context.role === "STAFF" && appointment.staffMembershipId !== context.membership.id) return null;
  return appointmentDto(appointment);
}

async function validateBookingRefs(
  context: TenantContext,
  input: { branchId: string; serviceId: string; staffMembershipId?: string; customerId?: string },
  staffMembershipId: string,
) {
  const [branch, service, staff, customer] = await Promise.all([
    prisma.branch.findFirst({ where: { id: input.branchId, salonId: context.salon.id, active: true } }),
    prisma.service.findFirst({ where: { id: input.serviceId, salonId: context.salon.id, active: true } }),
    prisma.membership.findFirst({
      where: { id: staffMembershipId, salonId: context.salon.id, active: true },
      include: { user: { select: { name: true } } },
    }),
    input.customerId
      ? prisma.customer.findFirst({ where: { id: input.customerId, salonId: context.salon.id } })
      : Promise.resolve(true),
  ]);
  if (!branch) throw badRequest("Branch not found or inactive");
  if (!service) throw badRequest("Service not found or inactive");
  if (!staff) throw badRequest("Staff member not found or inactive");
  if (staff.branchId && staff.branchId !== branch.id) throw badRequest("Staff member is not assigned to this branch");
  if (!customer) throw badRequest("Customer not found");
  if (context.role === "STAFF" && staff.id !== context.membership.id) {
    throw badRequest("Staff can only book appointments with themselves");
  }
  return { branch, service, staff };
}

export async function createAppointment(context: TenantContext, input: AppointmentInput) {
  const { branch, service, staff } = await validateBookingRefs(context, input, input.staffMembershipId);
  const endAt = new Date(input.startAt.getTime() + service.durationMin * 60000);
  if (endAt <= input.startAt) throw badRequest("Invalid appointment time");
  const overlap = await prisma.appointment.findFirst({
    where: {
      salonId: context.salon.id,
      staffMembershipId: staff.id,
      status: { in: ["SCHEDULED", "CONFIRMED", "CHECKED_IN", "IN_PROGRESS"] },
      startAt: { lt: endAt },
      endAt: { gt: input.startAt },
    },
  });
  if (overlap) throw conflict("This staff member already has an overlapping appointment");
  let appointment: AppointmentWithRelations;
  try {
    appointment = await prisma.appointment.create({
      data: {
        salonId: context.salon.id,
        branchId: branch.id,
        customerId: input.customerId,
        staffMembershipId: staff.id,
        serviceId: service.id,
        startAt: input.startAt,
        endAt,
        notes: input.notes,
        walkIn: input.walkIn,
        createdById: context.user.id,
      },
      include: includeAppointment,
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.message.includes("appointment_overlap")) {
      throw conflict("This staff member already has an overlapping appointment");
    }
    throw error;
  }
  await recordAudit({
    salonId: context.salon.id,
    actorUserId: context.user.id,
    action: "appointment.created",
    entityType: "Appointment",
    entityId: appointment.id,
    metadata: { startAt: appointment.startAt.toISOString(), staff: staff.user.name },
  });
  return appointmentDto(appointment);
}

export async function updateAppointment(context: TenantContext, id: string, input: AppointmentUpdate) {
  const existing = await prisma.appointment.findFirst({
    where: { id, salonId: context.salon.id },
    include: { service: true },
  });
  if (!existing) throw notFound("Appointment not found");
  await assertStaffAccess(context, existing);
  if (input.status && input.status !== existing.status) {
    const allowed: Record<AppointmentStatus, AppointmentStatus[]> = {
      SCHEDULED: ["CONFIRMED", "CHECKED_IN", "CANCELLED", "NO_SHOW"],
      CONFIRMED: ["CHECKED_IN", "IN_PROGRESS", "CANCELLED", "NO_SHOW"],
      CHECKED_IN: ["IN_PROGRESS", "COMPLETED", "CANCELLED"],
      IN_PROGRESS: ["COMPLETED", "CANCELLED"],
      COMPLETED: [],
      CANCELLED: [],
      NO_SHOW: [],
    };
    if (!allowed[existing.status].includes(input.status)) {
      throw badRequest(`Cannot change appointment from ${existing.status} to ${input.status}`);
    }
  }
  if (input.status === "COMPLETED") {
    return completeAppointment(context, existing);
  }
  let staffMembershipId = existing.staffMembershipId;
  let serviceId = existing.serviceId;
  const startAt = input.startAt || existing.startAt;
  if (input.staffMembershipId || input.serviceId || input.startAt) {
    const refs = await validateBookingRefs(
      context,
      {
        branchId: existing.branchId,
        serviceId: input.serviceId || existing.serviceId,
        staffMembershipId: input.staffMembershipId || existing.staffMembershipId,
        customerId: existing.customerId,
      },
      input.staffMembershipId || existing.staffMembershipId,
    );
    staffMembershipId = refs.staff.id;
    serviceId = refs.service.id;
    const endAt = new Date(startAt.getTime() + refs.service.durationMin * 60000);
    const overlap = await prisma.appointment.findFirst({
      where: {
        id: { not: id },
        salonId: context.salon.id,
        staffMembershipId,
        status: { in: ["SCHEDULED", "CONFIRMED", "CHECKED_IN", "IN_PROGRESS"] },
        startAt: { lt: endAt },
        endAt: { gt: startAt },
      },
    });
    if (overlap) throw conflict("This staff member already has an overlapping appointment");
    const appointment = await prisma.appointment.update({
      where: { id },
      data: {
        staffMembershipId,
        serviceId,
        startAt,
        endAt,
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
      },
      include: includeAppointment,
    });
    await auditUpdate(context, appointment, input);
    return appointmentDto(appointment);
  }
  const appointment = await prisma.appointment.update({
    where: { id },
    data: {
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
      ...(input.status === "CHECKED_IN" && !existing.checkedInAt ? { checkedInAt: new Date() } : {}),
    },
    include: includeAppointment,
  });
  await auditUpdate(context, appointment, input);
  return appointmentDto(appointment);
}

async function auditUpdate(context: TenantContext, appointment: AppointmentWithRelations, input: AppointmentUpdate) {
  await recordAudit({
    salonId: context.salon.id,
    actorUserId: context.user.id,
    action: input.status ? `appointment.${input.status.toLowerCase()}` : "appointment.updated",
    entityType: "Appointment",
    entityId: appointment.id,
  });
}

async function completeAppointment(context: TenantContext, existing: Appointment & { service: { id: string } }) {
  if (existing.status === "COMPLETED") {
    const completed = await prisma.appointment.findFirstOrThrow({
      where: { id: existing.id, salonId: context.salon.id },
      include: includeAppointment,
    });
    return appointmentDto(completed);
  }
  if (["CANCELLED", "NO_SHOW"].includes(existing.status)) {
    throw badRequest("A cancelled or no-show appointment cannot be completed");
  }
  const usage = await prisma.serviceProduct.findMany({
    where: { serviceId: existing.serviceId },
    include: { product: { select: { id: true, name: true, stockQty: true } } },
  });
  await prisma.$transaction(async (tx) => {
    const claimed = await tx.appointment.updateMany({
      where: { id: existing.id, salonId: context.salon.id, status: { not: "COMPLETED" } },
      data: { status: "COMPLETED", completedAt: new Date() },
    });
    if (claimed.count === 0) return;
    for (const item of usage) {
      const changed = await tx.product.updateMany({
        where: { id: item.productId, salonId: context.salon.id, stockQty: { gte: item.quantity } },
        data: { stockQty: { decrement: item.quantity } },
      });
      if (changed.count === 0) throw conflict(`Insufficient stock for ${item.product.name}. Adjust stock and retry.`);
      const product = await tx.product.findUniqueOrThrow({ where: { id: item.productId } });
      await tx.stockMovement.create({
        data: {
          salonId: context.salon.id,
          productId: item.productId,
          type: "USAGE",
          quantity: -item.quantity,
          resultingBalance: product.stockQty,
          reference: `appointment:${existing.id}`,
          notes: "Service completion usage",
          createdById: context.user.id,
        },
      });
    }
    if (existing.customerId) {
      await tx.customer.update({
        where: { id: existing.customerId },
        data: { totalVisits: { increment: 1 }, lastVisitAt: new Date() },
      });
    }
  });
  const appointment = await prisma.appointment.findFirstOrThrow({
    where: { id: existing.id, salonId: context.salon.id },
    include: includeAppointment,
  });
  await recordAudit({
    salonId: context.salon.id,
    actorUserId: context.user.id,
    action: "appointment.completed",
    entityType: "Appointment",
    entityId: appointment.id,
  });
  return appointmentDto(appointment);
}

export async function todayAppointments(context: TenantContext, from: Date, to: Date) {
  const items = await prisma.appointment.findMany({
    where: {
      salonId: context.salon.id,
      ...staffScope(context),
      startAt: { gte: from, lte: to },
      status: { notIn: ["CANCELLED", "NO_SHOW"] },
    },
    include: includeAppointment,
    orderBy: { startAt: "asc" },
  });
  return items.map(appointmentDto);
}
