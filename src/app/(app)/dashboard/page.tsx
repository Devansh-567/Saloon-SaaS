import type { Metadata } from "next";
import Link from "next/link";
import { requireTenantPage } from "@/lib/guards";
import { getDashboardData } from "@/services/analytics";
import { formatDate, formatMoney, formatTime, initials } from "@/lib/utils";
import { hasPermission } from "@/lib/auth";
import { Icon, type IconName } from "@/components/ui/icons";
import { StatusBadge } from "@/components/ui/badge";
import { RevenueChart } from "@/components/dashboard/revenue-chart";
import { AppointmentActions } from "@/components/appointments/appointment-actions";

export const metadata: Metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

const OPEN_STATUSES = ["SCHEDULED", "CONFIRMED", "CHECKED_IN", "IN_PROGRESS"];

export default async function DashboardPage() {
  const context = await requireTenantPage();
  const data = await getDashboardData(context);
  const canBill = hasPermission(context, "billing.write");
  const canBook = hasPermission(context, "appointments.write");
  const canSell = hasPermission(context, "billing.write");
  const canWriteAppointments = hasPermission(context, "appointments.write");

  const now = Date.now();
  const spotlight =
    data.todayAppointments.find((appointment) => appointment.status === "IN_PROGRESS") ||
    data.todayAppointments.find((appointment) => appointment.status === "CHECKED_IN") ||
    data.todayAppointments.find(
      (appointment) => OPEN_STATUSES.includes(appointment.status) && new Date(appointment.startAt).getTime() >= now,
    ) ||
    data.todayAppointments.find((appointment) => OPEN_STATUSES.includes(appointment.status));
  const remainingToday = data.todayAppointments.filter((appointment) => OPEN_STATUSES.includes(appointment.status)).length;

  const attention: Array<{ href: string; label: string; value: string; icon: IconName }> = [];
  if (data.stats.queueCount > 0 && hasPermission(context, "queue.read")) {
    attention.push({ href: "/queue", label: "Guests waiting", value: String(data.stats.queueCount), icon: "ticket" });
  }
  if (data.stats.lowStock > 0 && hasPermission(context, "inventory.read")) {
    attention.push({ href: "/inventory", label: "Low stock items", value: String(data.stats.lowStock), icon: "box" });
  }
  if (data.stats.outstanding !== null && data.stats.outstanding > 0 && hasPermission(context, "billing.read")) {
    attention.push({
      href: "/billing",
      label: "Outstanding balance",
      value: formatMoney(data.stats.outstanding, context.salon.currency, context.salon.locale),
      icon: "receipt",
    });
  }
  const overdueFollowUps = data.followUps.filter((followUp) => followUp.overdue).length;
  if (overdueFollowUps > 0) {
    attention.push({
      href: "/customers",
      label: "Reminders overdue",
      value: String(overdueFollowUps),
      icon: "phone",
    });
  }

  const stats: Array<{ label: string; value: string; hint: string; icon: IconName }> = [
    {
      label: "Today's appointments",
      value: String(data.stats.appointmentCount),
      hint: `${data.stats.completedMonth} completed this month`,
      icon: "calendar",
    },
    {
      label: "Waiting now",
      value: String(data.stats.queueCount),
      hint: data.stats.queueCount ? "Waiting or being served" : "Nobody is waiting",
      icon: "ticket",
    },
    {
      label: "New customers",
      value: String(data.stats.newCustomers),
      hint: "Added this month",
      icon: "users",
    },
    {
      label: "Low stock",
      value: String(data.stats.lowStock),
      hint: data.stats.lowStock ? "Running low" : "Stock is fine",
      icon: "box",
    },
  ];

  if (data.stats.todayPayments !== null) {
    stats.push({
      label: "Collected today",
      value: formatMoney(data.stats.todayPayments, context.salon.currency, context.salon.locale),
      hint: "All payments recorded today",
      icon: "money",
    });
  }
  if (data.stats.outstanding !== null) {
    stats.push({
      label: "Outstanding",
      value: formatMoney(data.stats.outstanding, context.salon.currency, context.salon.locale),
      hint: "Customers who still owe",
      icon: "receipt",
    });
  }
  if (data.stats.monthInvoiced !== null) {
    stats.push({
      label: "Billed this month",
      value: formatMoney(data.stats.monthInvoiced, context.salon.currency, context.salon.locale),
      hint: `${data.stats.monthInvoiceCount || 0} bills made`,
      icon: "chart",
    });
  }

  return (
    <div className="stack" style={{ gap: 22 }}>
      <div className="page-head">
        <div>
          <h1>Good to see you, {context.user.name.split(" ")[0]}.</h1>
          <p className="page-subtitle">
            Here is the working picture for {context.salon.name}
            {context.branch ? ` · ${context.branch.name}` : ""}.
          </p>
        </div>
        <div className="page-actions">
          {canBook ? (
            <Link href="/appointments" className="btn btn-secondary">
              <Icon name="calendar" /> Book appointment
            </Link>
          ) : null}
          {canBill ? (
            <Link href="/billing/new" className="btn btn-primary">
              <Icon name="plus" /> New invoice
            </Link>
          ) : null}
        </div>
      </div>

      {spotlight ? (
        <section className="card">
          <div className="card-head">
            <div>
              <h2>
                {spotlight.status === "IN_PROGRESS"
                  ? "In service now"
                  : spotlight.status === "CHECKED_IN"
                    ? "Checked in and waiting"
                    : "Up next today"}
              </h2>
              <p>
                {formatTime(spotlight.startAt, context.salon.timezone, context.salon.locale)} –{" "}
                {formatTime(spotlight.endAt, context.salon.timezone, context.salon.locale)}
                {remainingToday > 1 ? ` · ${remainingToday - 1} more on today's schedule` : ""}
              </p>
            </div>
            <StatusBadge status={spotlight.status} />
          </div>
          <div
            className="card-body"
            style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}
          >
            <div style={{ display: "flex", gap: 13, alignItems: "center", minWidth: 0 }}>
              <span className="avatar" style={{ width: 44, height: 44, fontSize: 15, flex: "none" }}>
                {initials(spotlight.customer.name)}
              </span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 15 }}>{spotlight.customer.name}</div>
                <div style={{ color: "var(--muted)", fontSize: 12.5 }}>
                  {spotlight.service.name} · {spotlight.service.durationMin} min · {spotlight.staff.name}
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
              <strong style={{ fontFamily: "var(--font-display)", fontSize: 24, letterSpacing: "-0.02em" }}>
                {formatTime(spotlight.startAt, context.salon.timezone, context.salon.locale)}
              </strong>
              {canWriteAppointments ? <AppointmentActions id={spotlight.id} status={spotlight.status} /> : null}
            </div>
          </div>
        </section>
      ) : null}

      <div className="grid-4">
        {stats.slice(0, 4).map((stat) => (
          <div className="stat-card" key={stat.label}>
            <div className="stat-top">
              <span>{stat.label}</span>
              <Icon name={stat.icon} />
            </div>
            <div className="stat-value">{stat.value}</div>
            <div className="stat-foot">{stat.hint}</div>
          </div>
        ))}
      </div>

      {stats.length > 4 ? (
        <div className="grid-3">
          {stats.slice(4).map((stat) => (
            <div className="stat-card" key={stat.label}>
              <div className="stat-top">
                <span>{stat.label}</span>
                <Icon name={stat.icon} />
              </div>
              <div className="stat-value">{stat.value}</div>
              <div className="stat-foot">{stat.hint}</div>
            </div>
          ))}
        </div>
      ) : null}

      <div className="split">
        <section className="card">
          <div className="card-head">
            <div>
              <h2>Today&apos;s agenda</h2>
              <p>
                {data.todayAppointments.length
                  ? `${data.todayAppointments.length} appointment${data.todayAppointments.length === 1 ? "" : "s"} in the working day`
                  : "No appointments scheduled for today"}
              </p>
            </div>
            <Link href="/appointments" className="btn btn-ghost btn-sm">
              Open schedule <Icon name="arrow" />
            </Link>
          </div>
          {data.todayAppointments.length ? (
            <div className="agenda">
              {data.todayAppointments.slice(0, 6).map((appointment) => (
                <div className="agenda-row" key={appointment.id}>
                  <div className="agenda-time">
                    {formatTime(appointment.startAt, context.salon.timezone, context.salon.locale)}
                    <span>{appointment.service.durationMin} min</span>
                  </div>
                  <div className="agenda-main">
                    <strong>{appointment.customer.name}</strong>
                    <span>
                      {appointment.service.name} · {appointment.staff.name}
                    </span>
                  </div>
                  <div className="agenda-actions">
                    <StatusBadge status={appointment.status} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty">
              <div className="empty-icon">
                <Icon name="calendar" />
              </div>
              <h3>A quiet start</h3>
              <p>There are no appointments for today. Book one or add a waiting customer.</p>
              <Link href="/queue" className="btn btn-secondary btn-sm">
                Open queue
              </Link>
            </div>
          )}
        </section>

        <div className="stack">
          {attention.length ? (
            <section className="card">
              <div className="card-head">
                <div>
                  <h2>Needs attention</h2>
                  <p>Things worth a look right now</p>
                </div>
              </div>
              <div className="card-body" style={{ display: "grid", gap: 8 }}>
                {attention.map((item) => (
                  <Link key={item.label} href={item.href} className="dropdown-item" style={{ padding: "10px 11px" }}>
                    <Icon name={item.icon} />
                    <span style={{ flex: 1 }}>{item.label}</span>
                    <span className="badge badge-warning">{item.value}</span>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          {data.followUps.length ? (
            <section className="card">
              <div className="card-head">
                <div>
                  <h2>Reminders</h2>
                  <p>Customers to call or check in with</p>
                </div>
              </div>
              <div className="card-body stack" style={{ gap: 9 }}>
                {data.followUps.map((followUp) => (
                  <Link key={followUp.id} href={`/customers/${followUp.customer.id}`} className="dropdown-item" style={{ padding: "9px 10px" }}>
                    <Icon name="phone" />
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: "block", fontSize: 12.5, fontWeight: 600 }}>{followUp.customer.name}</span>
                      <span className="hint">{followUp.title} · {formatDate(followUp.dueAt, context.salon.timezone, context.salon.locale)}</span>
                    </span>
                    {followUp.overdue ? <span className="badge badge-danger">Overdue</span> : null}
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          {hasPermission(context, "reports.read") ? (
            <section className="card">
              <div className="card-head">
                <div>
                  <h2>Collections</h2>
                  <p>Daily payment activity this month</p>
                </div>
              </div>
              <div className="card-body">
                <RevenueChart data={data.revenueSeries} currency={context.salon.currency} locale={context.salon.locale} />
              </div>
            </section>
          ) : null}

          <section className="card">
            <div className="card-head">
              <h2>Quick actions</h2>
            </div>
            <div className="card-body" style={{ display: "grid", gap: 8 }}>
              {[
                { href: "/appointments", label: "Manage the schedule", icon: "calendar" as IconName, permission: "appointments.read" },
                { href: "/queue", label: "Add to waiting list", icon: "ticket" as IconName, permission: "queue.write" },
                { href: "/customers", label: "Find a customer", icon: "users" as IconName, permission: "customers.read" },
                { href: "/inventory", label: "Review stock", icon: "box" as IconName, permission: "inventory.read" },
                { href: canSell ? "/billing/new" : "/billing", label: "Make a new bill", icon: "card" as IconName, permission: "billing.read" },
              ]
                .filter((action) => hasPermission(context, action.permission as never))
                .map((action) => (
                  <Link key={action.href} href={action.href} className="dropdown-item" style={{ padding: "10px 11px" }}>
                    <Icon name={action.icon} />
                    <span style={{ flex: 1 }}>{action.label}</span>
                    <Icon name="chevron" style={{ width: 14, height: 14 }} />
                  </Link>
                ))}
            </div>
          </section>
        </div>
      </div>

      <section className="card">
        <div className="card-head">
          <div>
            <h2>Team on the floor</h2>
            <p>Quick reference for today&apos;s assigned appointments</p>
          </div>
          <Link href="/team" className="btn btn-ghost btn-sm">
            View team <Icon name="arrow" />
          </Link>
        </div>
        <div className="card-body">
          {data.todayAppointments.length ? (
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {[...new Map(data.todayAppointments.map((appointment) => [appointment.staff.id, appointment.staff])).values()].map((staff) => (
                <div key={staff.id} style={{ display: "flex", alignItems: "center", gap: 9, border: "1px solid var(--line)", borderRadius: 999, padding: "6px 12px 6px 6px", background: "var(--surface-raised)" }}>
                  <span className="avatar">{initials(staff.name)}</span>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600 }}>{staff.name}</div>
                    <div style={{ fontSize: 10.5, color: "var(--muted)" }}>
                      {data.todayAppointments.filter((appointment) => appointment.staff.id === staff.id).length} appointment(s)
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: "var(--muted)", fontSize: 12.5, margin: 0 }}>No team assignments yet today.</p>
          )}
        </div>
      </section>
    </div>
  );
}
