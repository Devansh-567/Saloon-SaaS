import { z } from "zod";
import { emailSchema, passwordSchema, phoneSchema } from "./security";
import { PERMISSIONS } from "./permissions";
import { salonSettingsSchema } from "./settings";

export const nullableId = z
  .union([z.string().cuid(), z.literal(""), z.null()])
  .optional()
  .transform((v) => (v ? v : null));

export const optionalText = z
  .string()
  .trim()
  .max(2000)
  .optional()
  .transform((v) => (v ? v : undefined));

export const dateOnlyInput = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date");
const optionalDateOnly = z
  .union([dateOnlyInput, z.literal(""), z.null()])
  .optional()
  .transform((v) => v || null);

export const customerInput = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().max(80).default(""),
  phone: phoneSchema,
  email: z.union([emailSchema, z.literal("")]).optional().transform((v) => v || null),
  notes: optionalText,
  preferences: z.string().trim().max(1000).optional().nullable(),
  tags: z.array(z.string().trim().min(1).max(30)).max(15).default([]),
  birthday: optionalDateOnly,
  anniversary: optionalDateOnly,
  preferredStaffMembershipId: nullableId,
  marketingOptIn: z.boolean().default(false),
  source: z.string().trim().max(80).optional().nullable(),
});

export const customerNoteInput = z.object({
  body: z.string().trim().min(1).max(2000),
});

export const followUpInput = z.object({
  title: z.string().trim().min(2).max(160),
  notes: z.string().trim().max(2000).optional().nullable(),
  dueAt: z.coerce.date(),
  assignedToMembershipId: nullableId,
});

export const followUpUpdate = z
  .object({
    status: z.enum(["OPEN", "DONE", "CANCELLED"]).optional(),
    title: z.string().trim().min(2).max(160).optional(),
    notes: z.string().trim().max(2000).optional().nullable(),
    dueAt: z.coerce.date().optional(),
    assignedToMembershipId: nullableId,
  })
  .refine((data) => Object.values(data).some((v) => v !== undefined), "No changes supplied");

export const appointmentInput = z.object({
  customerId: z.string().cuid(),
  branchId: z.string().cuid(),
  serviceId: z.string().cuid(),
  staffMembershipId: z.string().cuid(),
  startAt: z.coerce.date(),
  notes: optionalText,
  walkIn: z.boolean().default(false),
});

export const appointmentUpdate = z
  .object({
    status: z
      .enum(["SCHEDULED", "CONFIRMED", "CHECKED_IN", "IN_PROGRESS", "COMPLETED", "CANCELLED", "NO_SHOW"])
      .optional(),
    startAt: z.coerce.date().optional(),
    staffMembershipId: z.string().cuid().optional(),
    serviceId: z.string().cuid().optional(),
    notes: z.string().trim().max(2000).optional().nullable(),
  })
  .refine((data) => Object.values(data).some((v) => v !== undefined), "No changes supplied");

export const queueInput = z.object({
  branchId: z.string().cuid(),
  name: z.string().trim().min(1).max(120),
  phone: phoneSchema.optional(),
  customerId: nullableId,
  serviceId: nullableId,
  staffMembershipId: nullableId,
  notes: optionalText,
});

export const queueUpdate = z.object({
  status: z.enum(["WAITING", "CALLED", "SERVING", "DONE", "CANCELLED"]),
});

export const serviceInput = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(1000).optional().nullable(),
  categoryId: nullableId,
  taxRateId: nullableId,
  price: z.number().min(0).max(10000000),
  durationMin: z.number().int().min(5).max(1440),
  commissionRate: z.number().min(0).max(100).optional().nullable(),
  active: z.boolean().default(true),
  productUsage: z
    .array(z.object({ productId: z.string().cuid(), quantity: z.number().int().min(1).max(1000) }))
    .max(100)
    .default([]),
});

export const serviceUpdate = serviceInput.partial().refine((data) => Object.values(data).some((v) => v !== undefined), "No changes supplied");

export const categoryInput = z.object({ name: z.string().trim().min(1).max(80) });
export const taxRateInput = z.object({
  name: z.string().trim().min(1).max(80),
  rate: z.number().min(0).max(100),
  active: z.boolean().default(true),
});

export const checkoutPaymentInput = z.object({
  amount: z.number().positive().max(100000000),
  method: z.enum(["CASH", "CARD", "UPI", "BANK", "OTHER"]),
  reference: z.string().trim().max(120).optional().nullable(),
});

export const invoiceInput = z.object({
  // Walk-in customers are allowed: leave customerId empty.
  customerId: nullableId,
  branchId: z.string().cuid(),
  appointmentId: nullableId,
  discount: z.number().min(0).default(0),
  notes: optionalText,
  // Optional payments taken at checkout (supports split payments).
  payments: z.array(checkoutPaymentInput).max(5).default([]),
  // Client-generated key so a double-click / retry cannot create two bills.
  idempotencyKey: z.string().trim().min(8).max(80).optional().nullable(),
  items: z
    .array(
      z.object({
        kind: z.enum(["SERVICE", "PRODUCT"]),
        serviceId: nullableId,
        productId: nullableId,
        staffMembershipId: nullableId,
        quantity: z.number().positive().max(999).default(1),
      }),
    )
    .min(1)
    .max(100),
});

export const paymentInput = z.object({
  amount: z.number().positive(),
  method: z.enum(["CASH", "CARD", "UPI", "BANK", "OTHER"]),
  reference: z.string().trim().max(120).optional().nullable(),
  notes: z.string().trim().max(500).optional().nullable(),
});

export const refundInput = z.object({
  amount: z.number().positive(),
  method: z.enum(["CASH", "CARD", "UPI", "BANK", "OTHER"]),
  reason: z.string().trim().min(2).max(500),
  // Put sold products back in stock (only allowed for a full refund).
  restockProducts: z.boolean().default(false),
});

export const productInput = z.object({
  name: z.string().trim().min(1).max(120),
  sku: z.string().trim().min(1).max(60),
  description: z.string().trim().max(1000).optional().nullable(),
  supplierId: nullableId,
  taxRateId: nullableId,
  price: z.number().min(0).max(10000000),
  cost: z.number().min(0).max(10000000),
  stockQty: z.number().int().min(0).max(1000000).default(0),
  reorderLevel: z.number().int().min(0).max(1000000).default(0),
  unit: z.string().trim().min(1).max(30).default("unit"),
  active: z.boolean().default(true),
});

export const productUpdate = productInput.partial().refine((data) => Object.values(data).some((v) => v !== undefined), "No changes supplied");

export const stockAdjustmentInput = z.object({
  productId: z.string().cuid(),
  delta: z.number().int().refine((v) => v !== 0, "Quantity change cannot be zero").refine((v) => Math.abs(v) <= 1000000, "Quantity too large"),
  notes: z.string().trim().min(2).max(300),
});

export const supplierInput = z.object({
  name: z.string().trim().min(1).max(120),
  phone: z.string().trim().max(30).optional().nullable(),
  email: z.union([emailSchema, z.literal("")]).optional().transform((v) => v || null),
  address: z.string().trim().max(500).optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable(),
});

export const purchaseInput = z.object({
  supplierId: nullableId,
  reference: z.string().trim().max(100).optional().nullable(),
  purchasedAt: z.coerce.date().default(() => new Date()),
  notes: optionalText,
  items: z
    .array(
      z.object({
        productId: z.string().cuid(),
        quantity: z.number().int().positive().max(100000),
        unitCost: z.number().min(0).max(10000000),
      }),
    )
    .min(1)
    .max(100),
});

export const expenseInput = z.object({
  branchId: nullableId,
  category: z.string().trim().min(1).max(80),
  vendor: z.string().trim().max(120).optional().nullable(),
  amount: z.number().positive().max(10000000),
  spentAt: z.coerce.date(),
  notes: z.string().trim().max(1000).optional().nullable(),
  receiptFileId: nullableId,
});

const timeInput = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use a valid time");

export const attendanceInput = z.object({
  membershipId: z.string().cuid(),
  date: dateOnlyInput,
  status: z.enum(["PRESENT", "HALF_DAY", "ABSENT", "LEAVE", "HOLIDAY", "WEEK_OFF"]),
  checkIn: z.union([timeInput, z.literal(""), z.null()]).optional().transform((v) => v || null),
  checkOut: z.union([timeInput, z.literal(""), z.null()]).optional().transform((v) => v || null),
  notes: z.string().trim().max(500).optional().nullable(),
});

export const attendanceBulkInput = z.object({
  date: dateOnlyInput,
  status: z.enum(["PRESENT", "HALF_DAY", "ABSENT", "LEAVE", "HOLIDAY", "WEEK_OFF"]),
  membershipIds: z.array(z.string().cuid()).min(1).max(200),
});

export const leaveInput = z
  .object({
    membershipId: z.string().cuid().optional(),
    type: z.enum(["CASUAL", "SICK", "UNPAID", "OTHER"]).default("CASUAL"),
    startDate: dateOnlyInput,
    endDate: dateOnlyInput,
    reason: z.string().trim().min(2).max(1000),
  })
  .refine((data) => data.endDate >= data.startDate, "The end date must be on or after the start date");

export const leaveDecisionInput = z.object({
  status: z.enum(["APPROVED", "REJECTED", "CANCELLED"]),
  decisionNote: z.string().trim().max(500).optional().nullable(),
});

export const advanceInput = z.object({
  membershipId: z.string().cuid().optional(),
  amount: z.number().positive().max(10000000),
  reason: z.string().trim().max(500).optional().nullable(),
  requestedAt: dateOnlyInput.optional(),
});

export const advanceDecisionInput = z.object({
  status: z.enum(["APPROVED", "REJECTED", "PAID"]),
  notes: z.string().trim().max(500).optional().nullable(),
});

export const salaryPaymentInput = z.object({
  membershipId: z.string().cuid(),
  periodStart: dateOnlyInput,
  periodEnd: dateOnlyInput,
  baseAmount: z.number().min(0).max(10000000),
  bonus: z.number().min(0).max(10000000).default(0),
  deductions: z.number().min(0).max(10000000).default(0),
  advanceDeduction: z.number().min(0).max(10000000).default(0),
  method: z.enum(["CASH", "CARD", "UPI", "BANK", "OTHER"]).default("CASH"),
  paidAt: z.coerce.date().optional(),
  notes: z.string().trim().max(1000).optional().nullable(),
});

export const employeeProfileInput = z
  .object({
    jobTitle: z.string().trim().max(80).optional().nullable(),
    employmentType: z.enum(["FULL_TIME", "PART_TIME", "CONTRACT", "TEMPORARY"]).optional(),
    hiredAt: optionalDateOnly,
    monthlySalary: z.number().min(0).max(10000000).optional().nullable(),
    payDay: z.number().int().min(1).max(28).optional(),
    address: z.string().trim().max(500).optional().nullable(),
    emergencyContactName: z.string().trim().max(120).optional().nullable(),
    emergencyContactPhone: z.string().trim().max(30).optional().nullable(),
    aadhaarNumber: z.string().trim().max(20).optional().nullable(),
    panNumber: z.string().trim().max(20).optional().nullable(),
    onboardingComplete: z.boolean().optional(),
  })
  .refine((data) => Object.values(data).some((v) => v !== undefined), "No changes supplied");

export const rolePermissionInput = z.object({
  role: z.enum(["ADMIN", "MANAGER", "RECEPTIONIST", "STAFF"]),
  permissions: z.array(z.enum(PERMISSIONS)).max(PERMISSIONS.length),
});

export const inviteInput = z.object({
  email: emailSchema,
  role: z.enum(["ADMIN", "MANAGER", "RECEPTIONIST", "STAFF"]),
  branchId: nullableId,
  commissionRate: z.number().min(0).max(100).default(0),
});

export const acceptInviteInput = z.object({
  name: z.string().trim().min(2).max(120),
  password: passwordSchema,
});

export const membershipUpdate = z
  .object({
    role: z.enum(["ADMIN", "MANAGER", "RECEPTIONIST", "STAFF"]).optional(),
    branchId: nullableId,
    active: z.boolean().optional(),
    permissionOverrides: z
      .object({
        grant: z.array(z.enum(PERMISSIONS)).max(PERMISSIONS.length).default([]),
        revoke: z.array(z.enum(PERMISSIONS)).max(PERMISSIONS.length).default([]),
      })
      .optional(),
    staffProfile: z
      .object({
        bio: z.string().trim().max(1000).optional().nullable(),
        specialties: z.array(z.string().trim().min(1).max(60)).max(20).optional(),
        color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
        commissionRate: z.number().min(0).max(100).optional(),
        schedule: z
          .array(
            z.object({
              day: z.number().int().min(0).max(6),
              start: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
              end: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
            }),
          )
          .max(21)
          .optional(),
      })
      .optional(),
  })
  .refine((data) => Object.values(data).some((v) => v !== undefined), "No changes supplied");

export const salonProfileInput = z.object({
  name: z.string().trim().min(2).max(120),
  email: emailSchema,
  phone: phoneSchema,
  address: z.string().trim().max(500).optional().nullable(),
  timezone: z.string().trim().min(1).max(60),
  currency: z.string().trim().length(3).toUpperCase(),
  locale: z.string().trim().min(2).max(20),
});

export const salonUpdateInput = salonProfileInput.partial().extend({
  settings: salonSettingsSchema.partial().optional(),
});

export const branchInput = z.object({
  name: z.string().trim().min(1).max(120),
  phone: z.string().trim().max(30).optional().nullable(),
  address: z.string().trim().max(500).optional().nullable(),
});

export const branchUpdateInput = branchInput.partial().extend({ active: z.boolean().optional() });
export const expenseVoidInput = z.object({ void: z.literal(true) });

export const registerInput = z.object({
  salonName: z.string().trim().min(2).max(120),
  name: z.string().trim().min(2).max(120),
  email: emailSchema,
  password: passwordSchema,
  phone: phoneSchema,
  timezone: z.string().trim().min(1).max(60).default("UTC"),
  currency: z.string().trim().length(3).toUpperCase().default("INR"),
});

export const loginInput = z.object({
  email: emailSchema,
  password: z.string().min(1).max(128),
});

export const mfaVerifyInput = z.object({
  code: z.string().trim().min(6).max(20),
});

export const mfaEnableInput = z.object({
  code: z.string().trim().regex(/^\d{6}$/),
});

export const passwordChangeInput = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: passwordSchema,
});

export const platformSalonInput = z.object({
  salonName: z.string().trim().min(2).max(120),
  ownerName: z.string().trim().min(2).max(120),
  ownerEmail: emailSchema,
  ownerPassword: passwordSchema,
  phone: phoneSchema,
  timezone: z.string().trim().min(1).max(60).default("UTC"),
  currency: z.string().trim().length(3).toUpperCase().default("INR"),
  planId: nullableId,
});

export const planInput = z.object({
  name: z.string().trim().min(1).max(80),
  slug: z.string().trim().regex(/^[a-z0-9-]+$/).max(60),
  description: z.string().trim().max(500).optional().nullable(),
  monthlyPrice: z.number().min(0),
  yearlyPrice: z.number().min(0).optional().nullable(),
  features: z.array(z.string().trim().min(1).max(100)).max(50).default([]),
  limits: z
    .object({
      maxBranches: z.number().int().positive().optional(),
      maxStaff: z.number().int().positive().optional(),
    })
    .default({}),
  active: z.boolean().default(true),
});

export const subscriptionInput = z.object({
  planId: z.string().cuid(),
  status: z.enum(["TRIALING", "ACTIVE", "PAST_DUE", "CANCELED"]),
  currentPeriodEnd: z.coerce.date().optional().nullable(),
  trialEndsAt: z.coerce.date().optional().nullable(),
});

export const templateInput = z.object({
  key: z.string().trim().regex(/^[a-z0-9_]+$/).max(60),
  channel: z.enum(["EMAIL", "SMS", "WHATSAPP"]),
  subject: z.string().trim().max(200).optional().nullable(),
  body: z.string().trim().min(1).max(10000),
  enabled: z.boolean().default(true),
});

export const platformSettingsUpdate = z.object({
  platformName: z.string().trim().min(2).max(80),
  supportEmail: emailSchema,
  trialDays: z.number().int().min(0).max(365),
  notice: z.string().trim().max(300),
});

export const forgotPasswordInput = z.object({ email: emailSchema });

export const resetPasswordInput = z.object({
  token: z.string().trim().min(20).max(200),
  password: passwordSchema,
});
