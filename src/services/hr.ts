import "server-only";
import { LeaveStatus, Prisma, type Role } from "@prisma/client";
import type { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { TenantContext } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { badRequest, conflict, forbidden, notFound } from "@/lib/errors";
import { asNumber, roundMoney, isoDateOnly, dateOnlyFromInput } from "@/lib/utils";
import { zonedDateInput, zonedDateTimeToUtc, zonedDayBounds, zonedStartOfDay } from "@/lib/timezone";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { removeStoredFile } from "@/lib/storage";
import type {
  advanceDecisionInput,
  advanceInput,
  attendanceBulkInput,
  attendanceInput,
  employeeProfileInput,
  leaveDecisionInput,
  leaveInput,
  salaryPaymentInput,
} from "@/lib/validation";

type AttendanceInput = z.infer<typeof attendanceInput>;
type AttendanceBulkInput = z.infer<typeof attendanceBulkInput>;
type LeaveInput = z.infer<typeof leaveInput>;
type LeaveDecisionInput = z.infer<typeof leaveDecisionInput>;
type AdvanceInput = z.infer<typeof advanceInput>;
type AdvanceDecisionInput = z.infer<typeof advanceDecisionInput>;
type SalaryPaymentInput = z.infer<typeof salaryPaymentInput>;
type EmployeeProfileInput = z.infer<typeof employeeProfileInput>;

const memberInclude = {
  user: { select: { id: true, name: true, email: true, phone: true } },
  branch: { select: { id: true, name: true } },
  staffProfile: true,
} satisfies Prisma.MembershipInclude;

function todayInput(context: TenantContext) {
  return zonedDateInput(new Date(), context.salon.timezone);
}

function monthRange(context: TenantContext) {
  const today = todayInput(context);
  const start = `${today.slice(0, 8)}01`;
  const endDate = new Date(`${today.slice(0, 8)}01T12:00:00.000Z`);
  endDate.setUTCMonth(endDate.getUTCMonth() + 1);
  endDate.setUTCDate(0);
  const end = endDate.toISOString().slice(0, 10);
  return {
    from: zonedStartOfDay(start, context.salon.timezone),
    to: zonedDayBounds(end, context.salon.timezone).to,
    startDate: start,
    endDate: end,
  };
}

export function canSeeAllHr(context: TenantContext) {
  return context.permissions.includes("hr.read") || context.permissions.includes("hr.write");
}

export function assertHrWrite(context: TenantContext) {
  if (!context.permissions.includes("hr.write")) throw forbidden("You cannot manage staff records");
}

export function maskAadhaar(value: string | null) {
  if (!value) return null;
  try {
    const digits = decryptSecret(value).replace(/\s+/g, "");
    return `XXXX XXXX ${digits.slice(-4)}`;
  } catch {
    return "Saved securely";
  }
}

export function maskPan(value: string | null) {
  if (!value) return null;
  try {
    const text = decryptSecret(value).toUpperCase();
    return `${text.slice(0, 2)}XXXXX${text.slice(-3)}`;
  } catch {
    return "Saved securely";
  }
}

export function employeeProfileDto(profile: {
  jobTitle: string | null;
  employmentType: string;
  hiredAt: Date | null;
  monthlySalary: Prisma.Decimal | null;
  payDay: number;
  address: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  aadhaarNumber: string | null;
  panNumber: string | null;
  onboardingComplete: boolean;
} | null) {
  if (!profile) {
    return {
      jobTitle: null,
      employmentType: "FULL_TIME",
      hiredAt: null,
      monthlySalary: 0,
      payDay: 1,
      address: null,
      emergencyContactName: null,
      emergencyContactPhone: null,
      aadhaarMasked: null,
      panMasked: null,
      hasAadhaar: false,
      hasPan: false,
      onboardingComplete: false,
    };
  }
  return {
    jobTitle: profile.jobTitle,
    employmentType: profile.employmentType,
    hiredAt: profile.hiredAt ? isoDateOnly(profile.hiredAt) : null,
    monthlySalary: asNumber(profile.monthlySalary),
    payDay: profile.payDay,
    address: profile.address,
    emergencyContactName: profile.emergencyContactName,
    emergencyContactPhone: profile.emergencyContactPhone,
    aadhaarMasked: maskAadhaar(profile.aadhaarNumber),
    panMasked: maskPan(profile.panNumber),
    hasAadhaar: Boolean(profile.aadhaarNumber),
    hasPan: Boolean(profile.panNumber),
    onboardingComplete: profile.onboardingComplete,
  };
}

export type HrMember = {
  id: string;
  userId: string;
  name: string;
  email: string;
  phone: string | null;
  role: Role;
  branch: string | null;
  active: boolean;
  profile: ReturnType<typeof employeeProfileDto>;
  documents: number;
};

export async function listHrMembers(context: TenantContext): Promise<HrMember[]> {
  const members = await prisma.membership.findMany({
    where: { salonId: context.salon.id },
    include: { ...memberInclude, _count: { select: { employeeDocuments: true } } },
    orderBy: [{ active: "desc" }, { user: { name: "asc" } }],
  });
  return members.map((member) => ({
    id: member.id,
    userId: member.user.id,
    name: member.user.name,
    email: member.user.email,
    phone: member.user.phone,
    role: member.role,
    branch: member.branch?.name || null,
    active: member.active,
    profile: employeeProfileDto(member.staffProfile),
    documents: member._count.employeeDocuments,
  }));
}

export async function getHrSummary(context: TenantContext) {
  const date = dateOnlyFromInput(todayInput(context));
  const range = monthRange(context);
  const [members, records, pendingLeave, pendingAdvances, payroll, missingDocs] = await Promise.all([
    prisma.membership.count({ where: { salonId: context.salon.id, active: true } }),
    prisma.attendanceRecord.groupBy({
      by: ["status"],
      where: { salonId: context.salon.id, date },
      _count: true,
    }),
    prisma.leaveRequest.count({ where: { salonId: context.salon.id, status: "PENDING" } }),
    prisma.salaryAdvance.aggregate({
      where: { salonId: context.salon.id, status: { in: ["PENDING", "APPROVED"] } },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.salaryPayment.aggregate({
      where: { salonId: context.salon.id, paidAt: { gte: range.from, lte: range.to } },
      _sum: { netAmount: true },
      _count: true,
    }),
    prisma.membership.count({
      where: {
        salonId: context.salon.id,
        active: true,
        OR: [{ staffProfile: null }, { staffProfile: { aadhaarNumber: null } }, { staffProfile: { panNumber: null } }],
      },
    }),
  ]);
  const counts = new Map(records.map((row) => [row.status, row._count]));
  const marked = [...counts.values()].reduce((sum, value) => sum + value, 0);
  return {
    date: todayInput(context),
    members,
    present: counts.get("PRESENT") || 0,
    onLeave: counts.get("LEAVE") || 0,
    absent: counts.get("ABSENT") || 0,
    unmarked: Math.max(0, members - marked),
    pendingLeave,
    pendingAdvanceCount: pendingAdvances._count,
    pendingAdvanceAmount: asNumber(pendingAdvances._sum.amount),
    payrollThisMonth: asNumber(payroll._sum.netAmount),
    payrollCount: payroll._count,
    missingDocs,
  };
}

export async function listAttendance(context: TenantContext, date: string) {
  const day = dateOnlyFromInput(date);
  const [members, records] = await Promise.all([
    prisma.membership.findMany({
      where: { salonId: context.salon.id, active: true },
      include: memberInclude,
      orderBy: { user: { name: "asc" } },
    }),
    prisma.attendanceRecord.findMany({
      where: { salonId: context.salon.id, date: day },
    }),
  ]);
  const recordMap = new Map(records.map((record) => [record.membershipId, record]));
  return members.map((member) => {
    const record = recordMap.get(member.id);
    return {
      membershipId: member.id,
      name: member.user.name,
      role: member.role,
      branch: member.branch?.name || null,
      jobTitle: member.staffProfile?.jobTitle || null,
      color: member.staffProfile?.color || null,
      recordId: record?.id || null,
      status: record?.status || null,
      checkIn: record?.checkInAt ? record.checkInAt.toISOString() : null,
      checkOut: record?.checkOutAt ? record.checkOutAt.toISOString() : null,
      workedMinutes: record?.workedMinutes || null,
      notes: record?.notes || null,
    };
  });
}

async function ensureMember(context: TenantContext, membershipId: string) {
  const member = await prisma.membership.findFirst({
    where: { id: membershipId, salonId: context.salon.id },
    include: { user: { select: { name: true } }, staffProfile: true },
  });
  if (!member) throw notFound("Staff member not found");
  return member;
}

function attendanceTimes(context: TenantContext, input: { date: string; checkIn: string | null; checkOut: string | null }) {
  const checkInAt = input.checkIn
    ? zonedDateTimeToUtc(`${input.date}T${input.checkIn}`, context.salon.timezone)
    : null;
  const checkOutAt = input.checkOut
    ? zonedDateTimeToUtc(`${input.date}T${input.checkOut}`, context.salon.timezone)
    : null;
  const workedMinutes =
    checkInAt && checkOutAt && checkOutAt > checkInAt
      ? Math.round((checkOutAt.getTime() - checkInAt.getTime()) / 60000)
      : null;
  return { checkInAt, checkOutAt, workedMinutes };
}

async function upsertAttendance(context: TenantContext, input: AttendanceInput, memberName: string) {
  const { checkInAt, checkOutAt, workedMinutes } = attendanceTimes(context, input);
  const record = await prisma.attendanceRecord.upsert({
    where: { membershipId_date: { membershipId: input.membershipId, date: dateOnlyFromInput(input.date) } },
    create: {
      salonId: context.salon.id,
      membershipId: input.membershipId,
      date: dateOnlyFromInput(input.date),
      status: input.status,
      checkInAt,
      checkOutAt,
      workedMinutes,
      notes: input.notes || null,
      markedById: context.user.id,
    },
    update: {
      status: input.status,
      checkInAt,
      checkOutAt,
      workedMinutes,
      notes: input.notes || null,
      markedById: context.user.id,
    },
  });
  await recordAudit({
    salonId: context.salon.id,
    actorUserId: context.user.id,
    action: "attendance.marked",
    entityType: "AttendanceRecord",
    entityId: record.id,
    metadata: { member: memberName, date: input.date, status: input.status },
  });
  return record;
}

export async function markAttendance(context: TenantContext, input: AttendanceInput) {
  assertHrWrite(context);
  const member = await ensureMember(context, input.membershipId);
  const record = await upsertAttendance(context, input, member.user.name);
  return { id: record.id, date: isoDateOnly(record.date), status: record.status };
}

export async function deleteAttendance(context: TenantContext, recordId: string) {
  assertHrWrite(context);
  const record = await prisma.attendanceRecord.findFirst({
    where: { id: recordId, salonId: context.salon.id },
    include: { membership: { include: { user: { select: { name: true } } } } },
  });
  if (!record) throw notFound("Attendance record not found");
  await prisma.attendanceRecord.delete({ where: { id: recordId } });
  await recordAudit({
    salonId: context.salon.id,
    actorUserId: context.user.id,
    action: "attendance.cleared",
    entityType: "AttendanceRecord",
    entityId: recordId,
    metadata: { member: record.membership.user.name, date: isoDateOnly(record.date) },
  });
  return { id: recordId };
}

export async function bulkMarkAttendance(context: TenantContext, input: AttendanceBulkInput) {
  assertHrWrite(context);
  const members = await prisma.membership.findMany({
    where: { id: { in: input.membershipIds }, salonId: context.salon.id },
    include: { user: { select: { name: true } } },
  });
  if (members.length !== input.membershipIds.length) throw badRequest("One or more staff members were not found");
  for (const member of members) {
    await upsertAttendance(
      context,
      {
        membershipId: member.id,
        date: input.date,
        status: input.status,
        checkIn: null,
        checkOut: null,
        notes: null,
      },
      member.user.name,
    );
  }
  await recordAudit({
    salonId: context.salon.id,
    actorUserId: context.user.id,
    action: "attendance.bulk_marked",
    entityType: "AttendanceRecord",
    metadata: { date: input.date, status: input.status, count: members.length },
  });
  return { count: members.length };
}

function eachDate(start: string, end: string, limit = 62) {
  const dates: string[] = [];
  const cursor = new Date(`${start}T00:00:00.000Z`);
  const last = new Date(`${end}T00:00:00.000Z`);
  while (cursor <= last && dates.length < limit) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

export async function listLeaveRequests(context: TenantContext, filter: { status?: LeaveStatus; membershipId?: string }) {
  if (!canSeeAllHr(context) && filter.membershipId !== context.membership.id) {
    throw forbidden("You can only see your own leave requests");
  }
  const requests = await prisma.leaveRequest.findMany({
    where: {
      salonId: context.salon.id,
      ...(filter.status ? { status: filter.status } : {}),
      ...(filter.membershipId ? { membershipId: filter.membershipId } : {}),
    },
    include: { membership: { include: { user: { select: { name: true } } } }, decidedBy: { select: { name: true } } },
    orderBy: [{ status: "asc" }, { startDate: "desc" }],
    take: 200,
  });
  return requests.map((request) => ({
    id: request.id,
    membershipId: request.membershipId,
    member: request.membership.user.name,
    type: request.type,
    startDate: isoDateOnly(request.startDate),
    endDate: isoDateOnly(request.endDate),
    days: eachDate(isoDateOnly(request.startDate), isoDateOnly(request.endDate)).length,
    reason: request.reason,
    status: request.status,
    decisionNote: request.decisionNote,
    decidedBy: request.decidedBy?.name || null,
    decidedAt: request.decidedAt ? request.decidedAt.toISOString() : null,
    createdAt: request.createdAt.toISOString(),
  }));
}

export async function createLeaveRequest(context: TenantContext, input: LeaveInput) {
  const membershipId = input.membershipId || context.membership.id;
  if (!canSeeAllHr(context) && membershipId !== context.membership.id) {
    throw forbidden("You can only request leave for yourself");
  }
  const member = await ensureMember(context, membershipId);
  if (!member.active) throw badRequest("This staff member is inactive");
  const leave = await prisma.leaveRequest.create({
    data: {
      salonId: context.salon.id,
      membershipId,
      type: input.type,
      startDate: dateOnlyFromInput(input.startDate),
      endDate: dateOnlyFromInput(input.endDate),
      reason: input.reason,
    },
  });
  await recordAudit({
    salonId: context.salon.id,
    actorUserId: context.user.id,
    action: "leave.requested",
    entityType: "LeaveRequest",
    entityId: leave.id,
    metadata: { member: member.user.name, startDate: input.startDate, endDate: input.endDate, type: input.type },
  });
  return { id: leave.id };
}

export async function decideLeaveRequest(context: TenantContext, leaveId: string, input: LeaveDecisionInput) {
  const leave = await prisma.leaveRequest.findFirst({
    where: { id: leaveId, salonId: context.salon.id },
    include: { membership: { include: { user: { select: { name: true } } } } },
  });
  if (!leave) throw notFound("Leave request not found");
  if (
    input.status !== "CANCELLED" ||
    leave.membershipId !== context.membership.id ||
    !context.permissions.includes("hr.self")
  ) {
    assertHrWrite(context);
  }
  if (leave.status !== "PENDING" && input.status !== "CANCELLED") throw conflict("This leave request is already decided");
  if (leave.membershipId === context.membership.id && input.status !== "CANCELLED") {
    throw badRequest("You cannot approve or reject your own leave request");
  }
  if (input.status === "CANCELLED" && !canSeeAllHr(context) && leave.membershipId !== context.membership.id) {
    throw forbidden("You can only cancel your own leave request");
  }
  const updated = await prisma.$transaction(async (tx) => {
    const record = await tx.leaveRequest.update({
      where: { id: leaveId },
      data: {
        status: input.status,
        decidedById: context.user.id,
        decidedAt: new Date(),
        decisionNote: input.decisionNote || null,
      },
    });
    if (input.status === "APPROVED") {
      for (const date of eachDate(isoDateOnly(leave.startDate), isoDateOnly(leave.endDate))) {
        await tx.attendanceRecord.upsert({
          where: { membershipId_date: { membershipId: leave.membershipId, date: dateOnlyFromInput(date) } },
          create: {
            salonId: context.salon.id,
            membershipId: leave.membershipId,
            date: dateOnlyFromInput(date),
            status: "LEAVE",
            notes: `Approved ${leave.type.toLowerCase()} leave`,
            markedById: context.user.id,
          },
          update: { status: "LEAVE", notes: `Approved ${leave.type.toLowerCase()} leave`, markedById: context.user.id },
        });
      }
    }
    return record;
  });
  await recordAudit({
    salonId: context.salon.id,
    actorUserId: context.user.id,
    action: `leave.${input.status.toLowerCase()}`,
    entityType: "LeaveRequest",
    entityId: leaveId,
    metadata: { member: leave.membership.user.name, startDate: isoDateOnly(leave.startDate), endDate: isoDateOnly(leave.endDate) },
  });
  return { id: updated.id, status: updated.status };
}

export async function listAdvances(context: TenantContext, filter: { status?: string; membershipId?: string }) {
  if (!canSeeAllHr(context) && filter.membershipId !== context.membership.id) {
    throw forbidden("You can only see your own advances");
  }
  const rows = await prisma.salaryAdvance.findMany({
    where: {
      salonId: context.salon.id,
      ...(filter.status ? { status: filter.status as never } : {}),
      ...(filter.membershipId ? { membershipId: filter.membershipId } : {}),
    },
    include: { membership: { include: { user: { select: { name: true } } } }, decidedBy: { select: { name: true } } },
    orderBy: [{ status: "asc" }, { requestedAt: "desc" }],
    take: 200,
  });
  return rows.map((row) => ({
    id: row.id,
    membershipId: row.membershipId,
    member: row.membership.user.name,
    amount: asNumber(row.amount),
    reason: row.reason,
    requestedAt: row.requestedAt.toISOString(),
    status: row.status,
    decidedBy: row.decidedBy?.name || null,
    decidedAt: row.decidedAt ? row.decidedAt.toISOString() : null,
    paidAt: row.paidAt ? row.paidAt.toISOString() : null,
    notes: row.notes,
  }));
}

export async function createAdvance(context: TenantContext, input: AdvanceInput) {
  const membershipId = input.membershipId || context.membership.id;
  if (!canSeeAllHr(context) && membershipId !== context.membership.id) {
    throw forbidden("You can only request an advance for yourself");
  }
  const member = await ensureMember(context, membershipId);
  const requestedAt = input.requestedAt ? dateOnlyFromInput(input.requestedAt) : new Date();
  const advance = await prisma.salaryAdvance.create({
    data: {
      salonId: context.salon.id,
      membershipId,
      amount: input.amount,
      reason: input.reason || null,
      requestedAt,
      createdById: context.user.id,
    },
  });
  await recordAudit({
    salonId: context.salon.id,
    actorUserId: context.user.id,
    action: "advance.requested",
    entityType: "SalaryAdvance",
    entityId: advance.id,
    metadata: { member: member.user.name, amount: input.amount },
  });
  return { id: advance.id };
}

export async function decideAdvance(context: TenantContext, advanceId: string, input: AdvanceDecisionInput) {
  assertHrWrite(context);
  const advance = await prisma.salaryAdvance.findFirst({
    where: { id: advanceId, salonId: context.salon.id },
    include: { membership: { include: { user: { select: { name: true } } } } },
  });
  if (!advance) throw notFound("Advance request not found");
  if (advance.status === "PAID" || advance.status === "REJECTED") throw conflict("This advance is already closed");
  if (advance.membershipId === context.membership.id) throw badRequest("You cannot decide your own advance request");
  if (input.status === "REJECTED" && advance.status !== "PENDING") throw conflict("Only pending advances can be rejected");
  const paidAt = input.status === "PAID" ? new Date() : advance.paidAt;
  const updated = await prisma.salaryAdvance.update({
    where: { id: advanceId },
    data: {
      status: input.status,
      decidedById: context.user.id,
      decidedAt: new Date(),
      paidAt,
      notes: input.notes || advance.notes,
    },
  });
  await recordAudit({
    salonId: context.salon.id,
    actorUserId: context.user.id,
    action: `advance.${input.status.toLowerCase()}`,
    entityType: "SalaryAdvance",
    entityId: advanceId,
    metadata: { member: advance.membership.user.name, amount: asNumber(advance.amount) },
  });
  return { id: updated.id, status: updated.status };
}

export async function listSalaryPayments(
  context: TenantContext,
  filter: { membershipId?: string; from?: string; to?: string },
) {
  if (!canSeeAllHr(context) && filter.membershipId !== context.membership.id) {
    throw forbidden("You can only see your own salary records");
  }
  const from = filter.from ? dateOnlyFromInput(filter.from) : undefined;
  const to = filter.to ? dateOnlyFromInput(filter.to) : undefined;
  const rows = await prisma.salaryPayment.findMany({
    where: {
      salonId: context.salon.id,
      ...(filter.membershipId ? { membershipId: filter.membershipId } : {}),
      ...(from || to ? { periodStart: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
    },
    include: { membership: { include: { user: { select: { name: true } } } } },
    orderBy: { paidAt: "desc" },
    take: 200,
  });
  return rows.map((row) => ({
    id: row.id,
    membershipId: row.membershipId,
    member: row.membership.user.name,
    periodStart: isoDateOnly(row.periodStart),
    periodEnd: isoDateOnly(row.periodEnd),
    baseAmount: asNumber(row.baseAmount),
    bonus: asNumber(row.bonus),
    deductions: asNumber(row.deductions),
    advanceDeduction: asNumber(row.advanceDeduction),
    netAmount: asNumber(row.netAmount),
    method: row.method,
    status: row.status,
    paidAt: row.paidAt.toISOString(),
    notes: row.notes,
  }));
}

export async function createSalaryPayment(context: TenantContext, input: SalaryPaymentInput) {
  assertHrWrite(context);
  if (input.periodEnd < input.periodStart) throw badRequest("The pay period end must be after the start");
  const member = await ensureMember(context, input.membershipId);
  const netAmount = roundMoney(
    Math.max(0, input.baseAmount + input.bonus - input.deductions - input.advanceDeduction),
  );
  const existing = await prisma.salaryPayment.findUnique({
    where: {
      membershipId_periodStart_periodEnd: {
        membershipId: input.membershipId,
        periodStart: dateOnlyFromInput(input.periodStart),
        periodEnd: dateOnlyFromInput(input.periodEnd),
      },
    },
  });
  if (existing) throw conflict("Salary for this period is already recorded");
  const payment = await prisma.salaryPayment.create({
    data: {
      salonId: context.salon.id,
      membershipId: input.membershipId,
      periodStart: dateOnlyFromInput(input.periodStart),
      periodEnd: dateOnlyFromInput(input.periodEnd),
      baseAmount: input.baseAmount,
      bonus: input.bonus,
      deductions: input.deductions,
      advanceDeduction: input.advanceDeduction,
      netAmount,
      method: input.method,
      status: "PAID",
      paidAt: input.paidAt || new Date(),
      notes: input.notes || null,
      createdById: context.user.id,
    },
  });
  await recordAudit({
    salonId: context.salon.id,
    actorUserId: context.user.id,
    action: "salary.paid",
    entityType: "SalaryPayment",
    entityId: payment.id,
    metadata: { member: member.user.name, periodStart: input.periodStart, periodEnd: input.periodEnd, netAmount },
  });
  return { id: payment.id, netAmount };
}

export async function deleteSalaryPayment(context: TenantContext, paymentId: string) {
  assertHrWrite(context);
  if (!["OWNER", "ADMIN"].includes(context.role)) throw forbidden("Only an owner or administrator can delete salary records");
  const payment = await prisma.salaryPayment.findFirst({ where: { id: paymentId, salonId: context.salon.id } });
  if (!payment) throw notFound("Salary record not found");
  await prisma.salaryPayment.delete({ where: { id: paymentId } });
  await recordAudit({
    salonId: context.salon.id,
    actorUserId: context.user.id,
    action: "salary.deleted",
    entityType: "SalaryPayment",
    entityId: paymentId,
    metadata: { netAmount: asNumber(payment.netAmount) },
  });
  return { id: paymentId };
}

export async function updateEmployeeProfile(context: TenantContext, membershipId: string, input: EmployeeProfileInput) {
  assertHrWrite(context);
  const member = await ensureMember(context, membershipId);
  let aadhaarNumber: string | undefined;
  let panNumber: string | undefined;
  if (input.aadhaarNumber !== undefined) {
    aadhaarNumber = input.aadhaarNumber ? encryptSecret(input.aadhaarNumber.replace(/\s+/g, "")) : "";
  }
  if (input.panNumber !== undefined) {
    panNumber = input.panNumber ? encryptSecret(input.panNumber.toUpperCase().replace(/\s+/g, "")) : "";
  }
  const profile = await prisma.staffProfile.upsert({
    where: { membershipId },
    create: {
      membershipId,
      jobTitle: input.jobTitle || null,
      employmentType: input.employmentType || "FULL_TIME",
      hiredAt: input.hiredAt ? dateOnlyFromInput(input.hiredAt) : null,
      monthlySalary: input.monthlySalary || null,
      payDay: input.payDay || 1,
      address: input.address || null,
      emergencyContactName: input.emergencyContactName || null,
      emergencyContactPhone: input.emergencyContactPhone || null,
      aadhaarNumber: aadhaarNumber || null,
      panNumber: panNumber || null,
      onboardingComplete: input.onboardingComplete || false,
    },
    update: {
      ...(input.jobTitle !== undefined ? { jobTitle: input.jobTitle } : {}),
      ...(input.employmentType !== undefined ? { employmentType: input.employmentType } : {}),
      ...(input.hiredAt !== undefined ? { hiredAt: input.hiredAt ? dateOnlyFromInput(input.hiredAt) : null } : {}),
      ...(input.monthlySalary !== undefined ? { monthlySalary: input.monthlySalary } : {}),
      ...(input.payDay !== undefined ? { payDay: input.payDay } : {}),
      ...(input.address !== undefined ? { address: input.address } : {}),
      ...(input.emergencyContactName !== undefined ? { emergencyContactName: input.emergencyContactName } : {}),
      ...(input.emergencyContactPhone !== undefined ? { emergencyContactPhone: input.emergencyContactPhone } : {}),
      ...(aadhaarNumber !== undefined ? { aadhaarNumber: aadhaarNumber || null } : {}),
      ...(panNumber !== undefined ? { panNumber: panNumber || null } : {}),
      ...(input.onboardingComplete !== undefined ? { onboardingComplete: input.onboardingComplete } : {}),
    },
  });
  await recordAudit({
    salonId: context.salon.id,
    actorUserId: context.user.id,
    action: "employee.updated",
    entityType: "Membership",
    entityId: membershipId,
    metadata: { member: member.user.name },
  });
  return employeeProfileDto(profile);
}

export async function listDocuments(context: TenantContext, membershipId?: string) {
  if (!canSeeAllHr(context) && membershipId && membershipId !== context.membership.id) {
    throw forbidden("You can only see your own documents");
  }
  const scope = canSeeAllHr(context) ? membershipId : context.membership.id;
  const rows = await prisma.employeeDocument.findMany({
    where: { salonId: context.salon.id, ...(scope ? { membershipId: scope } : {}) },
    include: { membership: { include: { user: { select: { name: true } } } }, file: true },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((row) => ({
    id: row.id,
    membershipId: row.membershipId,
    member: row.membership.user.name,
    kind: row.kind,
    title: row.title,
    fileName: row.file.originalName,
    fileId: row.fileId,
    mimeType: row.file.mimeType,
    size: row.file.size,
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function attachEmployeeDocument(
  context: TenantContext,
  input: { membershipId: string; kind: "AADHAAR" | "PAN" | "PHOTO" | "CONTRACT" | "OTHER"; title: string; fileId: string },
) {
  assertHrWrite(context);
  const member = await ensureMember(context, input.membershipId);
  const file = await prisma.fileAsset.findFirst({
    where: { id: input.fileId, salonId: context.salon.id, kind: "DOCUMENT" },
  });
  if (!file) throw badRequest("Upload the file first");
  const document = await prisma.employeeDocument.create({
    data: {
      salonId: context.salon.id,
      membershipId: input.membershipId,
      kind: input.kind,
      title: input.title,
      fileId: input.fileId,
      uploadedById: context.user.id,
    },
  });
  await recordAudit({
    salonId: context.salon.id,
    actorUserId: context.user.id,
    action: "employee.document_added",
    entityType: "EmployeeDocument",
    entityId: document.id,
    metadata: { member: member.user.name, kind: input.kind, title: input.title },
  });
  return { id: document.id };
}

export async function deleteEmployeeDocument(context: TenantContext, documentId: string) {
  assertHrWrite(context);
  const document = await prisma.employeeDocument.findFirst({
    where: { id: documentId, salonId: context.salon.id },
    include: { file: true },
  });
  if (!document) throw notFound("Document not found");
  await prisma.employeeDocument.delete({ where: { id: documentId } });
  await removeStoredFile(document.file.relativePath).catch(() => {});
  await recordAudit({
    salonId: context.salon.id,
    actorUserId: context.user.id,
    action: "employee.document_removed",
    entityType: "EmployeeDocument",
    entityId: documentId,
    metadata: { title: document.title, kind: document.kind },
  });
  return { id: documentId };
}

export async function getEmployeePerformance(
  context: TenantContext,
  membershipId: string,
  from: Date,
  to: Date,
) {
  if (!canSeeAllHr(context) && membershipId !== context.membership.id) {
    throw forbidden("You can only see your own performance");
  }
  const member = await ensureMember(context, membershipId);
  const startDate = isoDateOnly(from);
  const endDate = isoDateOnly(to);
  const [appointments, completed, cancelled, noShow, lines, attendance, leaves, salaries, advances, services] =
    await Promise.all([
      prisma.appointment.count({ where: { salonId: context.salon.id, staffMembershipId: membershipId, startAt: { gte: from, lte: to } } }),
      prisma.appointment.count({
        where: { salonId: context.salon.id, staffMembershipId: membershipId, status: "COMPLETED", completedAt: { gte: from, lte: to } },
      }),
      prisma.appointment.count({
        where: { salonId: context.salon.id, staffMembershipId: membershipId, status: "CANCELLED", updatedAt: { gte: from, lte: to } },
      }),
      prisma.appointment.count({
        where: { salonId: context.salon.id, staffMembershipId: membershipId, status: "NO_SHOW", updatedAt: { gte: from, lte: to } },
      }),
      prisma.invoiceLine.groupBy({
        by: ["kind"],
        where: {
          staffMembershipId: membershipId,
          invoice: { salonId: context.salon.id, issuedAt: { gte: from, lte: to }, status: { notIn: ["VOID", "DRAFT"] } },
        },
        _sum: { lineTotal: true, commissionAmount: true },
        _count: true,
      }),
      prisma.attendanceRecord.groupBy({
        by: ["status"],
        where: { salonId: context.salon.id, membershipId, date: { gte: dateOnlyFromInput(startDate), lte: dateOnlyFromInput(endDate) } },
        _count: true,
      }),
      prisma.leaveRequest.aggregate({
        where: { salonId: context.salon.id, membershipId, status: "APPROVED", startDate: { gte: dateOnlyFromInput(startDate), lte: dateOnlyFromInput(endDate) } },
        _count: true,
      }),
      prisma.salaryPayment.aggregate({
        where: { salonId: context.salon.id, membershipId, paidAt: { gte: from, lte: to } },
        _sum: { netAmount: true },
        _count: true,
      }),
      prisma.salaryAdvance.aggregate({
        where: { salonId: context.salon.id, membershipId, status: "PAID", paidAt: { gte: from, lte: to } },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.invoiceLine.findMany({
        where: {
          staffMembershipId: membershipId,
          kind: "SERVICE",
          invoice: { salonId: context.salon.id, issuedAt: { gte: from, lte: to }, status: { notIn: ["VOID", "DRAFT"] } },
        },
        select: { description: true, quantity: true, lineTotal: true },
        take: 1000,
      }),
    ]);
  const revenue = roundMoney(lines.reduce((sum, line) => sum + asNumber(line._sum.lineTotal), 0));
  const commission = roundMoney(lines.reduce((sum, line) => sum + asNumber(line._sum.commissionAmount), 0));
  const statusCounts = new Map(attendance.map((row) => [row.status, row._count]));
  const serviceMap = new Map<string, { name: string; count: number; revenue: number }>();
  services.forEach((line) => {
    const item = serviceMap.get(line.description) || { name: line.description, count: 0, revenue: 0 };
    item.count += Math.round(asNumber(line.quantity));
    item.revenue = roundMoney(item.revenue + asNumber(line.lineTotal));
    serviceMap.set(line.description, item);
  });
  const totalMarked = attendance.reduce((sum, row) => sum + row._count, 0);
  const present = (statusCounts.get("PRESENT") || 0) + (statusCounts.get("HALF_DAY") || 0);
  return {
    member: { id: member.id, name: member.user.name, role: member.role, jobTitle: member.staffProfile?.jobTitle || null },
    period: { from: startDate, to: endDate },
    appointments,
    completed,
    cancelled,
    noShow,
    completionRate: appointments ? Math.round((completed / appointments) * 1000) / 10 : 0,
    revenue,
    commission,
    attendance: {
      marked: totalMarked,
      present,
      absent: statusCounts.get("ABSENT") || 0,
      leave: statusCounts.get("LEAVE") || 0,
      rate: totalMarked ? Math.round((present / totalMarked) * 1000) / 10 : 0,
      breakdown: Object.fromEntries(statusCounts),
    },
    approvedLeaves: leaves._count,
    salaryPaid: asNumber(salaries._sum.netAmount),
    salaryPayments: salaries._count,
    advancesPaid: asNumber(advances._sum.amount),
    advancesCount: advances._count,
    topServices: [...serviceMap.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 6),
  };
}

export async function getMyWork(context: TenantContext) {
  const today = todayInput(context);
  const range = monthRange(context);
  const [attendance, leaves, advances, salaries, documents, performance, pendingLeave, pendingAdvance] = await Promise.all([
    prisma.attendanceRecord.findMany({
      where: { salonId: context.salon.id, membershipId: context.membership.id, date: { gte: dateOnlyFromInput(range.startDate), lte: dateOnlyFromInput(range.endDate) } },
      orderBy: { date: "desc" },
    }),
    prisma.leaveRequest.findMany({
      where: { salonId: context.salon.id, membershipId: context.membership.id },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.salaryAdvance.findMany({
      where: { salonId: context.salon.id, membershipId: context.membership.id },
      orderBy: { requestedAt: "desc" },
      take: 20,
    }),
    prisma.salaryPayment.findMany({
      where: { salonId: context.salon.id, membershipId: context.membership.id },
      orderBy: { paidAt: "desc" },
      take: 12,
    }),
    prisma.employeeDocument.findMany({
      where: { salonId: context.salon.id, membershipId: context.membership.id },
      include: { file: true },
      orderBy: { createdAt: "desc" },
    }),
    getEmployeePerformance(context, context.membership.id, range.from, range.to),
    prisma.leaveRequest.aggregate({
      where: { salonId: context.salon.id, membershipId: context.membership.id, status: "PENDING" },
      _count: true,
    }),
    prisma.salaryAdvance.aggregate({
      where: { salonId: context.salon.id, membershipId: context.membership.id, status: { in: ["PENDING", "APPROVED"] } },
      _sum: { amount: true },
      _count: true,
    }),
  ]);
  const summaryRows = await prisma.attendanceRecord.groupBy({
    by: ["status"],
    where: { salonId: context.salon.id, membershipId: context.membership.id, date: { gte: dateOnlyFromInput(range.startDate), lte: dateOnlyFromInput(range.endDate) } },
    _count: true,
  });
  const statusCounts = new Map(summaryRows.map((row) => [row.status, row._count]));
  return {
    today,
    monthStart: range.startDate,
    monthEnd: range.endDate,
    attendance: attendance.map((record) => ({
      id: record.id,
      date: isoDateOnly(record.date),
      status: record.status,
      checkIn: record.checkInAt ? record.checkInAt.toISOString() : null,
      checkOut: record.checkOutAt ? record.checkOutAt.toISOString() : null,
      workedMinutes: record.workedMinutes,
      notes: record.notes,
    })),
    attendanceSummary: {
      present: statusCounts.get("PRESENT") || 0,
      halfDay: statusCounts.get("HALF_DAY") || 0,
      absent: statusCounts.get("ABSENT") || 0,
      leave: statusCounts.get("LEAVE") || 0,
      marked: [...statusCounts.values()].reduce((sum, value) => sum + value, 0),
    },
    leaves: leaves.map((leave) => ({
      id: leave.id,
      type: leave.type,
      startDate: isoDateOnly(leave.startDate),
      endDate: isoDateOnly(leave.endDate),
      reason: leave.reason,
      status: leave.status,
      decisionNote: leave.decisionNote,
      createdAt: leave.createdAt.toISOString(),
    })),
    advances: advances.map((advance) => ({
      id: advance.id,
      amount: asNumber(advance.amount),
      reason: advance.reason,
      status: advance.status,
      requestedAt: advance.requestedAt.toISOString(),
      paidAt: advance.paidAt ? advance.paidAt.toISOString() : null,
    })),
    salaries: salaries.map((salary) => ({
      id: salary.id,
      periodStart: isoDateOnly(salary.periodStart),
      periodEnd: isoDateOnly(salary.periodEnd),
      netAmount: asNumber(salary.netAmount),
      method: salary.method,
      paidAt: salary.paidAt.toISOString(),
      notes: salary.notes,
    })),
    documents: documents.map((document) => ({
      id: document.id,
      kind: document.kind,
      title: document.title,
      fileName: document.file.originalName,
      fileId: document.fileId,
      size: document.file.size,
      createdAt: document.createdAt.toISOString(),
    })),
    performance,
    pendingLeave: pendingLeave._count,
    pendingAdvanceCount: pendingAdvance._count,
    pendingAdvanceAmount: asNumber(pendingAdvance._sum.amount),
    latestAttendance: attendance.find((record) => isoDateOnly(record.date) === today) || null,
    profile: employeeProfileDto(await prisma.staffProfile.findUnique({ where: { membershipId: context.membership.id } })),
  };
}
