import type { Metadata } from "next";
import Link from "next/link";
import { AppointmentStatus } from "@prisma/client";
import { requireTenantPage } from "@/lib/guards";
import { hasPermission } from "@/lib/auth";
import { listAppointments } from "@/services/appointments";
import { getCustomer } from "@/services/customers";
import { getSalonSettingsData } from "@/services/salon-config";
import { formatMoney, formatTime } from "@/lib/utils";
import { zonedDateInput, zonedDayBounds } from "@/lib/timezone";
import { AppointmentDialog } from "@/components/appointments/appointment-dialog";
import { AppointmentActions } from "@/components/appointments/appointment-actions";
import { StatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty";
import { Icon } from "@/components/ui/icons";

export const metadata: Metadata = { title: "Appointments" };
export const dynamic = "force-dynamic";

export default async function AppointmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; status?: string; q?: string; customer?: string; page?: string; new?: string }>;
}) {
  const context = await requireTenantPage("appointments.read");
  const params = await searchParams;
  const date = params.date || zonedDateInput(new Date(), context.salon.timezone);
  const { from, to } = zonedDayBounds(date, context.salon.timezone);
  const page = Math.max(1, Number(params.page) || 1);
  const status = Object.values(AppointmentStatus).includes(params.status as AppointmentStatus)
    ? (params.status as AppointmentStatus)
    : undefined;
  const [data, settings, initialCustomer] = await Promise.all([
    listAppointments(context, { from, to, status, q: params.q, page, pageSize: 50 }),
    getSalonSettingsData(context),
    params.customer ? getCustomer(context, params.customer) : Promise.resolve(null),
  ]);
  const canWrite = hasPermission(context, "appointments.write");
  function shiftDate(value: string, offset: number) {
    const shifted = new Date(Date.parse(`${value}T12:00:00Z`));
    shifted.setUTCDate(shifted.getUTCDate() + offset);
    return shifted.toISOString().slice(0, 10);
  }
  function dayHref(value: string) {
    const query = new URLSearchParams();
    if (params.status) query.set("status", params.status);
    if (params.q) query.set("q", params.q);
    query.set("date", value);
    return `/appointments?${query.toString()}`;
  }

  return (
    <div className="stack" style={{ gap: 20 }}>
      <div className="page-head">
        <div>
          <h1>Appointments</h1>
          <p className="page-subtitle">The day at a glance, with booking, check-in, and completion in one flow.</p>
        </div>
        <div className="page-actions">
          {canWrite ? (
            <AppointmentDialog
              services={settings.services}
              staff={settings.staff}
              branches={settings.branches}
              initialCustomer={initialCustomer ? { id: initialCustomer.id, name: initialCustomer.name, phone: initialCustomer.phone, email: initialCustomer.email } : null}
              defaultDate={date}
              timezone={context.salon.timezone}
              autoOpen={params.new === "1"}
            />
          ) : null}
        </div>
      </div>

      <section className="card">
        <form className="toolbar" method="get">
          <div className="field">
            <label htmlFor="date" className="field-label">Date</label>
            <div className="inline-row">
              <Link href={dayHref(shiftDate(date, -1))} className="btn btn-ghost btn-sm" aria-label="Previous day">
                <Icon name="chevron" style={{ transform: "rotate(180deg)" }} />
              </Link>
              <input id="date" name="date" type="date" className="input" defaultValue={date} />
              <Link href={dayHref(shiftDate(date, 1))} className="btn btn-ghost btn-sm" aria-label="Next day">
                <Icon name="chevron" />
              </Link>
            </div>
          </div>
          <div className="field">
            <label htmlFor="status" className="field-label">Status</label>
            <select id="status" name="status" className="select" defaultValue={params.status || ""}>
              <option value="">All statuses</option>
              {Object.values(AppointmentStatus).map((value) => (
                <option key={value} value={value}>
                  {value.replaceAll("_", " ").toLowerCase()}
                </option>
              ))}
            </select>
          </div>
          <div className="field grow">
            <label htmlFor="q" className="field-label">Search</label>
            <input id="q" name="q" className="input search" defaultValue={params.q || ""} placeholder="Customer, phone, or service" />
          </div>
          <button type="submit" className="btn btn-secondary">
            <Icon name="filter" /> Apply
          </button>
          <Link href="/appointments" className="btn btn-ghost">Today</Link>
        </form>

        {data.items.length ? (
          <>
            <div className="agenda">
              {data.items.map((appointment) => (
                <div className="agenda-row" key={appointment.id}>
                  <div className="agenda-time">
                    {formatTime(appointment.startAt, context.salon.timezone, context.salon.locale)}
                    <span>{appointment.service.durationMin} min</span>
                  </div>
                  <div className="agenda-main">
                    <strong>
                      {appointment.customer.name} <span style={{ fontWeight: 400, color: "var(--muted)" }}>· {appointment.service.name}</span>
                    </strong>
                    <span>
                      {appointment.staff.name} · {appointment.branch.name}
                      {appointment.walkIn ? " · no booking" : ""}
                    </span>
                    {appointment.notes ? <span style={{ marginTop: 2 }}>{appointment.notes}</span> : null}
                  </div>
                  <div className="agenda-actions">
                    <StatusBadge status={appointment.status} />
                    {canWrite ? (
                      <>
                        <AppointmentDialog
                          services={settings.services}
                          staff={settings.staff}
                          branches={settings.branches}
                          defaultDate={date}
                          timezone={context.salon.timezone}
                          appointment={{
                            id: appointment.id,
                            customer: appointment.customer,
                            service: appointment.service,
                            staff: appointment.staff,
                            branch: appointment.branch,
                            startAt: appointment.startAt,
                            notes: appointment.notes,
                            walkIn: appointment.walkIn,
                          }}
                        />
                        <AppointmentActions id={appointment.id} status={appointment.status} />
                      </>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
            <div className="pagination">
              <span>{data.total} appointment{data.total === 1 ? "" : "s"} on this day</span>
              <span>
                Value scheduled:{" "}
                {formatMoney(
                  data.items.filter((a) => !["CANCELLED", "NO_SHOW"].includes(a.status)).reduce((sum, a) => sum + a.service.price, 0),
                  context.salon.currency,
                  context.salon.locale,
                )}
              </span>
            </div>
          </>
        ) : (
          <EmptyState
            icon="calendar"
            title="Nothing on the books"
            message="There are no appointments matching these filters. Change the date or book a new appointment."
            action={
              canWrite ? (
                <AppointmentDialog
                  services={settings.services}
                  staff={settings.staff}
                  branches={settings.branches}
                  initialCustomer={initialCustomer ? { id: initialCustomer.id, name: initialCustomer.name, phone: initialCustomer.phone, email: initialCustomer.email } : null}
                  defaultDate={date}
                  timezone={context.salon.timezone}
                />
              ) : null
            }
          />
        )}
      </section>
    </div>
  );
}
