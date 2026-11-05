import "server-only";
import type { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { TenantContext } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { badRequest, conflict, notFound } from "@/lib/errors";
import { parseSalonSettings } from "@/lib/settings";
import { startOfDay } from "@/lib/utils";
import type { queueInput, queueUpdate } from "@/lib/validation";

type QueueInput = z.infer<typeof queueInput>;
type QueueUpdate = z.infer<typeof queueUpdate>;

export async function listQueue(context: TenantContext, branchId?: string | null) {
  const items = await prisma.queueTicket.findMany({
    where: {
      salonId: context.salon.id,
      ...(branchId ? { branchId } : {}),
      status: { in: ["WAITING", "CALLED", "SERVING"] },
    },
    include: {
      customer: { select: { id: true, firstName: true, lastName: true, phone: true } },
      service: { select: { name: true } },
      staff: { include: { user: { select: { name: true } } } },
      branch: { select: { name: true } },
    },
    orderBy: [{ status: "asc" }, { createdAt: "asc" }],
  });
  return items.map((item) => ({
    id: item.id,
    queueNumber: item.queueNumber,
    name: item.customer ? `${item.customer.firstName} ${item.customer.lastName}`.trim() : item.name,
    phone: item.customer?.phone || item.phone,
    customerId: item.customerId,
    service: item.service?.name || null,
    staff: item.staff?.user.name || null,
    branch: item.branch.name,
    status: item.status,
    notes: item.notes,
    createdAt: item.createdAt.toISOString(),
  }));
}

export async function addToQueue(context: TenantContext, input: QueueInput) {
  if (!parseSalonSettings(context.salon.settings).allowWalkIns) throw badRequest("Walk-ins are disabled for this salon");
  const branch = await prisma.branch.findFirst({
    where: { id: input.branchId, salonId: context.salon.id, active: true },
  });
  if (!branch) throw badRequest("Branch not found or inactive");
  if (input.customerId) {
    const customer = await prisma.customer.findFirst({ where: { id: input.customerId, salonId: context.salon.id } });
    if (!customer) throw badRequest("Customer not found");
  }
  if (input.serviceId) {
    const service = await prisma.service.findFirst({
      where: { id: input.serviceId, salonId: context.salon.id, active: true },
    });
    if (!service) throw badRequest("Service not found");
  }
  if (input.staffMembershipId) {
    const staff = await prisma.membership.findFirst({
      where: { id: input.staffMembershipId, salonId: context.salon.id, active: true },
    });
    if (!staff) throw badRequest("Staff member not found");
  }
  const ticket = await prisma.$transaction(async (tx) => {
    const day = startOfDay().toISOString().slice(0, 10);
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`queue:${context.salon.id}:${branch.id}:${day}`}))`;
    const last = await tx.queueTicket.findFirst({
      where: {
        salonId: context.salon.id,
        branchId: branch.id,
        createdAt: { gte: startOfDay() },
      },
      orderBy: { queueNumber: "desc" },
      select: { queueNumber: true },
    });
    return tx.queueTicket.create({
      data: {
        salonId: context.salon.id,
        branchId: branch.id,
        customerId: input.customerId,
        serviceId: input.serviceId,
        staffMembershipId: input.staffMembershipId,
        name: input.name,
        phone: input.phone || null,
        notes: input.notes,
        queueNumber: (last?.queueNumber || 0) + 1,
      },
    });
  });
  await recordAudit({
    salonId: context.salon.id,
    actorUserId: context.user.id,
    action: "queue.added",
    entityType: "QueueTicket",
    entityId: ticket.id,
    metadata: { queueNumber: ticket.queueNumber },
  });
  return { ...ticket, createdAt: ticket.createdAt.toISOString() };
}

export async function updateQueueTicket(context: TenantContext, id: string, input: QueueUpdate) {
  const ticket = await prisma.queueTicket.findFirst({ where: { id, salonId: context.salon.id } });
  if (!ticket) throw notFound("Queue ticket not found");
  if (ticket.status === "DONE" || ticket.status === "CANCELLED") throw conflict("This queue ticket is closed");
  const updated = await prisma.queueTicket.update({ where: { id }, data: { status: input.status } });
  await recordAudit({
    salonId: context.salon.id,
    actorUserId: context.user.id,
    action: `queue.${input.status.toLowerCase()}`,
    entityType: "QueueTicket",
    entityId: id,
  });
  return { ...updated, createdAt: updated.createdAt.toISOString() };
}
