import "server-only";
import type { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { TenantContext } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { badRequest, notFound } from "@/lib/errors";
import { asNumber } from "@/lib/utils";
import type { expenseInput } from "@/lib/validation";

type ExpenseInput = z.infer<typeof expenseInput>;

const expenseInclude = {
  branch: { select: { name: true } },
  receiptFile: { select: { id: true, originalName: true } },
};

export async function listExpenses(context: TenantContext, input: { page: number; pageSize: number; from?: Date; to?: Date; q?: string }) {
  const where = {
    salonId: context.salon.id,
    status: "RECORDED" as const,
    ...(input.from || input.to
      ? { spentAt: { ...(input.from ? { gte: input.from } : {}), ...(input.to ? { lte: input.to } : {}) } }
      : {}),
    ...(input.q
      ? {
          OR: [
            { category: { contains: input.q, mode: "insensitive" as const } },
            { vendor: { contains: input.q, mode: "insensitive" as const } },
            { notes: { contains: input.q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };
  const [items, total] = await prisma.$transaction([
    prisma.expense.findMany({
      where,
      include: expenseInclude,
      orderBy: { spentAt: "desc" },
      skip: (input.page - 1) * input.pageSize,
      take: input.pageSize,
    }),
    prisma.expense.count({ where }),
  ]);
  return {
    items: items.map((expense) => ({
      id: expense.id,
      category: expense.category,
      vendor: expense.vendor,
      amount: asNumber(expense.amount),
      spentAt: expense.spentAt.toISOString(),
      notes: expense.notes,
      branch: expense.branch?.name || null,
      receipt: expense.receiptFile,
    })),
    total,
    pages: Math.ceil(total / input.pageSize),
  };
}

export async function createExpense(context: TenantContext, input: ExpenseInput) {
  if (input.branchId) {
    const branch = await prisma.branch.findFirst({ where: { id: input.branchId, salonId: context.salon.id } });
    if (!branch) throw badRequest("Branch not found");
  }
  if (input.receiptFileId) {
    const file = await prisma.fileAsset.findFirst({
      where: { id: input.receiptFileId, salonId: context.salon.id, kind: "DOCUMENT" },
    });
    if (!file) throw badRequest("Receipt file not found");
  }
  const expense = await prisma.expense.create({
    data: {
      salonId: context.salon.id,
      branchId: input.branchId,
      category: input.category,
      vendor: input.vendor,
      amount: input.amount,
      spentAt: input.spentAt,
      notes: input.notes,
      receiptFileId: input.receiptFileId,
      createdById: context.user.id,
    },
    include: expenseInclude,
  });
  await recordAudit({
    salonId: context.salon.id,
    actorUserId: context.user.id,
    action: "expense.created",
    entityType: "Expense",
    entityId: expense.id,
    metadata: { amount: input.amount, category: input.category },
  });
  return { ...expense, amount: asNumber(expense.amount), spentAt: expense.spentAt.toISOString(), createdAt: expense.createdAt.toISOString() };
}

export async function voidExpense(context: TenantContext, id: string) {
  const expense = await prisma.expense.findFirst({ where: { id, salonId: context.salon.id } });
  if (!expense) throw notFound("Expense not found");
  if (expense.status === "VOID") return expense;
  const updated = await prisma.expense.update({ where: { id }, data: { status: "VOID" } });
  await recordAudit({
    salonId: context.salon.id,
    actorUserId: context.user.id,
    action: "expense.voided",
    entityType: "Expense",
    entityId: id,
  });
  return updated;
}
