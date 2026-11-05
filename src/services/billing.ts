import "server-only";
import { InvoiceStatus, Prisma, type PaymentKind, type PaymentMethod } from "@prisma/client";
import type { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { TenantContext } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { badRequest, conflict, notFound } from "@/lib/errors";
import { calculateInvoice } from "@/lib/invoice-calc";
import { parseSalonSettings } from "@/lib/settings";
import { asNumber, roundMoney } from "@/lib/utils";
import type { invoiceInput, paymentInput, refundInput } from "@/lib/validation";

type InvoiceInput = z.infer<typeof invoiceInput>;
type PaymentInput = z.infer<typeof paymentInput>;
type RefundInput = z.infer<typeof refundInput>;

const invoiceInclude = {
  customer: { select: { id: true, firstName: true, lastName: true, phone: true, email: true } },
  branch: { select: { id: true, name: true } },
  items: {
    include: { staff: { select: { id: true, user: { select: { name: true } } } } },
    orderBy: { id: "asc" },
  },
  payments: { orderBy: { createdAt: "asc" } },
} satisfies Prisma.InvoiceInclude;

type InvoiceFull = Prisma.InvoiceGetPayload<{ include: typeof invoiceInclude }>;

function invoiceDto(invoice: InvoiceFull) {
  const netPaid = roundMoney(asNumber(invoice.amountPaid) - asNumber(invoice.amountRefunded));
  return {
    id: invoice.id,
    number: invoice.number,
    status: invoice.status,
    customer: invoice.customer
      ? {
          id: invoice.customer.id,
          name: `${invoice.customer.firstName} ${invoice.customer.lastName}`.trim(),
          phone: invoice.customer.phone,
          email: invoice.customer.email,
        }
      : null,
    branch: invoice.branch,
    subtotal: asNumber(invoice.subtotal),
    discount: asNumber(invoice.discount),
    taxTotal: asNumber(invoice.taxTotal),
    total: asNumber(invoice.total),
    amountPaid: asNumber(invoice.amountPaid),
    amountRefunded: asNumber(invoice.amountRefunded),
    netPaid,
    balance: roundMoney(asNumber(invoice.total) - netPaid),
    commissionTotal: asNumber(invoice.commissionTotal),
    notes: invoice.notes,
    issuedAt: invoice.issuedAt?.toISOString() || null,
    dueAt: invoice.dueAt?.toISOString() || null,
    createdAt: invoice.createdAt.toISOString(),
    items: invoice.items.map((item) => ({
      id: item.id,
      kind: item.kind,
      description: item.description,
      quantity: asNumber(item.quantity),
      unitPrice: asNumber(item.unitPrice),
      taxRate: asNumber(item.taxRate),
      taxAmount: asNumber(item.taxAmount),
      discountAmount: asNumber(item.discountAmount),
      lineTotal: asNumber(item.lineTotal),
      staff: item.staff ? { id: item.staff.id, name: item.staff.user.name } : null,
    })),
    payments: invoice.payments.map((payment) => ({
      id: payment.id,
      amount: asNumber(payment.amount),
      method: payment.method,
      kind: payment.kind,
      reference: payment.reference,
      notes: payment.notes,
      createdAt: payment.createdAt.toISOString(),
    })),
  };
}

export function statusForAmounts(total: number, paid: number, refunded: number, current: InvoiceStatus): InvoiceStatus {
  if (current === InvoiceStatus.VOID || current === InvoiceStatus.DRAFT) return current;
  const net = roundMoney(paid - refunded);
  if (net >= total) return InvoiceStatus.PAID;
  if (net <= 0 && refunded > 0) return InvoiceStatus.REFUNDED;
  if (net > 0) return InvoiceStatus.PARTIAL;
  return InvoiceStatus.ISSUED;
}

export async function listInvoices(
  context: TenantContext,
  input: { q?: string; status?: InvoiceStatus; page: number; pageSize: number },
) {
  const where: Prisma.InvoiceWhereInput = {
    salonId: context.salon.id,
    ...(input.status ? { status: input.status } : {}),
    ...(input.q
      ? {
          OR: [
            { number: { contains: input.q, mode: "insensitive" } },
            { customer: { firstName: { contains: input.q, mode: "insensitive" } } },
            { customer: { lastName: { contains: input.q, mode: "insensitive" } } },
            { customer: { phone: { contains: input.q } } },
          ],
        }
      : {}),
  };
  const [items, total] = await prisma.$transaction([
    prisma.invoice.findMany({
      where,
      include: {
        customer: { select: { firstName: true, lastName: true, phone: true } },
        branch: { select: { name: true } },
        _count: { select: { items: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (input.page - 1) * input.pageSize,
      take: input.pageSize,
    }),
    prisma.invoice.count({ where }),
  ]);
  return {
    items: items.map((invoice) => ({
      id: invoice.id,
      number: invoice.number,
      status: invoice.status,
      customerName: invoice.customer
        ? `${invoice.customer.firstName} ${invoice.customer.lastName}`.trim()
        : "Walk-in",
      customerPhone: invoice.customer?.phone || null,
      branch: invoice.branch.name,
      total: asNumber(invoice.total),
      amountPaid: asNumber(invoice.amountPaid),
      amountRefunded: asNumber(invoice.amountRefunded),
      createdAt: invoice.createdAt.toISOString(),
      itemCount: invoice._count.items,
    })),
    total,
    pages: Math.ceil(total / input.pageSize),
  };
}

export async function getInvoice(context: TenantContext, id: string) {
  const invoice = await prisma.invoice.findFirst({
    where: { id, salonId: context.salon.id },
    include: invoiceInclude,
  });
  if (!invoice) return null;
  return invoiceDto(invoice);
}

export async function createInvoice(context: TenantContext, input: InvoiceInput) {
  if (input.idempotencyKey) {
    const existing = await prisma.invoice.findFirst({
      where: { salonId: context.salon.id, idempotencyKey: input.idempotencyKey },
      include: invoiceInclude,
    });
    if (existing) return invoiceDto(existing);
  }
  const [customer, branch] = await Promise.all([
    input.customerId
      ? prisma.customer.findFirst({ where: { id: input.customerId, salonId: context.salon.id } })
      : Promise.resolve(null),
    prisma.branch.findFirst({ where: { id: input.branchId, salonId: context.salon.id, active: true } }),
  ]);
  if (input.customerId && !customer) throw badRequest("Customer not found");
  if (!branch) throw badRequest("Branch not found");
  if (input.appointmentId) {
    const appointment = await prisma.appointment.findFirst({
      where: {
        id: input.appointmentId,
        salonId: context.salon.id,
        ...(customer ? { customerId: customer.id } : {}),
      },
    });
    if (!appointment) throw badRequest("Appointment not found for this customer");
  }
  const serviceIds = [...new Set(input.items.filter((i) => i.kind === "SERVICE" && i.serviceId).map((i) => i.serviceId!))];
  const productIds = [...new Set(input.items.filter((i) => i.kind === "PRODUCT" && i.productId).map((i) => i.productId!))];
  const staffIds = [...new Set(input.items.map((i) => i.staffMembershipId).filter((v): v is string => Boolean(v)))];
  const [services, products, staff] = await Promise.all([
    prisma.service.findMany({
      where: { id: { in: serviceIds }, salonId: context.salon.id, active: true },
      include: { taxRate: true },
    }),
    prisma.product.findMany({
      where: { id: { in: productIds }, salonId: context.salon.id, active: true },
      include: { taxRate: true },
    }),
    prisma.membership.findMany({
      where: { id: { in: staffIds }, salonId: context.salon.id, active: true },
      include: { staffProfile: { select: { commissionRate: true } } },
    }),
  ]);
  const serviceMap = new Map(services.map((s) => [s.id, s]));
  const productMap = new Map(products.map((p) => [p.id, p]));
  const staffMap = new Map(staff.map((s) => [s.id, s]));
  const lineInputs = input.items.map((item) => {
    if (item.kind === "SERVICE") {
      if (!item.serviceId) throw badRequest("A service is required for each service line");
      const service = serviceMap.get(item.serviceId);
      if (!service) throw badRequest("Service not found or inactive");
      if (item.staffMembershipId && !staffMap.has(item.staffMembershipId)) throw badRequest("Staff member not found");
      const commissionRate =
        service.commissionRate !== null
          ? asNumber(service.commissionRate)
          : item.staffMembershipId
            ? asNumber(staffMap.get(item.staffMembershipId)?.staffProfile?.commissionRate)
            : 0;
      return {
        kind: "SERVICE",
        description: service.name,
        quantity: item.quantity,
        unitPrice: asNumber(service.price),
        taxRate: asNumber(service.taxRate?.rate),
        commissionRate,
        serviceId: service.id,
        productId: null,
        staffMembershipId: item.staffMembershipId,
      };
    }
    if (!item.productId) throw badRequest("A product is required for each product line");
    const product = productMap.get(item.productId);
    if (!product) throw badRequest("Product not found or inactive");
    if (!Number.isInteger(item.quantity)) throw badRequest("Product quantities must be whole numbers");
    return {
      kind: "PRODUCT",
      description: product.name,
      quantity: item.quantity,
      unitPrice: asNumber(product.price),
      taxRate: asNumber(product.taxRate?.rate),
      commissionRate: 0,
      serviceId: null,
      productId: product.id,
      staffMembershipId: item.staffMembershipId,
    };
  });
  const totals = calculateInvoice(lineInputs, input.discount);
  const checkoutPaid = roundMoney(input.payments.reduce((sum, payment) => sum + roundMoney(payment.amount), 0));
  if (checkoutPaid > totals.total + 0.001) {
    throw badRequest(`Payments (${checkoutPaid.toFixed(2)}) are more than the bill total (${totals.total.toFixed(2)})`);
  }
  const settings = parseSalonSettings(context.salon.settings);
  const counts = new Map<string, number>();
  for (const line of lineInputs) {
    if (line.productId) counts.set(line.productId, (counts.get(line.productId) || 0) + line.quantity);
  }
  let duplicate = false;
  const invoice = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`invoice:${context.salon.id}`}))`;
    if (input.idempotencyKey) {
      const already = await tx.invoice.findFirst({
        where: { salonId: context.salon.id, idempotencyKey: input.idempotencyKey },
        include: invoiceInclude,
      });
      if (already) {
        duplicate = true;
        return already;
      }
    }
    const sequence = await tx.invoice.count({ where: { salonId: context.salon.id } });
    const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const number = `INV-${datePart}-${String(sequence + 1).padStart(4, "0")}`;
    for (const [productId, quantity] of counts) {
      const changed = await tx.product.updateMany({
        where: { id: productId, salonId: context.salon.id, stockQty: { gte: quantity } },
        data: { stockQty: { decrement: quantity } },
      });
      if (changed.count === 0) throw conflict("One or more products have insufficient stock");
    }
    const created = await tx.invoice.create({
      data: {
        salonId: context.salon.id,
        branchId: branch.id,
        customerId: customer?.id ?? null,
        appointmentId: input.appointmentId,
        idempotencyKey: input.idempotencyKey || null,
        number,
        status: InvoiceStatus.ISSUED,
        subtotal: totals.subtotal,
        discount: totals.discount,
        taxTotal: totals.taxTotal,
        total: totals.total,
        commissionTotal: totals.commissionTotal,
        notes: input.notes,
        issuedAt: new Date(),
        dueAt: new Date(Date.now() + settings.invoiceDueDays * 86400000),
        createdById: context.user.id,
        items: {
          create: totals.lines.map((line) => ({
            kind: line.kind,
            description: line.description,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            taxRate: line.taxRate,
            taxAmount: line.taxAmount,
            discountAmount: line.discountAmount,
            lineTotal: line.lineTotal,
            serviceId: line.serviceId,
            productId: line.productId,
            staffMembershipId: line.staffMembershipId,
            commissionAmount: line.commissionAmount,
          })),
        },
      },
      include: invoiceInclude,
    });
    for (const [productId, quantity] of counts) {
      const product = await tx.product.findUniqueOrThrow({ where: { id: productId } });
      await tx.stockMovement.create({
        data: {
          salonId: context.salon.id,
          productId,
          type: "SALE",
          quantity: -quantity,
          resultingBalance: product.stockQty,
          reference: `invoice:${number}`,
          createdById: context.user.id,
        },
      });
    }
    if (checkoutPaid > 0) {
      for (const payment of input.payments) {
        await tx.payment.create({
          data: {
            invoiceId: created.id,
            amount: roundMoney(payment.amount),
            method: payment.method,
            kind: "PAYMENT",
            reference: payment.reference || null,
            receivedById: context.user.id,
          },
        });
      }
      const status = statusForAmounts(totals.total, checkoutPaid, 0, InvoiceStatus.ISSUED);
      const awardLoyalty = status === InvoiceStatus.PAID && Boolean(customer);
      await tx.invoice.update({
        where: { id: created.id },
        data: {
          amountPaid: checkoutPaid,
          status,
          ...(awardLoyalty ? { loyaltyAwardedAt: new Date() } : {}),
        },
      });
      if (customer) {
        await tx.customer.update({ where: { id: customer.id }, data: { totalSpent: { increment: checkoutPaid } } });
        const points = awardLoyalty ? Math.floor(totals.total * settings.loyaltyPointsPerCurrency) : 0;
        if (points > 0) {
          await tx.customer.update({ where: { id: customer.id }, data: { loyaltyPoints: { increment: points } } });
        }
      }
    }
    return tx.invoice.findUniqueOrThrow({ where: { id: created.id }, include: invoiceInclude });
  });
  if (duplicate) return invoiceDto(invoice);
  await recordAudit({
    salonId: context.salon.id,
    actorUserId: context.user.id,
    action: "invoice.created",
    entityType: "Invoice",
    entityId: invoice.id,
    metadata: { number: invoice.number, total: totals.total, paidAtCheckout: checkoutPaid },
  });
  return invoiceDto(invoice);
}

export async function addPayment(context: TenantContext, invoiceId: string, input: PaymentInput) {
  const payment = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`invoice:${invoiceId}`}))`;
    const invoice = await tx.invoice.findFirst({
      where: { id: invoiceId, salonId: context.salon.id },
      include: { customer: true },
    });
    if (!invoice) throw notFound("Invoice not found");
    if (invoice.status === InvoiceStatus.VOID) throw conflict("Void invoices cannot receive payments");
    const amount = roundMoney(input.amount);
    const netPaid = roundMoney(asNumber(invoice.amountPaid) - asNumber(invoice.amountRefunded));
    const balance = roundMoney(asNumber(invoice.total) - netPaid);
    if (amount <= 0) throw badRequest("Payment amount must be positive");
    if (amount > balance + 0.001) throw badRequest(`Payment exceeds the outstanding balance of ${balance.toFixed(2)}`);
    const newPaid = roundMoney(asNumber(invoice.amountPaid) + amount);
    const newStatus = statusForAmounts(asNumber(invoice.total), newPaid, asNumber(invoice.amountRefunded), invoice.status);
    const paid = await tx.payment.create({
      data: {
        invoiceId: invoice.id,
        amount,
        method: input.method,
        kind: "PAYMENT",
        reference: input.reference,
        notes: input.notes,
        receivedById: context.user.id,
      },
    });
    await tx.invoice.update({
      where: { id: invoice.id },
      data: {
        amountPaid: { increment: amount },
        status: newStatus,
        ...(newStatus === InvoiceStatus.PAID && !invoice.loyaltyAwardedAt ? { loyaltyAwardedAt: new Date() } : {}),
      },
    });
    if (invoice.customerId) {
      await tx.customer.update({
        where: { id: invoice.customerId },
        data: { totalSpent: { increment: amount } },
      });
      if (newStatus === InvoiceStatus.PAID && !invoice.loyaltyAwardedAt) {
        const settings = parseSalonSettings(context.salon.settings);
        const points = Math.floor(asNumber(invoice.total) * settings.loyaltyPointsPerCurrency);
        if (points > 0) {
          await tx.customer.update({
            where: { id: invoice.customerId },
            data: { loyaltyPoints: { increment: points } },
          });
        }
      }
    }
    return { payment: paid, invoiceId: invoice.id, status: newStatus };
  });
  await recordAudit({
    salonId: context.salon.id,
    actorUserId: context.user.id,
    action: "payment.recorded",
    entityType: "Invoice",
    entityId: invoiceId,
    metadata: { amount: input.amount, method: input.method },
  });
  return { ...payment.payment, amount: asNumber(payment.payment.amount), status: payment.status, createdAt: payment.payment.createdAt.toISOString() };
}

export async function refundInvoice(context: TenantContext, invoiceId: string, input: RefundInput) {
  const result = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`invoice:${invoiceId}`}))`;
    const invoice = await tx.invoice.findFirst({
      where: { id: invoiceId, salonId: context.salon.id },
      include: { customer: { select: { id: true, loyaltyPoints: true } } },
    });
    if (!invoice) throw notFound("Invoice not found");
    if (invoice.status === InvoiceStatus.VOID) throw conflict("Void invoices cannot be refunded");
    const amount = roundMoney(input.amount);
    const refundable = roundMoney(asNumber(invoice.amountPaid) - asNumber(invoice.amountRefunded));
    if (amount > refundable + 0.001) throw badRequest(`Refund exceeds the refundable amount of ${refundable.toFixed(2)}`);
    const newRefunded = roundMoney(asNumber(invoice.amountRefunded) + amount);
    const newStatus = statusForAmounts(asNumber(invoice.total), asNumber(invoice.amountPaid), newRefunded, invoice.status);
    if (input.restockProducts) {
      if (newStatus !== InvoiceStatus.REFUNDED) {
        throw badRequest("Products can be put back in stock only when the whole bill is refunded");
      }
      const productLines = await tx.invoiceLine.findMany({
        where: { invoiceId: invoice.id, productId: { not: null } },
      });
      for (const line of productLines) {
        if (!line.productId) continue;
        const product = await tx.product.update({
          where: { id: line.productId },
          data: { stockQty: { increment: Math.round(Number(line.quantity)) } },
        });
        await tx.stockMovement.create({
          data: {
            salonId: context.salon.id,
            productId: line.productId,
            type: "RETURN",
            quantity: Math.round(Number(line.quantity)),
            resultingBalance: product.stockQty,
            reference: `refund:${invoice.number}`,
            createdById: context.user.id,
          },
        });
      }
    }
    await tx.payment.create({
      data: {
        invoiceId: invoice.id,
        amount,
        method: input.method,
        kind: "REFUND",
        notes: input.reason,
        receivedById: context.user.id,
      },
    });
    await tx.invoice.update({
      where: { id: invoice.id },
      data: {
        amountRefunded: { increment: amount },
        status: newStatus,
        ...(newStatus !== InvoiceStatus.PAID && invoice.loyaltyAwardedAt ? { loyaltyAwardedAt: null } : {}),
      },
    });
    if (invoice.customerId) {
      await tx.customer.update({
        where: { id: invoice.customerId },
        data: { totalSpent: { decrement: amount } },
      });
      if (newStatus !== InvoiceStatus.PAID && invoice.loyaltyAwardedAt && invoice.customer) {
        const settings = parseSalonSettings(context.salon.settings);
        const points = Math.floor(asNumber(invoice.total) * settings.loyaltyPointsPerCurrency);
        await tx.customer.update({
          where: { id: invoice.customerId },
          data: { loyaltyPoints: Math.max(0, invoice.customer.loyaltyPoints - points) },
        });
      }
    }
    return { status: newStatus, amount };
  });
  await recordAudit({
    salonId: context.salon.id,
    actorUserId: context.user.id,
    action: "payment.refunded",
    entityType: "Invoice",
    entityId: invoiceId,
    metadata: { amount: result.amount, method: input.method, reason: input.reason },
  });
  return result;
}

export async function voidInvoice(context: TenantContext, invoiceId: string) {
  const invoice = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`invoice:${invoiceId}`}))`;
    const current = await tx.invoice.findFirst({
      where: { id: invoiceId, salonId: context.salon.id },
      include: invoiceInclude,
    });
    if (!current) throw notFound("Invoice not found");
    if (current.status === InvoiceStatus.VOID) return current;
    if (asNumber(current.amountPaid) > 0) throw badRequest("Invoices with payments cannot be voided; use a refund");
    for (const line of current.items) {
      if (line.productId) {
        const product = await tx.product.update({
          where: { id: line.productId },
          data: { stockQty: { increment: Number(line.quantity) } },
        });
        await tx.stockMovement.create({
          data: {
            salonId: context.salon.id,
            productId: line.productId,
            type: "RETURN",
            quantity: Number(line.quantity),
            resultingBalance: product.stockQty,
            reference: `void:${current.number}`,
            createdById: context.user.id,
          },
        });
      }
    }
    return tx.invoice.update({
      where: { id: invoiceId },
      data: { status: InvoiceStatus.VOID },
      include: invoiceInclude,
    });
  });
  await recordAudit({
    salonId: context.salon.id,
    actorUserId: context.user.id,
    action: "invoice.voided",
    entityType: "Invoice",
    entityId: invoiceId,
  });
  return invoiceDto(invoice);
}

export type InvoiceDto = ReturnType<typeof invoiceDto>;
export type PaymentKindDto = PaymentKind;
export type PaymentMethodDto = PaymentMethod;
