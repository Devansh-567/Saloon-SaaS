import "server-only";
import { NotificationChannel, NotificationStatus } from "@prisma/client";
import nodemailer from "nodemailer";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import type { TenantContext } from "@/lib/auth";
import { badRequest, notFound } from "@/lib/errors";
import { getInvoicePdfBytes } from "./invoice-pdf";

function render(template: string, variables: Record<string, string>) {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) => variables[key] ?? "");
}

function emailTransport() {
  if (!env.SMTP_HOST || !env.MAIL_FROM) return null;
  return nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT || 587,
    secure: env.SMTP_SECURE,
    ...(env.SMTP_USER ? { auth: { user: env.SMTP_USER, pass: env.SMTP_PASS } } : {}),
  });
}

function twilioConfigured(channel: NotificationChannel) {
  if (channel === "SMS") return Boolean(env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_SMS_FROM);
  if (channel === "WHATSAPP")
    return Boolean(env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_WHATSAPP_FROM);
  return false;
}

async function sendTwilio(channel: NotificationChannel, to: string, body: string) {
  const from = channel === "SMS" ? env.TWILIO_SMS_FROM! : env.TWILIO_WHATSAPP_FROM!;
  const formattedTo = channel === "WHATSAPP" && !to.startsWith("whatsapp:") ? `whatsapp:${to}` : to;
  const params = new URLSearchParams({ To: formattedTo, From: from, Body: body });
  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params,
    },
  );
  const payload = (await response.json()) as { sid?: string; message?: string };
  if (!response.ok) throw new Error(payload.message || `Twilio returned ${response.status}`);
  return payload.sid || null;
}

export function emailIsConfigured() {
  return Boolean(env.SMTP_HOST && env.MAIL_FROM);
}

/** Plain system email (such as a password reset link). Returns false if email is not set up or fails. */
export async function sendSystemEmail(input: { to: string; subject: string; text: string }) {
  const transport = emailTransport();
  if (!transport) return false;
  try {
    const result = await transport.sendMail({ from: env.MAIL_FROM, to: input.to, subject: input.subject, text: input.text });
    return Boolean(result.accepted?.length);
  } catch {
    return false;
  }
}

export async function sendNotification(input: {
  salonId: string;
  templateKey: string;
  channel: NotificationChannel;
  recipient: string;
  variables: Record<string, string>;
  createdById?: string;
  attachment?: { filename: string; content: Buffer };
}) {
  const template =
    (await prisma.notificationTemplate.findFirst({
      where: { salonId: input.salonId, key: input.templateKey, channel: input.channel, enabled: true },
    })) ||
    (await prisma.notificationTemplate.findFirst({
      where: { salonId: null, key: input.templateKey, channel: input.channel, enabled: true },
    }));
  const log = await prisma.notificationLog.create({
    data: {
      salonId: input.salonId,
      templateId: template?.id,
      channel: input.channel,
      templateKey: input.templateKey,
      recipient: input.recipient.slice(0, 254),
      status: NotificationStatus.QUEUED,
      payload: input.variables,
      createdById: input.createdById,
    },
  });
  if (!template) {
    return prisma.notificationLog.update({
      where: { id: log.id },
      data: { status: NotificationStatus.SKIPPED, error: "No enabled template configured for this channel" },
    });
  }
  if (!input.recipient.trim()) {
    return prisma.notificationLog.update({
      where: { id: log.id },
      data: { status: NotificationStatus.SKIPPED, error: "No recipient configured" },
    });
  }
  const body = render(template.body, input.variables);
  const subject = render(template.subject || "", input.variables);
  try {
    let providerRef: string | null = null;
    if (input.channel === "EMAIL") {
      const transport = emailTransport();
      if (!transport) throw new Error("SMTP is not configured");
      const result = await transport.sendMail({
        from: env.MAIL_FROM,
        to: input.recipient,
        subject: subject || "Salon notification",
        text: body,
        ...(input.attachment
          ? { attachments: [{ filename: input.attachment.filename, content: input.attachment.content }] }
          : {}),
      });
      if (!result.accepted?.length) throw new Error("SMTP server did not accept the message");
      providerRef = result.messageId || null;
    } else {
      if (!twilioConfigured(input.channel)) throw new Error("Twilio is not configured for this channel");
      providerRef = await sendTwilio(input.channel, input.recipient, body);
    }
    return prisma.notificationLog.update({
      where: { id: log.id },
      data: { status: NotificationStatus.ACCEPTED, providerRef },
    });
  } catch (error) {
    return prisma.notificationLog.update({
      where: { id: log.id },
      data: { status: NotificationStatus.FAILED, error: (error as Error).message.slice(0, 500) },
    });
  }
}

export async function sendInvoiceNotification(context: TenantContext, invoiceId: string, channel: NotificationChannel) {
  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, salonId: context.salon.id },
    include: { customer: true, salon: true, branch: true },
  });
  if (!invoice) throw notFound("Invoice not found");
  if (!invoice.customer) throw badRequest("This invoice has no customer contact");
  const recipient =
    channel === "EMAIL" ? invoice.customer.email : invoice.customer.phone;
  if (!recipient) throw badRequest(`The customer has no ${channel === "EMAIL" ? "email address" : "phone number"}`);
  let attachment: { filename: string; content: Buffer } | undefined;
  if (channel === "EMAIL") {
    attachment = {
      filename: `invoice-${invoice.number}.pdf`,
      content: await getInvoicePdfBytes(invoice.id, context),
    };
  }
  return sendNotification({
    salonId: context.salon.id,
    templateKey: "invoice",
    channel,
    recipient,
    createdById: context.user.id,
    attachment,
    variables: {
      customer_name: `${invoice.customer.firstName} ${invoice.customer.lastName}`.trim(),
      salon_name: invoice.salon.name,
      invoice_number: invoice.number,
      invoice_total: `${invoice.salon.currency} ${invoice.total.toFixed(2)}`,
      balance: `${invoice.salon.currency} ${(Number(invoice.total) - Number(invoice.amountPaid) + Number(invoice.amountRefunded)).toFixed(2)}`,
      branch_name: invoice.branch.name,
    },
  });
}

export function notificationConfiguration() {
  return {
    email: Boolean(env.SMTP_HOST && env.MAIL_FROM),
    sms: twilioConfigured("SMS"),
    whatsapp: twilioConfigured("WHATSAPP"),
  };
}
