import "dotenv/config";
import { PrismaClient, Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { DEFAULT_SALON_SETTINGS } from "../src/lib/settings";

const prisma = new PrismaClient();

const SEED_PASSWORD = process.env.SEED_PASSWORD || "SalonDemo!2026";

if (process.env.NODE_ENV === "production" && process.env.SEED_ALLOW_PRODUCTION !== "1") {
  console.error("Refusing to seed demo data in production. Set SEED_ALLOW_PRODUCTION=1 only for a controlled demo environment.");
  process.exit(1);
}

const round = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

function daysFromNow(days: number, hour = 9, minute = 0) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  date.setUTCHours(hour, minute, 0, 0);
  return date;
}

function startOfToday(hour: number, minute = 0) {
  return daysFromNow(0, hour, minute);
}

function line(
  kind: "SERVICE" | "PRODUCT",
  description: string,
  quantity: number,
  unitPrice: number,
  taxRate: number,
  commissionRate: number,
  ids: { serviceId?: string; productId?: string; staffMembershipId?: string },
) {
  const gross = round(quantity * unitPrice);
  const taxAmount = round((gross * taxRate) / 100);
  return {
    kind,
    description,
    quantity: new Prisma.Decimal(quantity),
    unitPrice: new Prisma.Decimal(unitPrice),
    taxRate: new Prisma.Decimal(taxRate),
    taxAmount: new Prisma.Decimal(taxAmount),
    discountAmount: new Prisma.Decimal(0),
    lineTotal: new Prisma.Decimal(round(gross + taxAmount)),
    commissionAmount: new Prisma.Decimal(round((gross * commissionRate) / 100)),
    ...ids,
  };
}

async function globalCatalog() {
  const plans = [
    {
      slug: "starter",
      name: "Starter",
      description: "A single chair, one location, and the essentials.",
      monthlyPrice: 29,
      yearlyPrice: 290,
      features: ["Appointments", "Customer records", "Invoicing", "Walk-in queue"],
      limits: { maxStaff: 3, maxBranches: 1 },
    },
    {
      slug: "growth",
      name: "Growth",
      description: "For busy salons with a growing team.",
      monthlyPrice: 59,
      yearlyPrice: 590,
      features: ["Everything in Starter", "Inventory", "Expenses", "Reports", "SMS notifications"],
      limits: { maxStaff: 12, maxBranches: 2 },
    },
    {
      slug: "studio",
      name: "Studio",
      description: "Multi-branch studios that need full control.",
      monthlyPrice: 99,
      yearlyPrice: 990,
      features: ["Everything in Growth", "Unlimited branches", "Commission tracking", "Priority support"],
      limits: {},
    },
  ];
  for (const plan of plans) {
    await prisma.plan.upsert({
      where: { slug: plan.slug },
      create: {
        ...plan,
        monthlyPrice: new Prisma.Decimal(plan.monthlyPrice),
        yearlyPrice: new Prisma.Decimal(plan.yearlyPrice),
        features: plan.features,
        limits: plan.limits,
      },
      update: {
        name: plan.name,
        description: plan.description,
        monthlyPrice: new Prisma.Decimal(plan.monthlyPrice),
        yearlyPrice: new Prisma.Decimal(plan.yearlyPrice),
        features: plan.features,
        limits: plan.limits,
        active: true,
      },
    });
  }

  await prisma.platformSetting.upsert({
    where: { key: "platform" },
    create: {
      key: "platform",
      value: {
        platformName: "Salon SaaS",
        supportEmail: "support@example.com",
        trialDays: 14,
        notice: "",
      },
    },
    update: {},
  });

  const templates = [
    {
      key: "invoice_issued",
      channel: "EMAIL" as const,
      subject: "Your invoice {{invoiceNumber}} from {{salonName}}",
      body: "Hi {{customerName}},\n\nThank you for visiting {{salonName}}. Your invoice {{invoiceNumber}} for {{invoiceTotal}} is attached.\n\nSee you soon!",
    },
    {
      key: "invoice_issued",
      channel: "SMS" as const,
      subject: null,
      body: "{{salonName}}: invoice {{invoiceNumber}} for {{invoiceTotal}} is ready.",
    },
    {
      key: "appointment_reminder",
      channel: "SMS" as const,
      subject: null,
      body: "Reminder: your appointment at {{salonName}} is on {{appointmentTime}}. Reply to reschedule.",
    },
  ];
  for (const template of templates) {
    await prisma.notificationTemplate.upsert({
      where: { scope_key_channel: { scope: "global", key: template.key, channel: template.channel } },
      create: { scope: "global", salonId: null, ...template, enabled: true },
      update: { subject: template.subject, body: template.body, enabled: true },
    });
  }
}

async function demoSalon() {
  const passwordHash = await bcrypt.hash(SEED_PASSWORD, 12);
  const owner = await prisma.user.upsert({
    where: { email: "owner@demo.local" },
    create: { email: "owner@demo.local", name: "Amara Okafor", phone: "+15550101001", passwordHash },
    update: { name: "Amara Okafor", passwordHash },
  });
  const manager = await prisma.user.upsert({
    where: { email: "manager@demo.local" },
    create: { email: "manager@demo.local", name: "Priya Raman", phone: "+15550101002", passwordHash },
    update: { name: "Priya Raman", passwordHash },
  });
  const stylist = await prisma.user.upsert({
    where: { email: "stylist@demo.local" },
    create: { email: "stylist@demo.local", name: "Noah Bennett", phone: "+15550101003", passwordHash },
    update: { name: "Noah Bennett", passwordHash },
  });

  const slug = "aurelia-hair-studio";
  const existing = await prisma.salon.findUnique({ where: { slug } });
  if (existing) {
    await prisma.salon.delete({ where: { id: existing.id } });
  }

  const plan = await prisma.plan.findUnique({ where: { slug: "growth" } });
  const salon = await prisma.salon.create({
    data: {
      name: "Aurelia Hair Studio",
      slug,
      email: "hello@aurelia.demo",
      phone: "+15550101000",
      address: "48 Mariners Lane, Brooklyn, NY",
      timezone: "America/New_York",
      currency: "USD",
      locale: "en-US",
      ownerId: owner.id,
      settings: {
        ...DEFAULT_SALON_SETTINGS,
        receiptHeader: "Aurelia Hair Studio · 48 Mariners Lane",
        receiptFooter: "Consultations are complimentary. Thank you for your visit.",
      },
      plans: plan
        ? {
            create: {
              planId: plan.id,
              status: "ACTIVE",
              trialEndsAt: null,
              currentPeriodEnd: daysFromNow(25),
            },
          }
        : undefined,
    },
  });

  const branch = await prisma.branch.create({
    data: {
      salonId: salon.id,
      name: "Brooklyn flagship",
      phone: "+15550101000",
      address: "48 Mariners Lane, Brooklyn, NY",
      isPrimary: true,
    },
  });

  const ownerMember = await prisma.membership.create({
    data: { salonId: salon.id, userId: owner.id, role: "OWNER" },
  });
  const managerMember = await prisma.membership.create({
    data: { salonId: salon.id, userId: manager.id, role: "MANAGER", branchId: branch.id },
  });
  const stylistMember = await prisma.membership.create({
    data: { salonId: salon.id, userId: stylist.id, role: "STAFF", branchId: branch.id },
  });

  const schedule = [1, 2, 3, 4, 5, 6].map((day) => ({ day, start: "09:00", end: "18:00" }));
  await prisma.staffProfile.createMany({
    data: [
      {
        membershipId: ownerMember.id,
        bio: "Founder and creative director. Specialises in lived-in colour and curly cutting.",
        specialties: ["Creative direction", "Curly cutting", "Colour correction"],
        color: "#8c6a52",
        commissionRate: new Prisma.Decimal(0),
        schedule: [1, 2, 3, 4, 5].map((day) => ({ day, start: "10:00", end: "17:00" })),
      },
      {
        membershipId: managerMember.id,
        bio: "Salon manager and senior colourist.",
        specialties: ["Balayage", "Colour correction", "Bridal"],
        color: "#365e78",
        commissionRate: new Prisma.Decimal(35),
        schedule,
      },
      {
        membershipId: stylistMember.id,
        bio: "Senior stylist focused on precision cutting and low-maintenance colour.",
        specialties: ["Precision cutting", "Gloss", "Blowouts"],
        color: "#2f6b4f",
        commissionRate: new Prisma.Decimal(30),
        schedule,
      },
    ],
  });

  const standard = await prisma.taxRate.create({
    data: { salonId: salon.id, name: "NY sales tax", rate: new Prisma.Decimal(8.875) },
  });
  const reduced = await prisma.taxRate.create({
    data: { salonId: salon.id, name: "Reduced", rate: new Prisma.Decimal(4) },
  });

  const hair = await prisma.serviceCategory.create({ data: { salonId: salon.id, name: "Hair" } });
  const colour = await prisma.serviceCategory.create({ data: { salonId: salon.id, name: "Colour" } });
  const treatments = await prisma.serviceCategory.create({ data: { salonId: salon.id, name: "Treatments" } });

  const supplier = await prisma.supplier.create({
    data: {
      salonId: salon.id,
      name: "Metro Salon Supply",
      phone: "+15550101999",
      email: "orders@metrosupply.demo",
      address: "120 Distribution Way, Newark, NJ",
    },
  });

  const products = await Promise.all(
    [
      { name: "Hydrating shampoo 1L", sku: "SH-1L", price: 42, cost: 21, reorder: 4, unit: "bottle", qty: 12 },
      { name: "Repair conditioner 1L", sku: "CO-1L", price: 46, cost: 24, reorder: 4, unit: "bottle", qty: 9 },
      { name: "Ammonia-free colour tube", sku: "CT-06", price: 18, cost: 9, reorder: 10, unit: "tube", qty: 24 },
      { name: "Bond treatment mask", sku: "TM-500", price: 58, cost: 29, reorder: 3, unit: "tub", qty: 2 },
    ].map(async (product) => {
      const created = await prisma.product.create({
        data: {
          salonId: salon.id,
          supplierId: supplier.id,
          name: product.name,
          sku: product.sku,
          description: `${product.name} · professional back-bar stock.`,
          price: new Prisma.Decimal(product.price),
          cost: new Prisma.Decimal(product.cost),
          stockQty: product.qty,
          reorderLevel: product.reorder,
          unit: product.unit,
          taxRateId: standard.id,
        },
      });
      await prisma.stockMovement.create({
        data: {
          salonId: salon.id,
          productId: created.id,
          type: "PURCHASE",
          quantity: product.qty,
          resultingBalance: product.qty,
          unitCost: new Prisma.Decimal(product.cost),
          reference: "Opening stock",
          createdById: owner.id,
        },
      });
      return created;
    }),
  );

  const services = await Promise.all(
    [
      { name: "Signature cut & finish", price: 65, duration: 60, categoryId: hair.id, commission: 30, usage: [{ product: products[0], quantity: 1 }] },
      { name: "Blow-dry & style", price: 45, duration: 45, categoryId: hair.id, commission: 25, usage: [] },
      { name: "Full colour", price: 140, duration: 120, categoryId: colour.id, commission: 35, usage: [{ product: products[2], quantity: 2 }, { product: products[1], quantity: 1 }] },
      { name: "Gloss & tone", price: 85, duration: 60, categoryId: colour.id, commission: 30, usage: [{ product: products[2], quantity: 1 }] },
      { name: "Bond repair ritual", price: 70, duration: 45, categoryId: treatments.id, commission: 25, usage: [{ product: products[3], quantity: 1 }] },
    ].map(async (service) => {
      const created = await prisma.service.create({
        data: {
          salonId: salon.id,
          categoryId: service.categoryId,
          taxRateId: service.name === "Bond repair ritual" ? reduced.id : standard.id,
          name: service.name,
          description: `${service.name} by our senior team.`,
          price: new Prisma.Decimal(service.price),
          durationMin: service.duration,
          commissionRate: service.commission === 30 ? null : new Prisma.Decimal(service.commission),
          productUsage: {
            create: service.usage.map((item) => ({ productId: item.product.id, quantity: item.quantity })),
          },
        },
      });
      return created;
    }),
  );
  const [signatureCut, blowDry, fullColour, gloss, bondRitual] = services;

  const customerSeed = [
    { firstName: "Elena", lastName: "Rodriguez", phone: "+15550202001", email: "elena@example.com", notes: "Prefers morning appointments. Sensitive scalp." },
    { firstName: "Marcus", lastName: "Chen", phone: "+15550202002", email: "marcus@example.com", notes: "Books a cut every five weeks." },
    { firstName: "Sofia", lastName: "Ali", phone: "+15550202003", email: "sofia@example.com", notes: "Allergic to ammonia-based colour." },
    { firstName: "Daniel", lastName: "Brooks", phone: "+15550202004", email: null, notes: "Walk-in regular." },
    { firstName: "Nia", lastName: "Thompson", phone: "+15550202005", email: "nia@example.com", notes: "Bridal party in June." },
    { firstName: "Omar", lastName: "Haddad", phone: "+15550202006", email: "omar@example.com", notes: null },
    { firstName: "Grace", lastName: "Kim", phone: "+15550202007", email: "grace@example.com", notes: "Loves the bond ritual add-on." },
    { firstName: "Leo", lastName: "Martins", phone: "+15550202008", email: null, notes: "First visit — referred by Nia." },
  ];
  const customers = [];
  for (const customer of customerSeed) {
    customers.push(
      await prisma.customer.create({
        data: { salonId: salon.id, ...customer },
      }),
    );
  }
  const [elena, marcus, sofia, daniel, nia, omar, grace, leo] = customers;

  const appointments = [
    { customer: elena, service: signatureCut, staff: managerMember, start: startOfToday(9, 0), status: "COMPLETED" as const, completed: true },
    { customer: marcus, service: blowDry, staff: stylistMember, start: startOfToday(10, 30), status: "CHECKED_IN" as const },
    { customer: sofia, service: fullColour, staff: managerMember, start: startOfToday(12, 0), status: "CONFIRMED" as const },
    { customer: nia, service: gloss, staff: stylistMember, start: startOfToday(14, 0), status: "SCHEDULED" as const },
    { customer: grace, service: bondRitual, staff: stylistMember, start: startOfToday(16, 0), status: "SCHEDULED" as const },
    { customer: omar, service: signatureCut, staff: managerMember, start: daysFromNow(1, 11, 0), status: "SCHEDULED" as const },
    { customer: leo, service: blowDry, staff: stylistMember, start: daysFromNow(2, 13, 0), status: "SCHEDULED" as const },
  ];
  for (const appointment of appointments) {
    await prisma.appointment.create({
      data: {
        salonId: salon.id,
        branchId: branch.id,
        customerId: appointment.customer.id,
        staffMembershipId: appointment.staff.id,
        serviceId: appointment.service.id,
        startAt: appointment.start,
        endAt: new Date(appointment.start.getTime() + appointment.service.durationMin * 60000),
        status: appointment.status,
        checkedInAt: ["CHECKED_IN", "COMPLETED"].includes(appointment.status) ? appointment.start : null,
        completedAt: appointment.completed ? appointment.start : null,
        createdById: manager.id,
      },
    });
  }

  await prisma.queueTicket.createMany({
    data: [
      { salonId: salon.id, branchId: branch.id, customerId: daniel.id, name: "Daniel Brooks", phone: daniel.phone, serviceId: signatureCut.id, staffMembershipId: stylistMember.id, queueNumber: 1, status: "WAITING", notes: "Happy to wait for Noah." },
      { salonId: salon.id, branchId: branch.id, name: "Walk-in · Mia", phone: "+15550202099", serviceId: blowDry.id, staffMembershipId: managerMember.id, queueNumber: 2, status: "CALLED" },
    ],
  });

  const invoiceDrafts = [
    {
      number: "INV-DEMO-1001",
      customer: elena,
      status: "PAID" as const,
      day: 0,
      lines: [
        line("SERVICE", "Signature cut & finish", 1, 65, 8.875, 30, { serviceId: signatureCut.id, staffMembershipId: managerMember.id }),
        line("PRODUCT", "Hydrating shampoo 1L", 1, 42, 8.875, 0, { productId: products[0].id }),
      ],
      paid: true,
    },
    {
      number: "INV-DEMO-1002",
      customer: sofia,
      status: "PARTIAL" as const,
      day: -1,
      lines: [
        line("SERVICE", "Full colour", 1, 140, 8.875, 35, { serviceId: fullColour.id, staffMembershipId: managerMember.id }),
        line("SERVICE", "Bond repair ritual", 1, 70, 4, 25, { serviceId: bondRitual.id, staffMembershipId: managerMember.id }),
      ],
      paid: false,
    },
    {
      number: "INV-DEMO-1003",
      customer: grace,
      status: "PAID" as const,
      day: -2,
      lines: [
        line("SERVICE", "Gloss & tone", 1, 85, 8.875, 30, { serviceId: gloss.id, staffMembershipId: stylistMember.id }),
        line("SERVICE", "Blow-dry & style", 1, 45, 8.875, 25, { serviceId: blowDry.id, staffMembershipId: stylistMember.id }),
      ],
      paid: true,
    },
  ];

  for (const draft of invoiceDrafts) {
    const subtotal = round(draft.lines.reduce((sum, item) => sum + Number(item.quantity) * Number(item.unitPrice), 0));
    const taxTotal = round(draft.lines.reduce((sum, item) => sum + Number(item.taxAmount), 0));
    const total = round(draft.lines.reduce((sum, item) => sum + Number(item.lineTotal), 0));
    const commissionTotal = round(draft.lines.reduce((sum, item) => sum + Number(item.commissionAmount), 0));
    const paid = draft.paid ? total : 50;
    const issuedAt = daysFromNow(draft.day, 13, 30);
    await prisma.invoice.create({
      data: {
        salonId: salon.id,
        branchId: branch.id,
        customerId: draft.customer.id,
        number: draft.number,
        status: draft.status,
        subtotal: new Prisma.Decimal(subtotal),
        discount: new Prisma.Decimal(0),
        taxTotal: new Prisma.Decimal(taxTotal),
        total: new Prisma.Decimal(total),
        amountPaid: new Prisma.Decimal(paid),
        amountRefunded: new Prisma.Decimal(0),
        commissionTotal: new Prisma.Decimal(commissionTotal),
        notes: "Thank you for visiting Aurelia.",
        issuedAt,
        dueAt: new Date(issuedAt.getTime() + 7 * 86400000),
        createdById: manager.id,
        items: { create: draft.lines },
        payments: {
          create: {
            amount: new Prisma.Decimal(paid),
            method: draft.paid ? "CARD" : "CASH",
            kind: "PAYMENT",
            reference: draft.paid ? "Terminal · seeded" : "Deposit · seeded",
            receivedById: manager.id,
            createdAt: issuedAt,
          },
        },
      },
    });
    await prisma.customer.update({
      where: { id: draft.customer.id },
      data: {
        totalVisits: { increment: 1 },
        totalSpent: { increment: new Prisma.Decimal(paid) },
        loyaltyPoints: { increment: Math.floor(paid) },
      },
    });
  }

  await prisma.expense.createMany({
    data: [
      { salonId: salon.id, branchId: branch.id, category: "Rent", vendor: "Mariners Lane Properties", amount: new Prisma.Decimal(3200), spentAt: daysFromNow(-10, 9), notes: "Monthly studio rent", createdById: owner.id },
      { salonId: salon.id, branchId: branch.id, category: "Utilities", vendor: "Brooklyn Power", amount: new Prisma.Decimal(214.65), spentAt: daysFromNow(-8, 11), createdById: manager.id },
      { salonId: salon.id, branchId: branch.id, category: "Supplies", vendor: "Metro Salon Supply", amount: new Prisma.Decimal(486.2), spentAt: daysFromNow(-6, 15), notes: "Colour and back-bar restock", createdById: manager.id },
      { salonId: salon.id, branchId: branch.id, category: "Marketing", vendor: "Neighbourhood Press", amount: new Prisma.Decimal(120), spentAt: daysFromNow(-3, 10), notes: "Local print feature", createdById: owner.id },
    ],
  });

  console.log("\nDemo salon seeded");
  console.log(`  Salon:   ${salon.name} (${salon.slug})`);
  console.log(`  Owner:   owner@demo.local / ${SEED_PASSWORD}`);
  console.log(`  Manager: manager@demo.local / ${SEED_PASSWORD}`);
  console.log(`  Stylist: stylist@demo.local / ${SEED_PASSWORD}`);
  console.log("  Sign in at /login. Owner, manager, and stylist have different permissions.\n");
}

async function main() {
  await globalCatalog();
  await demoSalon();
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
