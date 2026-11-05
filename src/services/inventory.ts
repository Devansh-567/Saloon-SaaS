import "server-only";
import { Prisma } from "@prisma/client";
import type { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { TenantContext } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { badRequest, conflict, notFound } from "@/lib/errors";
import { asNumber, roundMoney } from "@/lib/utils";
import type { productInput, purchaseInput, stockAdjustmentInput, supplierInput } from "@/lib/validation";

type ProductInput = z.infer<typeof productInput>;
type SupplierInput = z.infer<typeof supplierInput>;
type AdjustmentInput = z.infer<typeof stockAdjustmentInput>;
type PurchaseInput = z.infer<typeof purchaseInput>;

export function productDto(product: {
  id: string;
  name: string;
  sku: string;
  description: string | null;
  price: Prisma.Decimal;
  cost: Prisma.Decimal;
  stockQty: number;
  reorderLevel: number;
  unit: string;
  active: boolean;
  supplierId: string | null;
  taxRateId: string | null;
  supplier: { name: string } | null;
  taxRate: { name: string; rate: Prisma.Decimal } | null;
}) {
  return {
    id: product.id,
    name: product.name,
    sku: product.sku,
    description: product.description,
    price: asNumber(product.price),
    cost: asNumber(product.cost),
    stockQty: product.stockQty,
    reorderLevel: product.reorderLevel,
    unit: product.unit,
    active: product.active,
    supplierId: product.supplierId,
    supplier: product.supplier?.name || null,
    taxRateId: product.taxRateId,
    taxRate: product.taxRate ? { name: product.taxRate.name, rate: asNumber(product.taxRate.rate) } : null,
    lowStock: product.stockQty <= product.reorderLevel,
  };
}

const productInclude = {
  supplier: { select: { name: true } },
  taxRate: { select: { name: true, rate: true } },
} satisfies Prisma.ProductInclude;

export async function listProducts(
  context: TenantContext,
  input: { q?: string; lowStock?: boolean; page: number; pageSize: number },
) {
  const where: Prisma.ProductWhereInput = {
    salonId: context.salon.id,
    ...(input.q
      ? {
          OR: [
            { name: { contains: input.q, mode: "insensitive" } },
            { sku: { contains: input.q, mode: "insensitive" } },
          ],
        }
      : {}),
  };
  const all = await prisma.product.findMany({
    where,
    include: productInclude,
    orderBy: { name: "asc" },
  });
  const filtered = input.lowStock ? all.filter((p) => p.stockQty <= p.reorderLevel) : all;
  const sliced = filtered.slice((input.page - 1) * input.pageSize, input.page * input.pageSize);
  return { items: sliced.map(productDto), total: filtered.length, pages: Math.ceil(filtered.length / input.pageSize) };
}

export async function listAllProducts(context: TenantContext) {
  const products = await prisma.product.findMany({
    where: { salonId: context.salon.id, active: true },
    include: productInclude,
    orderBy: { name: "asc" },
  });
  return products.map(productDto);
}

export async function listSuppliers(context: TenantContext) {
  return prisma.supplier.findMany({
    where: { salonId: context.salon.id },
    orderBy: { name: "asc" },
  });
}

export async function createSupplier(context: TenantContext, input: SupplierInput) {
  const supplier = await prisma.supplier.create({
    data: { ...input, salonId: context.salon.id },
  });
  await recordAudit({
    salonId: context.salon.id,
    actorUserId: context.user.id,
    action: "supplier.created",
    entityType: "Supplier",
    entityId: supplier.id,
  });
  return supplier;
}

export async function updateSupplier(context: TenantContext, id: string, input: Partial<SupplierInput>) {
  const existing = await prisma.supplier.findFirst({ where: { id, salonId: context.salon.id } });
  if (!existing) throw notFound("Supplier not found");
  const supplier = await prisma.supplier.update({ where: { id }, data: input });
  await recordAudit({
    salonId: context.salon.id,
    actorUserId: context.user.id,
    action: "supplier.updated",
    entityType: "Supplier",
    entityId: id,
    metadata: { name: supplier.name },
  });
  return supplier;
}

export async function deleteSupplier(context: TenantContext, id: string) {
  const supplier = await prisma.supplier.findFirst({
    where: { id, salonId: context.salon.id },
    include: { _count: { select: { products: true, purchases: true } } },
  });
  if (!supplier) throw notFound("Supplier not found");
  const referenced = supplier._count.products > 0 || supplier._count.purchases > 0;
  if (referenced) {
    await prisma.supplier.update({ where: { id }, data: { active: false } });
  } else {
    await prisma.supplier.delete({ where: { id } });
  }
  await recordAudit({
    salonId: context.salon.id,
    actorUserId: context.user.id,
    action: referenced ? "supplier.archived" : "supplier.deleted",
    entityType: "Supplier",
    entityId: id,
    metadata: { name: supplier.name },
  });
  return { id, archived: referenced };
}

export async function createProduct(context: TenantContext, input: ProductInput) {
  if (input.supplierId) {
    const supplier = await prisma.supplier.findFirst({ where: { id: input.supplierId, salonId: context.salon.id } });
    if (!supplier) throw badRequest("Supplier not found");
  }
  if (input.taxRateId) {
    const tax = await prisma.taxRate.findFirst({ where: { id: input.taxRateId, salonId: context.salon.id } });
    if (!tax) throw badRequest("Tax rate not found");
  }
  const product = await prisma.$transaction(async (tx) => {
    const created = await tx.product.create({
      data: {
        salonId: context.salon.id,
        name: input.name,
        sku: input.sku,
        description: input.description,
        supplierId: input.supplierId,
        taxRateId: input.taxRateId,
        price: input.price,
        cost: input.cost,
        stockQty: input.stockQty,
        reorderLevel: input.reorderLevel,
        unit: input.unit,
        active: input.active,
      },
      include: productInclude,
    });
    if (input.stockQty > 0) {
      await tx.stockMovement.create({
        data: {
          salonId: context.salon.id,
          productId: created.id,
          type: "ADJUSTMENT",
          quantity: input.stockQty,
          resultingBalance: input.stockQty,
          notes: "Opening stock",
          createdById: context.user.id,
        },
      });
    }
    return created;
  });
  await recordAudit({
    salonId: context.salon.id,
    actorUserId: context.user.id,
    action: "product.created",
    entityType: "Product",
    entityId: product.id,
  });
  return productDto(product);
}

export async function updateProduct(context: TenantContext, id: string, input: Partial<ProductInput>) {
  const existing = await prisma.product.findFirst({ where: { id, salonId: context.salon.id } });
  if (!existing) throw notFound("Product not found");
  const { stockQty: _stockQty, ...rest } = input;
  if (rest.supplierId) {
    const supplier = await prisma.supplier.findFirst({ where: { id: rest.supplierId, salonId: context.salon.id } });
    if (!supplier) throw badRequest("Supplier not found");
  }
  if (rest.taxRateId) {
    const tax = await prisma.taxRate.findFirst({ where: { id: rest.taxRateId, salonId: context.salon.id } });
    if (!tax) throw badRequest("Tax rate not found");
  }
  const product = await prisma.product.update({
    where: { id },
    data: rest,
    include: productInclude,
  });
  await recordAudit({
    salonId: context.salon.id,
    actorUserId: context.user.id,
    action: "product.updated",
    entityType: "Product",
    entityId: id,
  });
  return productDto(product);
}

export async function deleteProduct(context: TenantContext, id: string) {
  const product = await prisma.product.findFirst({
    where: { id, salonId: context.salon.id },
    include: {
      _count: { select: { invoiceLines: true, purchaseItems: true, serviceUsage: true } },
    },
  });
  if (!product) throw notFound("Product not found");
  const referenced = product._count.invoiceLines > 0 || product._count.purchaseItems > 0 || product._count.serviceUsage > 0;
  if (referenced) {
    await prisma.product.update({ where: { id }, data: { active: false } });
  } else {
    await prisma.product.delete({ where: { id } });
  }
  await recordAudit({
    salonId: context.salon.id,
    actorUserId: context.user.id,
    action: referenced ? "product.archived" : "product.deleted",
    entityType: "Product",
    entityId: id,
    metadata: { name: product.name },
  });
  return { id, archived: referenced };
}

export async function adjustStock(context: TenantContext, input: AdjustmentInput) {
  const result = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`stock:${input.productId}`}))`;
    const product = await tx.product.findFirst({ where: { id: input.productId, salonId: context.salon.id } });
    if (!product) throw notFound("Product not found");
    const next = product.stockQty + input.delta;
    if (next < 0) throw conflict("Stock adjustment would make inventory negative");
    const updated = await tx.product.update({ where: { id: product.id }, data: { stockQty: next } });
    await tx.stockMovement.create({
      data: {
        salonId: context.salon.id,
        productId: product.id,
        type: "ADJUSTMENT",
        quantity: input.delta,
        resultingBalance: updated.stockQty,
        notes: input.notes,
        createdById: context.user.id,
      },
    });
    return updated;
  });
  await recordAudit({
    salonId: context.salon.id,
    actorUserId: context.user.id,
    action: "stock.adjusted",
    entityType: "Product",
    entityId: input.productId,
    metadata: { delta: input.delta },
  });
  return { productId: result.id, stockQty: result.stockQty };
}

export async function listPurchaseHistory(context: TenantContext, page = 1, pageSize = 20) {
  const [items, total] = await prisma.$transaction([
    prisma.purchase.findMany({
      where: { salonId: context.salon.id },
      include: { supplier: { select: { name: true } }, items: { include: { product: { select: { name: true } } } } },
      orderBy: { purchasedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.purchase.count({ where: { salonId: context.salon.id } }),
  ]);
  return {
    items: items.map((purchase) => ({
      id: purchase.id,
      reference: purchase.reference,
      supplier: purchase.supplier?.name || null,
      total: asNumber(purchase.total),
      purchasedAt: purchase.purchasedAt.toISOString(),
      items: purchase.items.map((item) => ({
        product: item.product.name,
        quantity: item.quantity,
        unitCost: asNumber(item.unitCost),
      })),
    })),
    total,
    pages: Math.ceil(total / pageSize),
  };
}

export async function createPurchase(context: TenantContext, input: PurchaseInput) {
  if (input.supplierId) {
    const supplier = await prisma.supplier.findFirst({ where: { id: input.supplierId, salonId: context.salon.id } });
    if (!supplier) throw badRequest("Supplier not found");
  }
  const productIds = [...new Set(input.items.map((i) => i.productId))];
  const products = await prisma.product.findMany({
    where: { id: { in: productIds }, salonId: context.salon.id },
  });
  if (products.length !== productIds.length) throw badRequest("One or more products were not found");
  const productMap = new Map(products.map((p) => [p.id, p]));
  const total = roundMoney(input.items.reduce((sum, item) => sum + item.quantity * item.unitCost, 0));
  const purchase = await prisma.$transaction(async (tx) => {
    const created = await tx.purchase.create({
      data: {
        salonId: context.salon.id,
        supplierId: input.supplierId,
        reference: input.reference,
        total,
        notes: input.notes,
        purchasedAt: input.purchasedAt,
        createdById: context.user.id,
        items: {
          create: input.items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            unitCost: item.unitCost,
            lineTotal: roundMoney(item.quantity * item.unitCost),
          })),
        },
      },
    });
    for (const item of input.items) {
      const product = productMap.get(item.productId)!;
      const updated = await tx.product.update({
        where: { id: item.productId },
        data: { stockQty: { increment: item.quantity }, cost: item.unitCost },
      });
      await tx.stockMovement.create({
        data: {
          salonId: context.salon.id,
          productId: item.productId,
          type: "PURCHASE",
          quantity: item.quantity,
          resultingBalance: updated.stockQty,
          unitCost: item.unitCost,
          reference: input.reference || `purchase:${created.id}`,
          createdById: context.user.id,
        },
      });
      void product;
    }
    return created;
  });
  await recordAudit({
    salonId: context.salon.id,
    actorUserId: context.user.id,
    action: "purchase.created",
    entityType: "Purchase",
    entityId: purchase.id,
    metadata: { total },
  });
  return { ...purchase, total: asNumber(purchase.total), purchasedAt: purchase.purchasedAt.toISOString() };
}

export async function deletePurchase(context: TenantContext, id: string) {
  const purchase = await prisma.purchase.findFirst({
    where: { id, salonId: context.salon.id },
    include: { items: { include: { product: { select: { name: true } } } } },
  });
  if (!purchase) throw notFound("Purchase not found");
  await prisma.$transaction(async (tx) => {
    for (const item of purchase.items) {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`stock:${item.productId}`}))`;
      const product = await tx.product.findFirst({ where: { id: item.productId, salonId: context.salon.id } });
      if (!product) throw conflict(`${item.product.name} no longer exists`);
      if (product.stockQty < item.quantity) {
        throw conflict(`Cannot remove this purchase: ${item.product.name} has already been used or sold`);
      }
      const updated = await tx.product.update({
        where: { id: item.productId },
        data: { stockQty: { decrement: item.quantity } },
      });
      await tx.stockMovement.create({
        data: {
          salonId: context.salon.id,
          productId: item.productId,
          type: "ADJUSTMENT",
          quantity: -item.quantity,
          resultingBalance: updated.stockQty,
          reference: `purchase-deleted:${purchase.id}`,
          notes: "Purchase removed",
          createdById: context.user.id,
        },
      });
    }
    await tx.purchase.delete({ where: { id } });
  });
  await recordAudit({
    salonId: context.salon.id,
    actorUserId: context.user.id,
    action: "purchase.deleted",
    entityType: "Purchase",
    entityId: id,
    metadata: { total: asNumber(purchase.total) },
  });
  return { id };
}
