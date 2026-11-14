import "server-only";
import { Role } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { TenantContext } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { badRequest, conflict, notFound } from "@/lib/errors";
import { hashPassword, hashToken, randomToken } from "@/lib/crypto";
import { passwordSchema } from "@/lib/security";
import type { inviteInput, membershipUpdate } from "@/lib/validation";
import { asNumber } from "@/lib/utils";

type InviteInput = z.infer<typeof inviteInput>;
type MembershipUpdate = z.infer<typeof membershipUpdate>;

const ROLE_RANK: Record<Role, number> = {
  OWNER: 5,
  ADMIN: 4,
  MANAGER: 3,
  RECEPTIONIST: 2,
  STAFF: 1,
};

function canManageRole(actorRole: Role, targetRole: Role) {
  if (actorRole === "OWNER") return targetRole !== "OWNER";
  if (actorRole === "ADMIN") return ROLE_RANK[targetRole] < ROLE_RANK.ADMIN && targetRole !== "OWNER";
  if (actorRole === "MANAGER") return ["RECEPTIONIST", "STAFF"].includes(targetRole);
  return false;
}

export async function listTeam(context: TenantContext) {
  const [members, invitations] = await Promise.all([
    prisma.membership.findMany({
      where: { salonId: context.salon.id },
      include: {
        user: { select: { id: true, name: true, email: true, phone: true, lastLoginAt: true } },
        branch: { select: { id: true, name: true } },
        staffProfile: true,
      },
      orderBy: [{ active: "desc" }, { createdAt: "asc" }],
    }),
    prisma.invitation.findMany({
      where: { salonId: context.salon.id, acceptedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  return {
    members: members.map((member) => ({
      id: member.id,
      userId: member.user.id,
      name: member.user.name,
      email: member.user.email,
      phone: member.user.phone,
      role: member.role,
      active: member.active,
      branch: member.branch?.name || null,
      branchId: member.branchId,
      lastLoginAt: member.user.lastLoginAt?.toISOString() || null,
      permissionOverrides: member.permissionOverrides,
      profile: member.staffProfile
        ? {
            bio: member.staffProfile.bio,
            specialties: member.staffProfile.specialties,
            color: member.staffProfile.color,
            commissionRate: asNumber(member.staffProfile.commissionRate),
            schedule: member.staffProfile.schedule,
          }
        : null,
    })),
    invitations: invitations.map((invitation) => ({
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      expiresAt: invitation.expiresAt.toISOString(),
      createdAt: invitation.createdAt.toISOString(),
    })),
  };
}

export async function inviteMember(context: TenantContext, input: InviteInput) {
  if (!canManageRole(context.role as Role, input.role as Role)) throw badRequest("You cannot invite this role");
  if (input.branchId) {
    const branch = await prisma.branch.findFirst({ where: { id: input.branchId, salonId: context.salon.id, active: true } });
    if (!branch) throw badRequest("Branch not found");
  }
  const existingUser = await prisma.user.findUnique({ where: { email: input.email } });
  if (existingUser) {
    const membership = await prisma.membership.findUnique({
      where: { salonId_userId: { salonId: context.salon.id, userId: existingUser.id } },
    });
    if (membership?.active) throw conflict("This person is already a member of your salon");
  }
  const subscription = await prisma.subscription.findUnique({ where: { salonId: context.salon.id }, include: { plan: true } });
  const limits = (subscription?.plan.limits || {}) as { maxStaff?: number };
  if (limits.maxStaff) {
    const staffCount = await prisma.membership.count({ where: { salonId: context.salon.id, active: true } });
    if (staffCount >= limits.maxStaff) throw badRequest(`Your plan allows up to ${limits.maxStaff} team members`);
  }
  await prisma.invitation.deleteMany({
    where: { salonId: context.salon.id, email: input.email, acceptedAt: null },
  });
  const token = randomToken();
  const invitation = await prisma.invitation.create({
    data: {
      salonId: context.salon.id,
      email: input.email,
      role: input.role,
      branchId: input.branchId,
      commissionRate: input.commissionRate,
      tokenHash: hashToken(token),
      invitedById: context.user.id,
      expiresAt: new Date(Date.now() + 7 * 86400000),
    },
  });
  await recordAudit({
    salonId: context.salon.id,
    actorUserId: context.user.id,
    action: "team.invited",
    entityType: "Invitation",
    entityId: invitation.id,
    metadata: { email: input.email, role: input.role },
  });
  return {
    token,
    invitationId: invitation.id,
    email: input.email,
    role: input.role,
    expiresAt: invitation.expiresAt.toISOString(),
    branchId: input.branchId,
    commissionRate: input.commissionRate,
  };
}

export async function updateMembership(context: TenantContext, membershipId: string, input: MembershipUpdate) {
  const target = await prisma.membership.findFirst({
    where: { id: membershipId, salonId: context.salon.id },
    include: { user: { select: { name: true } } },
  });
  if (!target) throw notFound("Team member not found");
  if (target.role === "OWNER") throw badRequest("The salon owner account cannot be modified here");
  if (target.id === context.membership.id) throw badRequest("You cannot modify your own membership");
  if (!canManageRole(context.role as Role, target.role as Role)) throw badRequest("You cannot modify this team member");
  if (input.role && !canManageRole(context.role as Role, input.role as Role)) {
    throw badRequest("You cannot assign this role");
  }
  if (input.branchId) {
    const branch = await prisma.branch.findFirst({ where: { id: input.branchId, salonId: context.salon.id, active: true } });
    if (!branch) throw badRequest("Branch not found");
  }
  if (input.active === false) {
    const future = await prisma.appointment.count({
      where: {
        salonId: context.salon.id,
        staffMembershipId: target.id,
        startAt: { gte: new Date() },
        status: { in: ["SCHEDULED", "CONFIRMED", "CHECKED_IN"] },
      },
    });
    if (future > 0) throw conflict("Reassign this member's upcoming appointments before deactivating them");
  }
  if (input.permissionOverrides) {
    const grants = input.permissionOverrides.grant;
    const unauthorized = grants.filter((permission) => !context.permissions.includes(permission));
    if (unauthorized.length) throw badRequest("You cannot grant permissions you do not hold");
  }
  const updated = await prisma.$transaction(async (tx) => {
    const membership = await tx.membership.update({
      where: { id: membershipId },
      data: {
        ...(input.role ? { role: input.role } : {}),
        ...(input.branchId !== undefined ? { branchId: input.branchId } : {}),
        ...(input.active !== undefined ? { active: input.active } : {}),
        ...(input.permissionOverrides ? { permissionOverrides: input.permissionOverrides } : {}),
      },
    });
    if (input.staffProfile) {
      await tx.staffProfile.upsert({
        where: { membershipId },
        create: {
          membershipId,
          bio: input.staffProfile.bio,
          specialties: input.staffProfile.specialties || [],
          color: input.staffProfile.color || "#8c6a52",
          commissionRate: input.staffProfile.commissionRate || 0,
          schedule: input.staffProfile.schedule || [],
        },
        update: {
          ...(input.staffProfile.bio !== undefined ? { bio: input.staffProfile.bio } : {}),
          ...(input.staffProfile.specialties !== undefined ? { specialties: input.staffProfile.specialties } : {}),
          ...(input.staffProfile.color !== undefined ? { color: input.staffProfile.color } : {}),
          ...(input.staffProfile.commissionRate !== undefined ? { commissionRate: input.staffProfile.commissionRate } : {}),
          ...(input.staffProfile.schedule !== undefined ? { schedule: input.staffProfile.schedule } : {}),
        },
      });
    }
    return membership;
  });
  await recordAudit({
    salonId: context.salon.id,
    actorUserId: context.user.id,
    action: "team.updated",
    entityType: "Membership",
    entityId: membershipId,
    metadata: { target: target.user.name, role: updated.role, active: updated.active },
  });
  return updated;
}

export const acceptInviteSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  password: passwordSchema.optional(),
});

export async function getInvitationInfo(token: string) {
  const invitation = await prisma.invitation.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { salon: { select: { name: true, status: true } } },
  });
  if (!invitation) throw notFound("Invitation not found");
  if (invitation.acceptedAt) throw conflict("This invitation has already been accepted");
  if (invitation.expiresAt < new Date()) throw badRequest("This invitation has expired");
  if (invitation.salon.status !== "ACTIVE") throw badRequest("This salon is not accepting new members");
  return {
    email: invitation.email,
    role: invitation.role,
    salonName: invitation.salon.name,
    expiresAt: invitation.expiresAt.toISOString(),
    accountExists: Boolean(await prisma.user.findUnique({ where: { email: invitation.email }, select: { id: true } })),
  };
}

export async function acceptInvitation(token: string, input: z.infer<typeof acceptInviteSchema>, viewerUserId?: string) {
  const invitation = await prisma.invitation.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { salon: { select: { id: true, name: true, status: true } } },
  });
  if (!invitation) throw notFound("Invitation not found");
  if (invitation.acceptedAt) throw conflict("This invitation has already been accepted");
  if (invitation.expiresAt < new Date()) throw badRequest("This invitation has expired");
  if (invitation.salon.status !== "ACTIVE") throw badRequest("This salon is not accepting new members");
  const existingUser = await prisma.user.findUnique({ where: { email: invitation.email } });
  if (existingUser && existingUser.platformRole === "SUPER_ADMIN") throw badRequest("Platform administrators cannot join salons");
  if (existingUser && viewerUserId !== existingUser.id) {
    throw conflict("An account already exists for this email. Sign in with it to accept this invitation.");
  }
  if (!existingUser && (!input.name || !input.password)) {
    throw badRequest("Name and password are required to accept this invitation");
  }
  const result = await prisma.$transaction(async (tx) => {
    const user = existingUser
      ? existingUser
      : await tx.user.create({
          data: {
            email: invitation.email,
            name: input.name!,
            passwordHash: await hashPassword(input.password!),
          },
        });
    const membership = await tx.membership.upsert({
      where: { salonId_userId: { salonId: invitation.salonId, userId: user.id } },
      create: {
        salonId: invitation.salonId,
        userId: user.id,
        role: invitation.role,
        branchId: invitation.branchId,
        active: true,
      },
      update: { role: invitation.role, branchId: invitation.branchId, active: true },
    });
    await tx.staffProfile.upsert({
      where: { membershipId: membership.id },
      create: { membershipId: membership.id, commissionRate: invitation.commissionRate },
      update: {},
    });
    await tx.invitation.update({ where: { id: invitation.id }, data: { acceptedAt: new Date() } });
    return { user, membership };
  });
  await recordAudit({
    salonId: invitation.salonId,
    actorUserId: result.user.id,
    action: "invitation.accepted",
    entityType: "Invitation",
    entityId: invitation.id,
    metadata: { email: invitation.email, role: invitation.role },
  });
  return {
    salonId: invitation.salonId,
    salonName: invitation.salon.name,
    userId: result.user.id,
    requiresLogin: !existingUser,
  };
}

export async function staffLimitInfo(context: TenantContext) {
  const subscription = await prisma.subscription.findUnique({
    where: { salonId: context.salon.id },
    include: { plan: true },
  });
  const limits = (subscription?.plan.limits || {}) as { maxStaff?: number; maxBranches?: number };
  const [staff, branches] = await Promise.all([
    prisma.membership.count({ where: { salonId: context.salon.id, active: true } }),
    prisma.branch.count({ where: { salonId: context.salon.id, active: true } }),
  ]);
  return { staff, branches, ...limits };
}
