import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireTenantPage } from "@/lib/guards";
import { hasPermission } from "@/lib/auth";
import { getCustomer, listCustomerStaff } from "@/services/customers";
import { formatDate, formatDateOnly, formatDay, formatMoney, initials } from "@/lib/utils";
import { CustomerDialog } from "@/components/customers/customer-dialog";
import { CustomerCrm } from "@/components/customers/customer-crm";
import { StatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty";
import { Icon } from "@/components/ui/icons";

export const metadata: Metadata = { title: "Customer profile" };
export const dynamic = "force-dynamic";

export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const context = await requireTenantPage("customers.read");
  const { id } = await params;
  const [customer, staff] = await Promise.all([getCustomer(context, id), listCustomerStaff(context)]);
  if (!customer) notFound();

  return (
    <div className="stack" style={{ gap: 20 }}>
      <div className="page-head">
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <Link href="/customers" className="icon-btn" aria-label="Back to customers">
            <Icon name="arrow" style={{ transform: "rotate(180deg)" }} />
          </Link>
          <span className="avatar lg">{initials(customer.name)}</span>
          <div>
            <h1 style={{ fontSize: "1.9rem", marginBottom: 2 }}>{customer.name}</h1>
            <p className="page-subtitle">
              Customer since {formatDay(customer.createdAt, context.salon.timezone, context.salon.locale)} · {customer.phone}
            </p>
            {customer.tags.length ? (
              <div className="chip-row" style={{ marginTop: 7 }}>
                {customer.tags.map((tag) => (
                  <span key={tag} className="chip">{tag}</span>
                ))}
              </div>
            ) : null}
          </div>
        </div>
        <div className="page-actions">
          {hasPermission(context, "appointments.write") ? (
            <Link href={`/appointments?customer=${customer.id}`} className="btn btn-secondary">
              <Icon name="calendar" /> Book
            </Link>
          ) : null}
          {hasPermission(context, "billing.write") ? (
            <Link href={`/billing/new?customer=${customer.id}`} className="btn btn-primary">
              <Icon name="card" /> Invoice
            </Link>
          ) : null}
          {hasPermission(context, "customers.write") ? <CustomerDialog customer={customer} staff={staff} variant="ghost" icon="edit" /> : null}
        </div>
      </div>

      <div className="grid-4">
        {[
          { label: "Visits", value: String(customer.totalVisits), icon: "calendar" as const },
          { label: "Total spent", value: formatMoney(customer.totalSpent, context.salon.currency, context.salon.locale), icon: "money" as const },
          { label: "Reward points", value: String(customer.loyaltyPoints), icon: "sparkle" as const },
          {
            label: "Last visit",
            value: customer.insights.lastVisitAt
              ? formatDay(customer.insights.lastVisitAt, context.salon.timezone, context.salon.locale)
              : "No visits yet",
            icon: "calendar" as const,
          },
        ].map((stat) => (
          <div className="stat-card" key={stat.label}>
            <div className="stat-top">
              <span>{stat.label}</span>
              <Icon name={stat.icon} />
            </div>
            <div className={stat.label === "Last visit" ? "" : "stat-value"} style={stat.label === "Last visit" ? { fontSize: 15, marginTop: 10 } : undefined}>
              {stat.value}
            </div>
            {stat.label === "Total spent" ? <div className="stat-foot">Avg {formatMoney(customer.insights.averageSpend, context.salon.currency, context.salon.locale)}</div> : null}
            {stat.label === "Reward points" && customer.insights.favoriteService ? <div className="stat-foot">Loves {customer.insights.favoriteService}</div> : null}
          </div>
        ))}
      </div>

      <div className="split">
        <div className="stack">
          <section className="card">
            <div className="card-head">
              <h2>Appointment history</h2>
              <span className="badge badge-plain">{customer.appointments.length} recent</span>
            </div>
            {customer.appointments.length ? (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>When</th>
                      <th>Service</th>
                      <th className="hide-mobile">Staff</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customer.appointments.map((appointment) => (
                      <tr key={appointment.id}>
                        <td>{formatDate(appointment.startAt, context.salon.timezone, context.salon.locale)}</td>
                        <td>{appointment.service}</td>
                        <td className="hide-mobile">{appointment.staff}</td>
                        <td><StatusBadge status={appointment.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState icon="calendar" title="No appointments yet" message="Book a service to start this customer's visit history." />
            )}
          </section>

          <section className="card">
            <div className="card-head">
              <h2>Bills</h2>
              {hasPermission(context, "billing.read") ? (
                <Link href={`/billing?q=${encodeURIComponent(customer.name)}`} className="btn btn-ghost btn-sm">
                  All invoices <Icon name="arrow" />
                </Link>
              ) : null}
            </div>
            {customer.invoices.length ? (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Bill</th>
                      <th>Date</th>
                      <th className="num">Total</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customer.invoices.map((invoice) => (
                      <tr key={invoice.id}>
                        <td>
                          <Link href={`/billing/${invoice.id}`} className="link">
                            {invoice.number}
                          </Link>
                        </td>
                        <td>{formatDay(invoice.createdAt, context.salon.timezone, context.salon.locale)}</td>
                        <td className="num">{formatMoney(invoice.total, context.salon.currency, context.salon.locale)}</td>
                        <td><StatusBadge status={invoice.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState icon="receipt" title="No bills yet" message="Bills will appear here." />
            )}
          </section>
        </div>

        <div className="stack">
          <section className="card">
            <div className="card-head">
              <h2>Contact & notes</h2>
            </div>
            <div className="card-body stack" style={{ gap: 14 }}>
              <div>
                <div className="field-label">Phone</div>
                <a href={`tel:${customer.phone}`} className="link">{customer.phone}</a>
              </div>
              <div>
                <div className="field-label">Email</div>
                {customer.email ? <a href={`mailto:${customer.email}`} className="link">{customer.email}</a> : <span className="hint">Not provided</span>}
              </div>
              <div>
                <div className="field-label">Birthday</div>
                <span>{customer.birthday ? formatDateOnly(customer.birthday, context.salon.locale) : "Not saved"}</span>
              </div>
              <div>
                <div className="field-label">Anniversary</div>
                <span>{customer.anniversary ? formatDateOnly(customer.anniversary, context.salon.locale) : "Not saved"}</span>
              </div>
              <div>
                <div className="field-label">Preferred staff</div>
                <span>{customer.preferredStaff || "No preference"}</span>
              </div>
              <div>
                <div className="field-label">How they found us</div>
                <span>{customer.source || "Not recorded"}</span>
              </div>
              <div>
                <div className="field-label">Messages</div>
                <span>{customer.marketingOptIn ? "Happy to receive offers" : "Do not send offers"}</span>
              </div>
              <div>
                <div className="field-label">Preferences</div>
                <p style={{ margin: 0, fontSize: 12.5, color: "var(--ink-soft)" }}>{customer.preferences || "No preferences recorded."}</p>
              </div>
              <div>
                <div className="field-label">Private notes</div>
                <p style={{ margin: 0, fontSize: 12.5, color: "var(--ink-soft)", whiteSpace: "pre-wrap" }}>{customer.notes || "No notes recorded."}</p>
              </div>
            </div>
          </section>

          <section className="card">
            <div className="card-head">
              <h2>Waiting list visits</h2>
            </div>
            <div className="card-body">
              {customer.queueTickets.length ? (
                <div className="stack" style={{ gap: 8 }}>
                  {customer.queueTickets.map((ticket) => (
                    <div key={ticket.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 12.5 }}>
                      <span>Number {ticket.queueNumber}</span>
                      <StatusBadge status={ticket.status} />
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ margin: 0, color: "var(--muted)", fontSize: 12.5 }}>No recent visits without booking.</p>
              )}
            </div>
          </section>
        </div>
      </div>

      <CustomerCrm
        customerId={customer.id}
        customerName={customer.name}
        notes={customer.notesTimeline}
        followUps={customer.followUps}
        members={staff}
        timezone={context.salon.timezone}
        locale={context.salon.locale}
        canWrite={hasPermission(context, "customers.write")}
      />
    </div>
  );
}
