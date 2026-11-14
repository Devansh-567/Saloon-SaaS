import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireTenantPage } from "@/lib/guards";
import { hasPermission } from "@/lib/auth";
import { formatDateOnly, formatDay, formatMinutes, formatMoney, formatTime, initials } from "@/lib/utils";
import { ATTENDANCE_STATUS_LABELS, attendanceTone, EMPLOYMENT_TYPE_LABELS, PAYMENT_METHOD_LABELS, type EmploymentTypeValue, type PaymentMethodValue } from "@/lib/hr";
import type { AttendanceStatus } from "@prisma/client";
import { canSeeAllHr, getMyWork } from "@/services/hr";
import { LeavePanel } from "@/components/hr/leave-panel";
import { AdvancePanel } from "@/components/hr/advance-panel";
import { DocumentPanel } from "@/components/hr/document-panel";
import { EmptyState } from "@/components/ui/empty";
import { Icon } from "@/components/ui/icons";

export const metadata: Metadata = { title: "My work" };
export const dynamic = "force-dynamic";

function leaveDays(start: string, end: string) {
  const first = new Date(`${start}T00:00:00.000Z`);
  const last = new Date(`${end}T00:00:00.000Z`);
  return Math.max(1, Math.round((last.getTime() - first.getTime()) / 86400000) + 1);
}

export default async function MyWorkPage() {
  const context = await requireTenantPage();
  if (!hasPermission(context, "hr.self") && !canSeeAllHr(context)) redirect("/dashboard");
  const data = await getMyWork(context);
  const profile = data.profile;
  const latest = data.latestAttendance;
  const todayStatus = latest ? (latest.status as AttendanceStatus) : null;

  return (
    <div className="stack" style={{ gap: 20 }}>
      <div className="page-head">
        <div>
          <h1>My work</h1>
          <p className="page-subtitle">Your attendance, leave, pay, and documents — all in one place.</p>
        </div>
        <div className="page-actions">
          {canSeeAllHr(context) ? (
            <Link href="/staff" className="btn btn-secondary">
              <Icon name="team" /> Staff records
            </Link>
          ) : null}
        </div>
      </div>

      <section className="card">
        <div className="card-body" style={{ display: "flex", gap: 16, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: 13, alignItems: "center" }}>
            <span className="avatar lg">{initials(context.user.name)}</span>
            <div>
              <div style={{ fontWeight: 650, fontSize: 17 }}>{context.user.name}</div>
              <div className="hint">
                {profile.jobTitle || context.role}
                {profile.hiredAt ? ` · joined ${formatDateOnly(profile.hiredAt, context.salon.locale)}` : ""}
              </div>
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div className="field-label">Today · {formatDateOnly(data.today, context.salon.locale)}</div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "flex-end", marginTop: 4 }}>
              <span className={`badge ${attendanceTone(todayStatus)}`}>
                {todayStatus ? ATTENDANCE_STATUS_LABELS[todayStatus] : "Not marked yet"}
              </span>
              {latest?.checkInAt ? <span className="hint">In {formatTime(latest.checkInAt, context.salon.timezone, context.salon.locale)}</span> : null}
              {latest?.checkOutAt ? <span className="hint">Out {formatTime(latest.checkOutAt, context.salon.timezone, context.salon.locale)}</span> : null}
            </div>
            {latest?.workedMinutes ? <div className="hint" style={{ marginTop: 3 }}>{formatMinutes(latest.workedMinutes)} worked</div> : null}
          </div>
        </div>
      </section>

      <div className="grid-4">
        <div className="stat-card">
          <div className="stat-top"><span>Present this month</span><Icon name="check" /></div>
          <div className="stat-value">{data.attendanceSummary.present}</div>
          <div className="stat-foot">{data.attendanceSummary.halfDay} half day · {data.attendanceSummary.marked} marked</div>
        </div>
        <div className="stat-card">
          <div className="stat-top"><span>Leave waiting</span><Icon name="calendar" /></div>
          <div className="stat-value">{data.pendingLeave}</div>
          <div className="stat-foot">{data.attendanceSummary.leave} leave day{data.attendanceSummary.leave === 1 ? "" : "s"} this month</div>
        </div>
        <div className="stat-card">
          <div className="stat-top"><span>Advance balance</span><Icon name="money" /></div>
          <div className="stat-value">{formatMoney(data.pendingAdvanceAmount, context.salon.currency, context.salon.locale)}</div>
          <div className="stat-foot">{data.pendingAdvanceCount} request{data.pendingAdvanceCount === 1 ? "" : "s"} open</div>
        </div>
        <div className="stat-card">
          <div className="stat-top"><span>Salary this month</span><Icon name="wallet" /></div>
          <div className="stat-value">{formatMoney(data.performance.salaryPaid, context.salon.currency, context.salon.locale)}</div>
          <div className="stat-foot">{profile.monthlySalary ? `${formatMoney(profile.monthlySalary, context.salon.currency, context.salon.locale)} monthly` : "Salary not set"}</div>
        </div>
      </div>

      <div className="split">
        <div className="stack">
          <LeavePanel
            rows={data.leaves.map((leave) => ({
              ...leave,
              membershipId: context.membership.id,
              member: context.user.name,
              days: leaveDays(leave.startDate, leave.endDate),
              decidedBy: null,
              decidedAt: null,
            }))}
            members={[]}
            selfMembershipId={context.membership.id}
            today={data.today}
            locale={context.salon.locale}
            canDecide={false}
            canRequest
            showMember={false}
          />
          <section className="card">
            <div className="card-head">
              <div>
                <h2>Payslips</h2>
                <p>Payments recorded by your salon.</p>
              </div>
            </div>
            {data.salaries.length ? (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Period</th>
                      <th className="num">Net pay</th>
                      <th>Method</th>
                      <th className="hide-mobile">Paid on</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.salaries.map((salary) => (
                      <tr key={salary.id}>
                        <td>
                          <span className="cell-title">{formatDateOnly(salary.periodStart, context.salon.locale)} – {formatDateOnly(salary.periodEnd, context.salon.locale)}</span>
                          {salary.notes ? <div className="cell-sub">{salary.notes}</div> : null}
                        </td>
                        <td className="num"><strong>{formatMoney(salary.netAmount, context.salon.currency, context.salon.locale)}</strong></td>
                        <td>{PAYMENT_METHOD_LABELS[salary.method as PaymentMethodValue] || salary.method}</td>
                        <td className="hide-mobile">{formatDay(salary.paidAt, context.salon.timezone, context.salon.locale)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState icon="wallet" title="No payslips yet" message="Salary payments will show here once your owner records them." />
            )}
          </section>
          <section className="card">
            <div className="card-head">
              <div>
                <h2>Attendance this month</h2>
                <p>{data.attendanceSummary.marked} days recorded</p>
              </div>
            </div>
            {data.attendance.length ? (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Day</th>
                      <th>Status</th>
                      <th className="hide-mobile">In</th>
                      <th className="hide-mobile">Out</th>
                      <th className="hide-mobile">Hours</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.attendance.map((record) => (
                      <tr key={record.id}>
                        <td>{formatDateOnly(record.date, context.salon.locale)}</td>
                        <td>
                          <span className={`badge ${attendanceTone(record.status as AttendanceStatus)}`}>
                            {ATTENDANCE_STATUS_LABELS[record.status as keyof typeof ATTENDANCE_STATUS_LABELS] || record.status}
                          </span>
                        </td>
                        <td className="hide-mobile">{record.checkIn ? formatTime(record.checkIn, context.salon.timezone, context.salon.locale) : "—"}</td>
                        <td className="hide-mobile">{record.checkOut ? formatTime(record.checkOut, context.salon.timezone, context.salon.locale) : "—"}</td>
                        <td className="hide-mobile">{record.workedMinutes ? formatMinutes(record.workedMinutes) : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState icon="calendar" title="No attendance yet" message="Your marked days will appear here." />
            )}
          </section>
        </div>

        <div className="stack">
          <section className="card">
            <div className="card-head">
              <h2>My details</h2>
            </div>
            <div className="card-body stack" style={{ gap: 12 }}>
              <div>
                <div className="field-label">Employment</div>
                <div>{EMPLOYMENT_TYPE_LABELS[profile.employmentType as EmploymentTypeValue] || profile.employmentType}</div>
              </div>
              <div>
                <div className="field-label">Monthly salary</div>
                <div>{profile.monthlySalary ? formatMoney(profile.monthlySalary, context.salon.currency, context.salon.locale) : "Not set"}</div>
              </div>
              <div>
                <div className="field-label">Pay day</div>
                <div>Day {profile.payDay} of each month</div>
              </div>
              <div>
                <div className="field-label">Aadhaar</div>
                <div>{profile.aadhaarMasked || "Not saved"}</div>
              </div>
              <div>
                <div className="field-label">PAN</div>
                <div>{profile.panMasked || "Not saved"}</div>
              </div>
              <div>
                <div className="field-label">Emergency contact</div>
                <div>{profile.emergencyContactName || "Not saved"}{profile.emergencyContactPhone ? ` · ${profile.emergencyContactPhone}` : ""}</div>
              </div>
              <p className="hint" style={{ margin: 0 }}>Ask your owner or manager to update these details.</p>
            </div>
          </section>

          <section className="card">
            <div className="card-head">
              <h2>This month</h2>
            </div>
            <div className="card-body">
              <div className="stat-card" style={{ boxShadow: "none", padding: 0, border: 0 }}>
                <div className="stat-top"><span>Sales handled</span><Icon name="money" /></div>
                <div className="stat-value">{formatMoney(data.performance.revenue, context.salon.currency, context.salon.locale)}</div>
                <div className="stat-foot">{data.performance.completed} of {data.performance.appointments} appointments completed</div>
              </div>
              {data.performance.topServices.length ? (
                <div className="stack" style={{ gap: 8, marginTop: 16 }}>
                  {data.performance.topServices.slice(0, 4).map((service) => (
                    <div key={service.name} className="row-between" style={{ fontSize: 12.5 }}>
                      <span>{service.name} <span className="hint">×{service.count}</span></span>
                      <span>{formatMoney(service.revenue, context.salon.currency, context.salon.locale)}</span>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </section>
        </div>
      </div>

      <AdvancePanel
        rows={data.advances.map((advance) => ({
          ...advance,
          membershipId: context.membership.id,
          member: context.user.name,
          decidedBy: null,
          decidedAt: null,
          notes: null,
        }))}
        members={[]}
        selfMembershipId={context.membership.id}
        currency={context.salon.currency}
        locale={context.salon.locale}
        timezone={context.salon.timezone}
        canDecide={false}
        canRequest
        showMember={false}
      />

      <DocumentPanel
        rows={data.documents.map((document) => ({
          ...document,
          membershipId: context.membership.id,
          member: context.user.name,
          mimeType: "",
        }))}
        members={[]}
        selfMembershipId={context.membership.id}
        timezone={context.salon.timezone}
        locale={context.salon.locale}
        canWrite={false}
        showMember={false}
      />
    </div>
  );
}
