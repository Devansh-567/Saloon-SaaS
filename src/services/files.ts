# Copyright (c) 2026 Devansh Singh
# All Rights Reserved.
#
# This software and its source code are proprietary
# and confidential property of Guru AI Technologies.
#
# Unauthorized copying, modification, distribution,
# or use of this software, in whole or in part,
# is strictly prohibited without prior written
# permission from Guru AI Technologies.
// 2026 Devansh Singh
// Guru AI Technologies
 import "server-only";
import { FileKind } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { notFound } from "@/lib/errors";
import { readStoredFile, removeStoredFile, saveUpload } from "@/lib/storage";
import type { TenantContext } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";

export async function uploadSalonLogo(context: TenantContext, file: File) {
  const uploaded = await saveUpload({ salonId: context.salon.id, kind: "LOGO", file });
  const asset = await prisma.fileAsset.create({
    data: {
      salonId: context.salon.id,
      kind: FileKind.LOGO,
      originalName: uploaded.originalName,
      storedName: uploaded.storedName,
      relativePath: uploaded.relativePath,
      mimeType: uploaded.mimeType,
      size: uploaded.size,
      uploadedById: context.user.id,
    },
  });
  const current = await prisma.salon.findUnique({
    where: { id: context.salon.id },
    select: { logoFileId: true, logoFile: { select: { relativePath: true } } },
  });
  await prisma.$transaction([
    prisma.salon.update({ where: { id: context.salon.id }, data: { logoFileId: asset.id } }),
    ...(current?.logoFileId ? [prisma.fileAsset.delete({ where: { id: current.logoFileId } })] : []),
  ]);
  if (current?.logoFile?.relativePath) await removeStoredFile(current.logoFile.relativePath);
  await recordAudit({
    salonId: context.salon.id,
    actorUserId: context.user.id,
    action: "logo.uploaded",
    entityType: "Salon",
    entityId: context.salon.id,
  });
  return asset;
}

export async function uploadDocument(context: TenantContext, file: File) {
  const uploaded = await saveUpload({ salonId: context.salon.id, kind: "DOCUMENT", file });
  return prisma.fileAsset.create({
    data: {
      salonId: context.salon.id,
      kind: FileKind.DOCUMENT,
      originalName: uploaded.originalName,
      storedName: uploaded.storedName,
      relativePath: uploaded.relativePath,
      mimeType: uploaded.mimeType,
      size: uploaded.size,
      uploadedById: context.user.id,
    },
  });
}

export async function readTenantFile(
  context: TenantContext,
  fileId: string,
) {
  const file = await prisma.fileAsset.findFirst({
    where: { id: fileId, salonId: context.salon.id },
    include: {
      expenseReceipt: { select: { id: true } },
      employeeDocument: { select: { membershipId: true } },
    },
  });
  if (!file) throw notFound("File not found");
  if (file.kind === FileKind.INVOICE && !context.permissions.includes("billing.read")) throw notFound("File not found");
  if (file.kind === FileKind.RECEIPT && !context.permissions.includes("expenses.read")) throw notFound("File not found");
  if (file.expenseReceipt && !context.permissions.includes("expenses.read")) throw notFound("File not found");
  if (file.employeeDocument) {
    const canSeeAll =
      context.permissions.includes("hr.read") ||
      context.permissions.includes("hr.write") ||
      file.employeeDocument.membershipId === context.membership.id;
    if (!canSeeAll) throw notFound("File not found");
  }
  const bytes = await readStoredFile(file.relativePath);
  return { file, bytes };
}

