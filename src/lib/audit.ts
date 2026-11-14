import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { logger } from "./logger";

export async function recordAudit(input: {
  salonId?: string | null;
  actorUserId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Prisma.InputJsonValue;
  ip?: string | null;
}) {
  try {
    await prisma.auditLog.create({
      data: {
        salonId: input.salonId || null,
        actorUserId: input.actorUserId || null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId || null,
        metadata: input.metadata || {},
        ip: input.ip || null,
      },
    });
  } catch (error) {
    logger.error("audit_write_failed", { action: input.action, error: (error as Error).message });
  }
}
