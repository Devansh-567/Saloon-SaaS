import "server-only";
import crypto from "node:crypto";
import { InvoiceStatus, type PaymentMethod } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import type { TenantContext } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { badRequest, conflict, notFound } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { parseSalonSettings } from "@/lib/settings";
import { asNumber, roundMoney } from "@/lib/utils";
import { statusForAmounts } from "@/services/billing";

const RAZORPAY_API = "https://api.razorpay.com/v1";

export function onlinePaymentsEnabled() {
  return Boolean(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET);
}

function authHeader() {
  return `Basic ${Buffer.from(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`).toString("base64")}`;
}

type PaymentLinkResponse = { id: string; short_url: string; status: string };

export async function createPaymentLink(context: TenantContext, invoiceId: string) {
  if (!onlinePaymentsEnabled()) throw badRequest("Online payments are not switched on yet. Add the Razorpay keys first.");
  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, salonId: context.salon.id },
    include: { customer: true },
  });
  if (!invoice) throw notFound("Bill not found");
  if (invoice.status === InvoiceStatus.VOID) throw conflict("A cancelled bill cannot be paid");
  if (context.salon.currency !== "INR") throw badRequest("Online payment works in Indian Rupees (INR) only. Change the currency in Settings.");

  const netPaid = roundMoney(asNumber(invoice.amountPaid) - asNumber(invoice.amountRefunded));
  const balance = roundMoney(asNumber(invoice.total) - netPaid);
  if (balance <= 0) throw conflict("This bill is already fully paid");
  if (balance < 1) throw badRequest("Online payment needs at least 1 rupee to be pending");

  if (
    invoice.onlineLinkUrl &&
    invoice.onlineLinkId &&
    invoice.onlineLinkAmount !== null &&
    Math.abs(asNumber(invoice.onlineLinkAmount) - balance) < 0.001
  ) {
    return { url: invoice.onlineLinkUrl, amount: balance, reused: true };
  }

  const body: Record<string, unknown> = {
    amount: Math.round(balance * 100),
    currency: "INR",
    accept_partial: false,
    reference_id: `${invoice.id}-${Date.now().toString(36)}`.slice(0, 40),
    description: `Bill ${invoice.number} - ${context.salon.name}`.slice(0, 250),
    expire_by: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60,
    notify: { sms: false, email: false },
    reminder_enable: false,
    notes: { invoiceId: invoice.id, salonId: context.salon.id, billNumber: invoice.number },
  };
  const customerName = invoice.customer ? `${invoice.customer.firstName} ${invoice.customer.lastName}`.trim() : "";
  if (customerName) body.customer = { name: customerName };

  const response = await fetch(`${RAZORPAY_API}/payment_links`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: authHeader() },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  const data = (await response.json().catch(() => null)) as (PaymentLinkResponse & { error?: { description?: string } }) | null;
  if (!response.ok || !data?.short_url) {
    logger.error("razorpay_link_failed", { status: response.status, description: data?.error?.description });
    throw badRequest(`The payment gateway said: ${data?.error?.description || "could not create the link"}`);
  }

  await prisma.invoice.update({
    where: { id: invoice.id },
    data: { onlineLinkId: data.id, onlineLinkUrl: data.short_url, onlineLinkAmount: balance },
  });
  await recordAudit({
    salonId: context.salon.id,
    actorUserId: context.user.id,
    action: "payment.link_created",
    entityType: "Invoice",
    entityId: invoice.id,
    metadata: { amount: balance, linkId: data.id },
  });
  return { url: data.short_url, amount: balance, reused: false };
}

export function verifyRazorpaySignature(rawBody: string, signature: string | null) {
  if (!env.RAZORPAY_WEBHOOK_SECRET || !signature) return false;
  const expected = crypto.createHmac("sha256", env.RAZORPAY_WEBHOOK_SECRET).update(rawBody).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

const METHOD_MAP: Record<string, PaymentMethod> = {
  upi: "UPI",
  card: "CARD",
  netbanking: "BANK",
  wallet: "OTHER",
};

type WebhookEvent = {
  event?: string;
  payload?: {
    payment_link?: { entity?: { id?: string; notes?: Record<string, string> | unknown[] } };
    payment?: { entity?: { id?: string; amount?: number; method?: string } };
  };
};

export async function handleRazorpayEvent(event: WebhookEvent) {
  if (event.event !== "payment_link.paid") return { handled: false };
  const link = event.payload?.payment_link?.entity;
  const payment = event.payload?.payment?.entity;
  const notes: Record<string, string | undefined> = link?.notes && !Array.isArray(link.notes) ? (link.notes as Record<string, string>) : {};
  if (!link?.id || !payment?.id || typeof payment.amount !== "number") return { handled: false };

  const invoice = await prisma.invoice.findFirst({
    where: notes.invoiceId ? { id: notes.invoiceId, salonId: notes.salonId } : { onlineLinkId: link.id },
    include: { salon: true },
  });
  if (!invoice) {
    logger.warn("razorpay_payment_unmatched", { linkId: link.id, paymentId: payment.id });
    return { handled: false };
  }
  const amount = roundMoney(payment.amount / 100);
  const method = METHOD_MAP[payment.method || ""] || "OTHER";

  const result = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`invoice:${invoice.id}`}))`;
    const duplicate = await tx.payment.findFirst({ where: { invoiceId: invoice.id, reference: payment.id } });
    if (duplicate) return { duplicate: true, status: invoice.status };
    const fresh = await tx.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
    const newPaid = roundMoney(asNumber(fresh.amountPaid) + amount);
    const status = fresh.status === InvoiceStatus.VOID
      ? fresh.status
      : statusForAmounts(asNumber(fresh.total), newPaid, asNumber(fresh.amountRefunded), fresh.status);
    await tx.payment.create({
      data: {
        invoiceId: invoice.id,
        amount,
        method,
        kind: "PAYMENT",
        reference: payment.id,
        notes: "Paid online (Razorpay)",
        receivedById: null,
      },
    });
    const awardLoyalty = status === InvoiceStatus.PAID && !fresh.loyaltyAwardedAt && Boolean(fresh.customerId);
    await tx.invoice.update({
      where: { id: invoice.id },
      data: { amountPaid: { increment: amount }, status, ...(awardLoyalty ? { loyaltyAwardedAt: new Date() } : {}) },
    });
    if (fresh.customerId) {
      await tx.customer.update({ where: { id: fresh.customerId }, data: { totalSpent: { increment: amount } } });
      if (awardLoyalty) {
        const points = Math.floor(asNumber(fresh.total) * parseSalonSettings(invoice.salon.settings).loyaltyPointsPerCurrency);
        if (points > 0) await tx.customer.update({ where: { id: fresh.customerId }, data: { loyaltyPoints: { increment: points } } });
      }
    }
    return { duplicate: false, status };
  });

  if (!result.duplicate) {
    await recordAudit({
      salonId: invoice.salonId,
      action: "payment.recorded_online",
      entityType: "Invoice",
      entityId: invoice.id,
      metadata: { amount, method, paymentId: payment.id, status: result.status },
    });
  }
  return { handled: true };
}
