import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { LeaveStatus } from "@prisma/client";
import { requireTenantPage } from "@/lib/guards";
import { hasPermission } from "@/lib/auth";
import { zonedDateInput, zonedDayBounds, zonedStartOfDay } from "@/lib/timezone";
import { formatDateOnly, formatDay, formatMoney, initials } from "@/lib/utils";
import { ATTENDANCE_STATUS_LABELS, EMPLOYMENT_TYPE_LABELS, type AttendanceStatusValue, type EmploymentTypeValue } from "@/lib/hr";
import {
  canSeeAllHr,
  getEmployeePerformance,
  getHrSummary,
  listAdvances,
  listAttendance,
  listDocuments,
  listHrMembers,
  listLeaveRequests,
  listSalaryPayments,
} from "@/services/hr";
import { AttendanceBoard } from "@/components/hr/attendance-board";
import { LeavePanel } from "@/components/hr/leave-panel";
import { SalaryPanel } from "@/components/hr/salary-panel";
import { AdvancePanel } from "@/components/hr/advance-panel";
import { DocumentPanel } from "@/components/hr/document-panel";
import { EmployeeDialog } from "@/components/hr/employee-dialog";
import { EmptyState } from "@/components/ui/empty";
import { Icon } from "@/components/ui/icons";

export const metadata: Metadata = { title: "Work & pay" };
export const dynamic = "force-dynamic";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "attendance", label: "Attendance" },
  { id: "leave", label: "Leave" },
  { id: "pay", label: "Salary & advances" },
  { id: "documents", label: "Documents" },
  { id: "performance", label: "Performance" },
] as const;

type TabId = (typeof TABS)[number]["id"];

function monthBounds(today: string) {
  const start = `${today.slice(0, 8)}01`;
  const endDate = new Date(`${start}T12:00:00.000Z`);
  endDate.setUTCMonth(endDate.getUTCMonth() + 1);
  endDate.setUTCDate(0);
  return { start, end: endDate.toISOString().slice(0, 10) };
}

export default async function StaffPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const context = await requireTenantPage();
  if (!canSeeAllHr(context)) {
    redirect(hasPermission(context, "hr.self") ? "/my-work" : "/dashboard");
  }
  const params = await searchParams;
  const single = (key: string) => (Array.isArray(params[key]) ? params[key]?.[0] : params[key]);
  const rawTab = single("tab");
  const tab: TabId = TABS.some((item) => item.id === rawTab) ? (rawTab as TabId) : "overview";
  const today = zonedDateInput(new Date(), context.salon.timezone);
  const month = monthBounds(today);
  const date = single("date") || today;
  const canWrite = hasPermission(context, "hr.write");
  const canDeleteSalary = context.role === "OWNER" || context.role === "ADMIN";

  const [summary, members] = await Promise.all([getHrSummary(context), listHrMembers(context)]);

  const attendance =
    tab === "attendance" ? await listAttendance(context, date) : [];
  const leaveStatus = single("status");
  const leaves =
    tab === "leave"
      ? await listLeaveRequests(context, {
          status: ["PENDING", "APPROVED", "REJECTED", "CANCELLED"].includes(leaveStatus || "")
            ? (leaveStatus as LeaveStatus)
            : undefined,
        })
      : [];
  const [salaries, advances] =
    tab === "pay"
      ? await Promise.all([listSalaryPayments(context, {}), listAdvances(context, {})])
      : [[], []];
  const documents = tab === "documents" ? await listDocuments(context) : [];

  const performanceMemberId = single("employee") || members[0]?.id || context.membership.id;
  const perfFrom = single("from") || month.start;
  const perfTo = single("to") || today;
  const performance =
    tab === "performance"
      ? await getEmployeePerformance(
          context,
          performanceMemberId,
          zonedStartOfDay(perfFrom, context.salon.timezone),
          zonedDayBounds(perfTo, context.salon.timezone).to,
        )
      : null;

  const activeMembers = members.filter((member) => member.active);

  return (
    <div className="stack" style={{ gap: 20 }}>
      <div className="page-head">
        <div>
          <h1>Work &amp; pay</h1>
          <p className="page-subtitle">Attendance, leave, salary, documents, and how your team is doing.</p>
        </div>
        <div className="page-actions">
          {hasPermission(context, "hr.self") ? (
            <Link href="/my-work" className="btn btn-secondary">
              <Icon name="user" /> My work
            </Link>
          ) : null}
          <Link href="/team" className="btn btn-ghost">
            <Icon name="team" /> Team &amp; roles
          </Link>
        </div>
      </div>

      <div className="grid-4">
        <div className="stat-card">
          <div className="stat-top"><span>In today</span><Icon name="check" /></div>
          <div className="stat-value">{summary.present}</div>
          <div className="stat-foot">{summary.unmarked} not marked · {summary.onLeave} on leave</div>
        </div>
        <div className="stat-card">
          <div className="stat-top"><span>Leave waiting</span><Icon name="calendar" /></div>
          <div className="stat-value">{summary.pendingLeave}</div>
          <div className="stat-foot">Requests to review</div>
        </div>
        <div className="stat-card">
          <div className="stat-top"><span>Salary paid this month</span><Icon name="money" /></div>
          <div className="stat-value">{formatMoney(summary.payrollThisMonth, context.salon.currency, context.salon.locale)}</div>
          <div className="stat-foot">{summary.payrollCount} salary payment{summary.payrollCount === 1 ? "" : "s"}</div>
        </div>
        <div className="stat-card">
          <div className="stat-top"><span>Missing documents</span><Icon name="file" /></div>
          <div className="stat-value">{summary.missingDocs}</div>
          <div className="stat-foot">Aadhaar or PAN not saved</div>
        </div>
      </div>

      <div className="tabs">
        {TABS.map((item) => (
          <Link key={item.id} href={`/staff?tab=${item.id}`} className={`tab ${tab === item.id ? "active" : ""}`}>
            {item.label}
            {item.id === "leave" && summary.pendingLeave ? ` (${summary.pendingLeave})` : ""}
          </Link>
        ))}
      </div>

      {tab === "overview" ? (
        <div className="stack" style={{ gap: 18 }}>
          <section className="card">
            <div className="card-head">
              <div>
                <h2>People</h2>
                <p>{activeMembers.length} active · {members.length} total</p>
              </div>
              <Link href="/team" className="btn btn-ghost btn-sm">
                Invite someone <Icon name="arrow" />
              </Link>
            </div>
            {members.length ? (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Staff</th>
                      <th>Role</th>
                      <th className="hide-mobile">Employment</th>
                      <th className="hide-mobile num">Monthly salary</th>
                      <th>Documents</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {members.map((member) => (
                      <tr key={member.id}>
                        <td>
                          <div className="member-cell">
                            <span className="avatar">{initials(member.name)}</span>
                            <span>
                              <span className="cell-title">{member.name}</span>
                              <span className="cell-sub">{member.profile.jobTitle || member.email}</span>
                            </span>
                          </div>
                        </td>
                        <td><span className="badge badge-plain">{member.role}</span></td>
                        <td className="hide-mobile">
                          {EMPLOYMENT_TYPE_LABELS[member.profile.employmentType as EmploymentTypeValue] || member.profile.employmentType}
                          {member.profile.hiredAt ? <div className="cell-sub">Since {formatDateOnly(member.profile.hiredAt, context.salon.locale)}</div> : null}
                        </td>
                        <td className="hide-mobile num">
                          {member.profile.monthlySalary
                            ? formatMoney(member.profile.monthlySalary, context.salon.currency, context.salon.locale)
                            : "Not set"}
                        </td>
                        <td>
                          <span className={`badge ${member.profile.onboardingComplete ? "badge-success" : "badge-warning"}`}>
                            {member.profile.onboardingComplete ? "Onboarded" : "In progress"}
                          </span>
                          <div className="cell-sub">{member.documents} file{member.documents === 1 ? "" : "s"}</div>
                        </td>
                        <td>
                          <div className="actions">
                            <Link href={`/staff?tab=performance&employee=${member.id}`} className="btn btn-ghost btn-sm">
                              Performance
                            </Link>
                            {canWrite ? (
                              <EmployeeDialog
                                member={member}
                                currency={context.salon.currency}
                                locale={context.salon.locale}
                                variant="ghost"
                                label="Edit"
                              />
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState icon="team" title="No team members" message="Invite staff to start tracking attendance and salary." />
            )}
          </section>
          {summary.pendingAdvanceCount > 0 ? (
            <section className="card">
              <div className="card-head">
                <div>
                  <h2>Advances waiting</h2>
                  <p>{summary.pendingAdvanceCount} request{summary.pendingAdvanceCount === 1 ? "" : "s"} · {formatMoney(summary.pendingAdvanceAmount, context.salon.currency, context.salon.locale)}</p>
                </div>
                <Link href="/staff?tab=pay" className="btn btn-secondary btn-sm">Review</Link>
              </div>
            </section>
          ) : null}
        </div>
      ) : null}

      {tab === "attendance" ? (
        <AttendanceBoard
          key={date}
          date={date}
          rows={attendance}
          timezone={context.salon.timezone}
          locale={context.salon.locale}
          canWrite={canWrite}
        />
      ) : null}

      {tab === "leave" ? (
        <div className="stack" style={{ gap: 14 }}>
          <div className="tabs">
            <Link href="/staff?tab=leave" className={`tab ${!leaveStatus ? "active" : ""}`}>All</Link>
            <Link href="/staff?tab=leave&status=PENDING" className={`tab ${leaveStatus === "PENDING" ? "active" : ""}`}>Waiting</Link>
            <Link href="/staff?tab=leave&status=APPROVED" className={`tab ${leaveStatus === "APPROVED" ? "active" : ""}`}>Approved</Link>
            <Link href="/staff?tab=leave&status=REJECTED" className={`tab ${leaveStatus === "REJECTED" ? "active" : ""}`}>Rejected</Link>
          </div>
          <LeavePanel
            rows={leaves}
            members={canWrite ? activeMembers.map((member) => ({ id: member.id, name: member.name })) : []}
            selfMembershipId={context.membership.id}
            today={today}
            locale={context.salon.locale}
            canDecide={canWrite}
            canRequest
            showMember
          />
        </div>
      ) : null}

      {tab === "pay" ? (
        <div className="stack" style={{ gap: 18 }}>
          <SalaryPanel
            rows={salaries}
            members={activeMembers.map((member) => ({ id: member.id, name: member.name, profile: { monthlySalary: member.profile.monthlySalary } }))}
            currency={context.salon.currency}
            locale={context.salon.locale}
            timezone={context.salon.timezone}
            defaultPeriodStart={month.start}
            defaultPeriodEnd={month.end}
            canWrite={canWrite}
            canDelete={canDeleteSalary}
          />
          <AdvancePanel
            rows={advances}
            members={canWrite ? activeMembers.map((member) => ({ id: member.id, name: member.name })) : []}
            selfMembershipId={context.membership.id}
            currency={context.salon.currency}
            locale={context.salon.locale}
            timezone={context.salon.timezone}
            canDecide={canWrite}
            canRequest
            showMember
          />
        </div>
      ) : null}

      {tab === "documents" ? (
        <DocumentPanel
          rows={documents}
          members={activeMembers.map((member) => ({ id: member.id, name: member.name }))}
          selfMembershipId={context.membership.id}
          timezone={context.salon.timezone}
          locale={context.salon.locale}
          canWrite={canWrite}
          showMember
        />
      ) : null}

      {tab === "performance" && performance ? (
        <div className="stack" style={{ gap: 18 }}>
          <section className="card">
            <div className="card-head">
              <div>
                <h2>Performance</h2>
                <p>Work, sales, and pay for the chosen period.</p>
              </div>
            </div>
            <div className="card-body">
              <form method="get" action="/staff" className="filter-bar">
                <input type="hidden" name="tab" value="performance" />
                <div className="field">
                  <label htmlFor="performance-member">Staff</label>
                  <select id="performance-member" name="employee" className="select" defaultValue={performanceMemberId}>
                    {members.map((member) => (
                      <option key={member.id} value={member.id}>{member.name}</option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="performance-from">From</label>
                  <input id="performance-from" name="from" type="date" className="input" defaultValue={perfFrom} />
                </div>
                <div className="field">
                  <label htmlFor="performance-to">To</label>
                  <input id="performance-to" name="to" type="date" className="input" defaultValue={perfTo} />
                </div>
                <button type="submit" className="btn btn-secondary">Show</button>
              </form>
            </div>
          </section>

          <div className="grid-4">
            <div className="stat-card">
              <div className="stat-top"><span>Appointments</span><Icon name="calendar" /></div>
              <div className="stat-value">{performance.appointments}</div>
              <div className="stat-foot">{performance.completed} completed · {performance.completionRate}%</div>
            </div>
            <div className="stat-card">
              <div className="stat-top"><span>Sales handled</span><Icon name="money" /></div>
              <div className="stat-value">{formatMoney(performance.revenue, context.salon.currency, context.salon.locale)}</div>
              <div className="stat-foot">Commission {formatMoney(performance.commission, context.salon.currency, context.salon.locale)}</div>
            </div>
            <div className="stat-card">
              <div className="stat-top"><span>Attendance</span><Icon name="check" /></div>
              <div className="stat-value">{performance.attendance.rate}%</div>
              <div className="stat-foot">{performance.attendance.present} present · {performance.attendance.absent} absent</div>
            </div>
            <div className="stat-card">
              <div className="stat-top"><span>Salary paid</span><Icon name="wallet" /></div>
              <div className="stat-value">{formatMoney(performance.salaryPaid, context.salon.currency, context.salon.locale)}</div>
              <div className="stat-foot">{performance.advancesPaid ? `${formatMoney(performance.advancesPaid, context.salon.currency, context.salon.locale)} advances` : "No advances"}</div>
            </div>
          </div>

          <div className="grid-2">
            <section className="card">
              <div className="card-head">
                <h2>Top services</h2>
              </div>
              {performance.topServices.length ? (
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr><th>Service</th><th className="num">Count</th><th className="num">Sales</th></tr>
                    </thead>
                    <tbody>
                      {performance.topServices.map((service) => (
                        <tr key={service.name}>
                          <td>{service.name}</td>
                          <td className="num">{service.count}</td>
                          <td className="num">{formatMoney(service.revenue, context.salon.currency, context.salon.locale)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState icon="service" title="No sales yet" message="Services completed in this period will appear here." />
              )}
            </section>
            <section className="card">
              <div className="card-head">
                <h2>Attendance detail</h2>
              </div>
              <div className="card-body stack" style={{ gap: 10 }}>
                {(Object.entries(performance.attendance.breakdown) as Array<[string, number]>).map(([status, count]) => (
                  <div key={status} className="row-between">
                    <span>{ATTENDANCE_STATUS_LABELS[status as AttendanceStatusValue] || status}</span>
                    <strong>{count} day{count === 1 ? "" : "s"}</strong>
                  </div>
                ))}
                {!Object.keys(performance.attendance.breakdown).length ? (
                  <p style={{ margin: 0, color: "var(--muted)", fontSize: 12.5 }}>No attendance marked for this period.</p>
                ) : null}
                <div className="row-between" style={{ paddingTop: 8, borderTop: "1px solid var(--line)" }}>
                  <span>Approved leave</span>
                  <strong>{performance.approvedLeaves} day{performance.approvedLeaves === 1 ? "" : "s"}</strong>
                </div>
                <div className="row-between">
                  <span>Last update</span>
                  <span className="hint">{formatDay(new Date(), context.salon.timezone, context.salon.locale)}</span>
                </div>
              </div>
            </section>
          </div>
        </div>
      ) : null}
    </div>
  );
}
