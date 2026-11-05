import "server-only";
import { FileKind } from "@prisma/client";
import PDFDocument from "pdfkit";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { BRAND } from "@/lib/brand";
import { notFound } from "@/lib/errors";
import { parseSalonSettings } from "@/lib/settings";
import { formatMoney, asNumber } from "@/lib/utils";
import { readStoredFile, writeGeneratedFile } from "@/lib/storage";
import type { TenantContext } from "@/lib/auth";

const regularFont = path.join(process.cwd(), "public", "fonts", "NotoSans-Regular.ttf");
const boldFont = path.join(process.cwd(), "public", "fonts", "NotoSans-Bold.ttf");

async function buildInvoicePdf(invoiceId: string, salonId: string) {
  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, salonId },
    include: {
      salon: { include: { logoFile: true } },
      branch: true,
      customer: true,
      items: { include: { staff: { include: { user: true } } } },
      payments: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!invoice) throw notFound("Invoice not found");
  const settings = parseSalonSettings(invoice.salon.settings);
  const accent = settings.accentColor;
  const doc = new PDFDocument({ size: "A4", margin: 48, info: { Title: `Invoice ${invoice.number}` } });
  const chunks: Buffer[] = [];
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
  doc.registerFont("Body", regularFont);
  doc.registerFont("Bold", boldFont);
  doc.font("Body").fillColor("#1f2523");
  doc.rect(0, 0, doc.page.width, 10).fill(accent);
  doc.fillColor("#1f2523");

  let headerX = 48;
  if (settings.showLogo && invoice.salon.logoFile) {
    try {
      const bytes = await readStoredFile(invoice.salon.logoFile.relativePath);
      if (["image/png", "image/jpeg"].includes(invoice.salon.logoFile.mimeType)) {
        doc.image(bytes, 48, 36, { fit: [88, 56] });
        headerX = 152;
      }
    } catch {
      headerX = 48;
    }
  }

  doc.font("Bold").fontSize(20).text(invoice.salon.name, headerX, 42, { width: 360 });
  doc.font("Body").fontSize(9).fillColor("#59635e");
  doc.text([invoice.salon.address, invoice.salon.phone, invoice.salon.email].filter(Boolean).join("  |  "), headerX, 68, {
    width: 390,
  });
  doc.font("Bold").fontSize(24).fillColor(accent).text("INVOICE", 420, 42, { width: 127, align: "right" });
  doc.font("Body").fontSize(9).fillColor("#59635e");
  doc.text(invoice.number, 420, 72, { width: 127, align: "right" });
  doc.text(invoice.issuedAt ? new Date(invoice.issuedAt).toISOString().slice(0, 10) : "", 420, 85, {
    width: 127,
    align: "right",
  });
  doc.moveDown(2);
  const top = 118;
  doc.font("Bold").fontSize(10).fillColor("#1f2523").text("BILL TO", 48, top);
  doc.font("Body").fontSize(9).fillColor("#39423e");
  if (invoice.customer) {
    doc.text(`${invoice.customer.firstName} ${invoice.customer.lastName}`.trim(), 48, top + 15);
    doc.text(invoice.customer.phone, 48, top + 28);
    if (invoice.customer.email) doc.text(invoice.customer.email, 48, top + 41);
  } else {
    doc.text("Customer", 48, top + 15);
  }
  doc.font("Bold").fontSize(10).fillColor("#1f2523").text("BRANCH", 330, top);
  doc.font("Body").fontSize(9).fillColor("#39423e").text(invoice.branch.name, 330, top + 15, { width: 217 });
  doc.text(invoice.branch.address || "", 330, top + 28, { width: 217 });

  let y = 190;
  doc.rect(48, y, 499, 24).fill("#f0ece6");
  doc.fillColor("#39423e").font("Bold").fontSize(8);
  doc.text("DESCRIPTION", 56, y + 8);
  doc.text("QTY", 338, y + 8, { width: 32, align: "right" });
  doc.text("PRICE", 378, y + 8, { width: 50, align: "right" });
  doc.text("TAX", 436, y + 8, { width: 42, align: "right" });
  doc.text("TOTAL", 484, y + 8, { width: 55, align: "right" });
  y += 32;
  for (const item of invoice.items) {
    if (y > 700) {
      doc.addPage();
      y = 48;
    }
    const staffName = item.staff?.user.name;
    doc.font("Body").fontSize(9).fillColor("#1f2523").text(item.description, 56, y, { width: 265 });
    let lineY = y + doc.heightOfString(item.description, { width: 265 }) + 2;
    if (staffName) {
      doc.fontSize(7.5).fillColor("#75807a").text(`Staff: ${staffName}`, 56, lineY, { width: 265 });
      lineY += 10;
    }
    doc.font("Body").fontSize(9).fillColor("#39423e");
    doc.text(asNumber(item.quantity).toString(), 338, y, { width: 32, align: "right" });
    doc.text(formatMoney(item.unitPrice, invoice.salon.currency, invoice.salon.locale), 378, y, { width: 70, align: "right" });
    doc.text(`${asNumber(item.taxRate)}%`, 448, y, { width: 30, align: "right" });
    doc.text(formatMoney(item.lineTotal, invoice.salon.currency, invoice.salon.locale), 484, y, {
      width: 55,
      align: "right",
    });
    y = Math.max(lineY + 10, y + 28);
    doc.moveTo(48, y - 6).lineTo(547, y - 6).strokeColor("#ebe5dd").lineWidth(0.5).stroke();
  }

  y += 8;
  const totalsX = 330;
  const totalsWidth = 217;
  const totalLine = (label: string, value: string, bold = false) => {
    doc.font(bold ? "Bold" : "Body").fontSize(bold ? 12 : 9).fillColor(bold ? "#1f2523" : "#59635e");
    doc.text(label, totalsX, y, { width: 110 });
    doc.text(value, totalsX + 110, y, { width: totalsWidth - 110, align: "right" });
    y += bold ? 24 : 17;
  };
  totalLine("Subtotal", formatMoney(invoice.subtotal, invoice.salon.currency, invoice.salon.locale));
  if (asNumber(invoice.discount) > 0) totalLine("Discount", `-${formatMoney(invoice.discount, invoice.salon.currency, invoice.salon.locale)}`);
  totalLine("Tax", formatMoney(invoice.taxTotal, invoice.salon.currency, invoice.salon.locale));
  totalLine("Total", formatMoney(invoice.total, invoice.salon.currency, invoice.salon.locale), true);
  totalLine("Paid", formatMoney(invoice.amountPaid, invoice.salon.currency, invoice.salon.locale));
  if (asNumber(invoice.amountRefunded) > 0) {
    totalLine("Refunded", `-${formatMoney(invoice.amountRefunded, invoice.salon.currency, invoice.salon.locale)}`);
  }
  const balance = asNumber(invoice.total) - asNumber(invoice.amountPaid) + asNumber(invoice.amountRefunded);
  if (balance > 0) totalLine("Balance due", formatMoney(balance, invoice.salon.currency, invoice.salon.locale), true);

  if (invoice.notes) {
    y += 12;
    doc.font("Bold").fontSize(9).fillColor("#1f2523").text("Notes", 48, y);
    doc.font("Body").fontSize(8.5).fillColor("#59635e").text(invoice.notes, 48, y + 14, { width: 250 });
  }
  const footerY = Math.max(y + 24, 730);
  doc.moveTo(48, footerY).lineTo(547, footerY).strokeColor("#d8d0c7").lineWidth(0.7).stroke();
  doc.font("Bold").fontSize(9).fillColor(accent).text(settings.receiptHeader || "Thank you for your visit.", 48, footerY + 14, {
    width: 499,
    align: "center",
  });
  doc.font("Body").fontSize(8).fillColor("#75807a").text(settings.receiptFooter || invoice.salon.name, 48, footerY + 28, {
    width: 499,
    align: "center",
  });
  if (BRAND.showOnBills) {
    doc.font("Body").fontSize(7).fillColor("#9aa39e").text(`Powered by ${BRAND.name}`, 48, footerY + 46, {
      width: 499,
      align: "center",
    });
  }
  doc.end();
  return done;
}

export async function ensureInvoicePdf(invoiceId: string, context: TenantContext) {
  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, salonId: context.salon.id },
    include: { pdfFile: true },
  });
  if (!invoice) throw notFound("Invoice not found");
  const bytes = await buildInvoicePdf(invoiceId, context.salon.id);
  const stored = await writeGeneratedFile({
    salonId: context.salon.id,
    kind: invoice.status === "PAID" ? "RECEIPT" : "INVOICE",
    basename: invoice.number,
    bytes,
    mime: "application/pdf",
    ext: "pdf",
    existingPath: invoice.pdfFile?.relativePath,
  });
  if (invoice.pdfFileId) {
    await prisma.fileAsset.update({
      where: { id: invoice.pdfFileId },
      data: { size: bytes.length, kind: FileKind.INVOICE, mimeType: "application/pdf" },
    });
    return prisma.fileAsset.findUniqueOrThrow({ where: { id: invoice.pdfFileId } });
  }
  const asset = await prisma.fileAsset.create({
    data: {
      salonId: context.salon.id,
      kind: FileKind.INVOICE,
      originalName: `invoice-${invoice.number}.pdf`,
      storedName: stored.storedName,
      relativePath: stored.relativePath,
      mimeType: "application/pdf",
      size: bytes.length,
      uploadedById: context.user.id,
    },
  });
  await prisma.invoice.update({ where: { id: invoiceId }, data: { pdfFileId: asset.id } });
  return asset;
}

export async function getInvoicePdfBytes(invoiceId: string, context: TenantContext) {
  const invoice = await prisma.invoice.findFirst({ where: { id: invoiceId, salonId: context.salon.id } });
  if (!invoice) throw notFound("Invoice not found");
  return buildInvoicePdf(invoiceId, context.salon.id);
}
