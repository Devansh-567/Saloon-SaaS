import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { hasPermission, type TenantContext } from "@/lib/auth";
import { asNumber, isoDateOnly, roundMoney } from "@/lib/utils";
import { todayAppointments } from "./appointments";

function dateKey(value: Date) {
  return value.toISOString().slice(0, 10);
}

function eachDay(from: Date, to: Date) {
  const days: string[] = [];
  const cursor = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
  const end = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate());
  while (cursor.getTime() <= end && days.length <= 366) {
    days.push(dateKey(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
}

export async function getDashboardData(context: TenantContext) {
  const now = new Date();
  const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const todayEnd = new Date(todayStart.getTime() + 86400000 - 1);
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const nextMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  const ownScope = context.role === "STAFF" ? { staffMembershipId: context.membership.id } : {};
  const [today, queueCount, appointmentCount, completedMonth, newCustomers, lowStock, outstandingRows, monthInvoices, followUps] =
    await Promise.all([
      todayAppointments(context, todayStart, todayEnd),
      prisma.queueTicket.count({
        where: { salonId: context.salon.id, status: { in: ["WAITING", "CALLED", "SERVING"] } },
      }),
      prisma.appointment.count({
        where: {
          salonId: context.salon.id,
          ...ownScope,
          startAt: { gte: todayStart, lte: todayEnd },
          status: { notIn: ["CANCELLED", "NO_SHOW"] },
        },
      }),
      prisma.appointment.count({
        where: {
          salonId: context.salon.id,
          ...ownScope,
          status: "COMPLETED",
          completedAt: { gte: monthStart, lt: nextMonth },
        },
      }),
      prisma.customer.count({ where: { salonId: context.salon.id, createdAt: { gte: monthStart } } }),
      prisma
        .$queryRaw<Array<{ count: number }>>(
          Prisma.sql`SELECT COUNT(*)::int AS count FROM "Product"
            WHERE "salonId" = ${context.salon.id} AND "active" = true AND "stockQty" <= "reorderLevel"`,
        )
        .then((rows) => rows[0]?.count || 0),
      prisma.invoice.aggregate({
        where: { salonId: context.salon.id, status: { notIn: ["VOID", "DRAFT"] } },
        _sum: { total: true, amountPaid: true, amountRefunded: true },
      }),
      hasPermission(context, "reports.read")
        ? prisma.invoice.aggregate({
            where: {
              salonId: context.salon.id,
              createdAt: { gte: monthStart, lt: nextMonth },
              status: { notIn: ["VOID", "DRAFT"] },
            },
            _sum: { total: true, taxTotal: true, discount: true, subtotal: true },
            _count: true,
          })
        : Promise.resolve(null),
      hasPermission(context, "customers.read")
        ? prisma.customerFollowUp.findMany({
            where: {
              salonId: context.salon.id,
              status: "OPEN",
              dueAt: { lte: new Date(todayEnd.getTime() + 7 * 86400000) },
            },
            include: {
              customer: { select: { id: true, firstName: true, lastName: true, phone: true } },
              assignedTo: { include: { user: { select: { name: true } } } },
            },
            orderBy: { dueAt: "asc" },
            take: 6,
          })
        : Promise.resolve([]),
    ]);
  const invoicePaid = hasPermission(context, "billing.read")
    ? await prisma.payment.aggregate({
        where: {
          invoice: { salonId: context.salon.id },
          createdAt: { gte: todayStart, lte: todayEnd },
        },
        _sum: { amount: true },
      })
    : null;
  const seriesDays = eachDay(new Date(monthStart), now);
  const payments = hasPermission(context, "reports.read")
    ? await prisma.payment.findMany({
        where: { invoice: { salonId: context.salon.id }, createdAt: { gte: monthStart, lt: nextMonth } },
        select: { amount: true, kind: true, createdAt: true },
      })
    : [];
  const seriesMap = new Map(seriesDays.map((day) => [day, 0]));
  payments.forEach((payment) => {
    const key = dateKey(payment.createdAt);
    if (!seriesMap.has(key)) return;
    const value = asNumber(payment.amount) * (payment.kind === "REFUND" ? -1 : 1);
    seriesMap.set(key, roundMoney((seriesMap.get(key) || 0) + value));
  });
  const outstanding = roundMoney(
    asNumber(outstandingRows._sum.total) -
      asNumber(outstandingRows._sum.amountPaid) +
      asNumber(outstandingRows._sum.amountRefunded),
  );
  const todayPayments = invoicePaid
    ? roundMoney(asNumber(invoicePaid._sum.amount))
    : null;
  return {
    todayAppointments: today,
    stats: {
      appointmentCount,
      completedMonth,
      newCustomers,
      queueCount,
      lowStock,
      outstanding: hasPermission(context, "billing.read") ? outstanding : null,
      todayPayments,
      monthInvoiced: monthInvoices ? asNumber(monthInvoices._sum.total) : null,
      monthSales: monthInvoices ? roundMoney(asNumber(monthInvoices._sum.subtotal) - asNumber(monthInvoices._sum.discount)) : null,
      monthTax: monthInvoices ? asNumber(monthInvoices._sum.taxTotal) : null,
      monthInvoiceCount: monthInvoices?._count || null,
    },
    revenueSeries: seriesDays.map((day) => ({ day, value: seriesMap.get(day) || 0 })),
    followUps: followUps.map((followUp) => ({
      id: followUp.id,
      title: followUp.title,
      dueAt: followUp.dueAt.toISOString(),
      overdue: followUp.dueAt < now,
      customer: {
        id: followUp.customer.id,
        name: `${followUp.customer.firstName} ${followUp.customer.lastName}`.trim(),
        phone: followUp.customer.phone,
      },
      assignedTo: followUp.assignedTo?.user.name || null,
    })),
  };
}

export async function getReports(context: TenantContext, from: Date, to: Date) {
  const invoiceWhere: Prisma.InvoiceWhereInput = {
    salonId: context.salon.id,
    issuedAt: { gte: from, lte: to },
    status: { notIn: ["VOID", "DRAFT"] },
  };
  const [invoiceTotals, payments, refunds, expenseTotals, appointmentGroups, lineGroups, completedByStaff, customerVisits, lowStock, expensesRows, paymentRows, hrMetrics] =
    await Promise.all([
      prisma.invoice.aggregate({
        where: invoiceWhere,
        _sum: { subtotal: true, discount: true, taxTotal: true, total: true, amountPaid: true, amountRefunded: true, commissionTotal: true },
        _count: true,
      }),
      prisma.payment.aggregate({
        where: { invoice: { salonId: context.salon.id }, createdAt: { gte: from, lte: to }, kind: "PAYMENT" },
        _sum: { amount: true },
      }),
      prisma.payment.aggregate({
        where: { invoice: { salonId: context.salon.id }, createdAt: { gte: from, lte: to }, kind: "REFUND" },
        _sum: { amount: true },
      }),
      prisma.expense.aggregate({
        where: { salonId: context.salon.id, status: "RECORDED", spentAt: { gte: from, lte: to } },
        _sum: { amount: true },
      }),
      prisma.appointment.groupBy({
        by: ["status"],
        where: { salonId: context.salon.id, startAt: { gte: from, lte: to } },
        _count: true,
      }),
      prisma.invoiceLine.groupBy({
        by: ["serviceId", "staffMembershipId"],
        where: { invoice: invoiceWhere, kind: "SERVICE" },
        _sum: { lineTotal: true, commissionAmount: true },
        _count: true,
      }),
      prisma.appointment.groupBy({
        by: ["staffMembershipId"],
        where: { salonId: context.salon.id, status: "COMPLETED", completedAt: { gte: from, lte: to } },
        _count: true,
      }),
      prisma.$queryRaw<Array<{ total: number; repeat: number }>>(Prisma.sql`
        SELECT COUNT(*)::int AS total,
               COUNT(*) FILTER (WHERE visits > 1)::int AS repeat
        FROM (
          SELECT "customerId", COUNT(*)::int AS visits
          FROM "Appointment"
          WHERE "salonId" = ${context.salon.id}
            AND "status" = 'COMPLETED'
            AND "completedAt" >= ${from}
            AND "completedAt" <= ${to}
          GROUP BY "customerId"
        ) customer_visits`),
      prisma.product.findMany({
        where: { salonId: context.salon.id, active: true },
        select: { id: true, name: true, stockQty: true, reorderLevel: true, unit: true },
      }),
      prisma.expense.findMany({
        where: { salonId: context.salon.id, status: "RECORDED", spentAt: { gte: from, lte: to } },
        select: { spentAt: true, amount: true, category: true },
      }),
      prisma.payment.findMany({
        where: { invoice: { salonId: context.salon.id }, createdAt: { gte: from, lte: to } },
        select: { createdAt: true, amount: true, kind: true, method: true },
      }),
      hasPermission(context, "hr.read")
        ? Promise.all([
            prisma.attendanceRecord.groupBy({
              by: ["status"],
              where: { salonId: context.salon.id, date: { gte: from, lte: to } },
              _count: true,
            }),
            prisma.salaryPayment.aggregate({
              where: { salonId: context.salon.id, paidAt: { gte: from, lte: to } },
              _sum: { netAmount: true },
              _count: true,
            }),
            prisma.salaryAdvance.aggregate({
              where: { salonId: context.salon.id, status: "PAID", paidAt: { gte: from, lte: to } },
              _sum: { amount: true },
              _count: true,
            }),
            prisma.leaveRequest.count({
              where: { salonId: context.salon.id, status: "APPROVED", startDate: { gte: from, lte: to } },
            }),
          ])
        : Promise.resolve(null),
    ]);
  const serviceIds = [...new Set(lineGroups.map((line) => line.serviceId).filter((v): v is string => Boolean(v)))];
  const staffIds = [...new Set([...lineGroups.map((line) => line.staffMembershipId), ...completedByStaff.map((row) => row.staffMembershipId)].filter((v): v is string => Boolean(v)))];
  const [services, staff] = await Promise.all([
    prisma.service.findMany({ where: { salonId: context.salon.id, id: { in: serviceIds } }, select: { id: true, name: true } }),
    prisma.membership.findMany({
      where: { salonId: context.salon.id, id: { in: staffIds } },
      select: { id: true, user: { select: { name: true } } },
    }),
  ]);
  const serviceMap = new Map(services.map((service) => [service.id, service.name]));
  const staffMap = new Map(staff.map((member) => [member.id, member.user.name]));
  const staffRevenue = new Map<string, { revenue: number; commission: number; lines: number; completed: number }>();
  lineGroups.forEach((line) => {
    if (!line.staffMembershipId) return;
    const item = staffRevenue.get(line.staffMembershipId) || { revenue: 0, commission: 0, lines: 0, completed: 0 };
    item.revenue = roundMoney(item.revenue + asNumber(line._sum.lineTotal));
    item.commission = roundMoney(item.commission + asNumber(line._sum.commissionAmount));
    item.lines += line._count;
    staffRevenue.set(line.staffMembershipId, item);
  });
  completedByStaff.forEach((row) => {
    if (!row.staffMembershipId) return;
    const item = staffRevenue.get(row.staffMembershipId) || { revenue: 0, commission: 0, lines: 0, completed: 0 };
    item.completed = row._count;
    staffRevenue.set(row.staffMembershipId, item);
  });
  const topServicesMap = new Map<string, { name: string; revenue: number; count: number }>();
  lineGroups.forEach((line) => {
    if (!line.serviceId) return;
    const item = topServicesMap.get(line.serviceId) || { name: serviceMap.get(line.serviceId) || "Service", revenue: 0, count: 0 };
    item.revenue = roundMoney(item.revenue + asNumber(line._sum.lineTotal));
    item.count += line._count;
    topServicesMap.set(line.serviceId, item);
  });
  const dailyMap = new Map<string, { sales: number; collected: number; expenses: number }>();
  const ensureDay = (key: string) => {
    if (!dailyMap.has(key)) dailyMap.set(key, { sales: 0, collected: 0, expenses: 0 });
    return dailyMap.get(key)!;
  };
  const invoicesForSeries = await prisma.invoice.findMany({
    where: invoiceWhere,
    select: { issuedAt: true, subtotal: true, discount: true, taxTotal: true, total: true },
  });
  invoicesForSeries.forEach((invoice) => {
    if (!invoice.issuedAt) return;
    const day = ensureDay(dateKey(invoice.issuedAt));
    day.sales = roundMoney(day.sales + asNumber(invoice.subtotal) - asNumber(invoice.discount));
  });
  paymentRows.forEach((payment) => {
    const day = ensureDay(dateKey(payment.createdAt));
    day.collected = roundMoney(day.collected + asNumber(payment.amount) * (payment.kind === "REFUND" ? -1 : 1));
  });
  expensesRows.forEach((expense) => {
    const day = ensureDay(dateKey(expense.spentAt));
    day.expenses = roundMoney(day.expenses + asNumber(expense.amount));
  });
  const sales = roundMoney(asNumber(invoiceTotals._sum.subtotal) - asNumber(invoiceTotals._sum.discount));
  const expenses = asNumber(expenseTotals._sum.amount);
  const collected = roundMoney(asNumber(payments._sum.amount) - asNumber(refunds._sum.amount));
  const appointmentsByStatus: Record<string, number> = {};
  appointmentGroups.forEach((group) => {
    appointmentsByStatus[group.status] = group._count;
  });
  const totalVisited = Number(customerVisits[0]?.total || 0);
  const repeatCustomers = Number(customerVisits[0]?.repeat || 0);
  const compareLowStock = lowStock.filter((product) => product.stockQty <= product.reorderLevel);
  return {
    period: { from: from.toISOString(), to: to.toISOString() },
    summary: {
      sales,
      tax: asNumber(invoiceTotals._sum.taxTotal),
      invoiced: asNumber(invoiceTotals._sum.total),
      collected,
      refunds: asNumber(refunds._sum.amount),
      outstanding: roundMoney(
        asNumber(invoiceTotals._sum.total) - asNumber(invoiceTotals._sum.amountPaid) + asNumber(invoiceTotals._sum.amountRefunded),
      ),
      expenses,
      profitEstimate: roundMoney(sales - expenses),
      commissions: asNumber(invoiceTotals._sum.commissionTotal),
      invoiceCount: invoiceTotals._count,
      appointments: appointmentsByStatus,
      retentionRate: totalVisited ? Math.round((repeatCustomers / totalVisited) * 1000) / 10 : 0,
      repeatCustomers,
      totalVisited,
    },
    daily: [...dailyMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, values]) => ({ date, ...values })),
    topServices: [...topServicesMap.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 8),
    staffPerformance: [...staffRevenue.entries()]
      .map(([id, values]) => ({ id, name: staffMap.get(id) || "Former staff", ...values }))
      .sort((a, b) => b.revenue - a.revenue),
    lowStock: compareLowStock.slice(0, 20),
    paymentBreakdown: [...paymentRows.reduce((map, payment) => {
      const key = `${payment.kind}:${payment.method}`;
      map.set(key, (map.get(key) || 0) + asNumber(payment.amount));
      return map;
    }, new Map<string, number>())].map(([key, amount]) => {
      const [kind, method] = key.split(":");
      return { kind, method, amount: roundMoney(amount) };
    }),
    expenseBreakdown: [...expensesRows.reduce((map, expense) => {
      map.set(expense.category, (map.get(expense.category) || 0) + asNumber(expense.amount));
      return map;
    }, new Map<string, number>())].map(([category, amount]) => ({ category, amount: roundMoney(amount) })),
    hr: hrMetrics
      ? (() => {
          const [attendanceRows, salaries, advances, approvedLeaves] = hrMetrics;
          const attendance: Record<string, number> = {};
          attendanceRows.forEach((row) => {
            attendance[row.status] = row._count;
          });
          const present = (attendance.PRESENT || 0) + (attendance.HALF_DAY || 0);
          const marked = Object.values(attendance).reduce((sum, value) => sum + value, 0);
          return {
            attendance,
            attendanceRate: marked ? Math.round((present / marked) * 1000) / 10 : 0,
            markedDays: marked,
            salaryPaid: asNumber(salaries._sum.netAmount),
            salaryPayments: salaries._count,
            advancesPaid: asNumber(advances._sum.amount),
            advancesCount: advances._count,
            approvedLeaves,
            period: { from: isoDateOnly(from), to: isoDateOnly(to) },
          };
        })()
      : null,
  };
}
