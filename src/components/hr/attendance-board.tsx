"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest, errorMessage } from "@/lib/client";
import { ATTENDANCE_STATUSES, ATTENDANCE_STATUS_LABELS, attendanceTone, type AttendanceStatusValue } from "@/lib/hr";
import { formatDateOnly, initials } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";
import { EmptyState } from "@/components/ui/empty";
import { Icon } from "@/components/ui/icons";

type Row = {
  membershipId: string;
  name: string;
  role: string;
  branch: string | null;
  jobTitle: string | null;
  color: string | null;
  recordId: string | null;
  status: AttendanceStatusValue | null;
  checkIn: string | null;
  checkOut: string | null;
  workedMinutes: number | null;
  notes: string | null;
};

function timeValue(value: string | null, timezone: string) {
  if (!value) return "";
  try {
    return new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: timezone,
    }).format(new Date(value));
  } catch {
    return "";
  }
}

function shiftDate(date: string, days: number) {
  const next = new Date(`${date}T12:00:00.000Z`);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}

export function AttendanceBoard({
  date,
  rows,
  timezone,
  locale,
  canWrite,
}: {
  date: string;
  rows: Row[];
  timezone: string;
  locale: string;
  canWrite: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [items, setItems] = useState<Row[]>(rows);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [bulkPending, setBulkPending] = useState(false);
  const [error, setError] = useState("");

  function update(membershipId: string, patch: Partial<Row>) {
    setItems((current) => current.map((row) => (row.membershipId === membershipId ? { ...row, ...patch } : row)));
  }

  async function save(row: Row) {
    if (!row.status) {
      setError(`Choose a status for ${row.name}.`);
      return;
    }
    setPendingId(row.membershipId);
    setError("");
    try {
      await apiRequest("/api/hr/attendance", {
        method: "POST",
        body: JSON.stringify({
          membershipId: row.membershipId,
          date,
          status: row.status,
          checkIn: row.checkIn || null,
          checkOut: row.checkOut || null,
          notes: row.notes || null,
        }),
      });
      toast.success(`${row.name} marked ${ATTENDANCE_STATUS_LABELS[row.status].toLowerCase()}.`);
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPendingId(null);
    }
  }

  async function clear(row: Row) {
    if (!row.recordId) return;
    setPendingId(row.membershipId);
    setError("");
    try {
      await apiRequest(`/api/hr/attendance/${row.recordId}`, { method: "DELETE" });
      setItems((current) =>
        current.map((item) =>
          item.membershipId === row.membershipId
            ? { ...item, status: null, recordId: null, checkIn: null, checkOut: null, workedMinutes: null, notes: null }
            : item,
        ),
      );
      toast.success(`Attendance cleared for ${row.name}.`);
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPendingId(null);
    }
  }

  async function markEveryonePresent() {
    setBulkPending(true);
    setError("");
    try {
      await apiRequest("/api/hr/attendance", {
        method: "PUT",
        body: JSON.stringify({ date, status: "PRESENT", membershipIds: items.map((item) => item.membershipId) }),
      });
      toast.success("Everyone marked present.");
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBulkPending(false);
    }
  }

  return (
    <section className="card">
      <div className="card-head">
        <div>
          <h2>{formatDateOnly(date, locale)}</h2>
          <p>Mark who came in, their hours, and any notes.</p>
        </div>
        <div className="page-actions">
          <button type="button" className="icon-btn" aria-label="Previous day" onClick={() => router.push(`/staff?tab=attendance&date=${shiftDate(date, -1)}`)}>
            <Icon name="chevron" style={{ transform: "rotate(180deg)" }} />
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => router.push(`/staff?tab=attendance&date=${new Date().toISOString().slice(0, 10)}`)}>
            Today
          </button>
          <button type="button" className="icon-btn" aria-label="Next day" onClick={() => router.push(`/staff?tab=attendance&date=${shiftDate(date, 1)}`)}>
            <Icon name="chevron" />
          </button>
          {canWrite && items.length ? (
            <button type="button" className="btn btn-secondary btn-sm" onClick={markEveryonePresent} disabled={bulkPending}>
              {bulkPending ? "Saving…" : "Everyone present"}
            </button>
          ) : null}
        </div>
      </div>
      {error ? <div className="alert alert-error" style={{ margin: 16 }}>{error}</div> : null}
      {items.length ? (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Staff</th>
                <th>Status</th>
                <th className="hide-mobile">Check in</th>
                <th className="hide-mobile">Check out</th>
                <th className="hide-mobile">Note</th>
                {canWrite ? <th /> : null}
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={row.membershipId}>
                  <td>
                    <div className="member-cell">
                      <span className="avatar" style={{ background: row.color || undefined }}>{initials(row.name)}</span>
                      <span>
                        <span className="cell-title">{row.name}</span>
                        <span className="cell-sub">{row.jobTitle || row.role}{row.branch ? ` · ${row.branch}` : ""}</span>
                      </span>
                    </div>
                  </td>
                  <td>
                    <select
                      className="select"
                      aria-label={`Attendance for ${row.name}`}
                      value={row.status || ""}
                      disabled={!canWrite || pendingId === row.membershipId}
                      onChange={(event) => update(row.membershipId, { status: (event.target.value || null) as AttendanceStatusValue | null })}
                    >
                      <option value="">Not marked</option>
                      {ATTENDANCE_STATUSES.map((status) => (
                        <option key={status} value={status}>{ATTENDANCE_STATUS_LABELS[status]}</option>
                      ))}
                    </select>
                    <div style={{ marginTop: 4 }}>
                      <span className={`badge ${attendanceTone(row.status)}`}>{row.status ? ATTENDANCE_STATUS_LABELS[row.status] : "Not marked"}</span>
                    </div>
                  </td>
                  <td className="hide-mobile">
                    <input
                      type="time"
                      className="input"
                      aria-label={`Check in for ${row.name}`}
                      value={timeValue(row.checkIn, timezone)}
                      disabled={!canWrite || pendingId === row.membershipId}
                      onChange={(event) => update(row.membershipId, { checkIn: event.target.value || null })}
                    />
                  </td>
                  <td className="hide-mobile">
                    <input
                      type="time"
                      className="input"
                      aria-label={`Check out for ${row.name}`}
                      value={timeValue(row.checkOut, timezone)}
                      disabled={!canWrite || pendingId === row.membershipId}
                      onChange={(event) => update(row.membershipId, { checkOut: event.target.value || null })}
                    />
                    {row.workedMinutes ? <div className="cell-sub">{Math.floor(row.workedMinutes / 60)}h {row.workedMinutes % 60}m</div> : null}
                  </td>
                  <td className="hide-mobile">
                    <input
                      className="input"
                      aria-label={`Attendance note for ${row.name}`}
                      value={row.notes || ""}
                      disabled={!canWrite || pendingId === row.membershipId}
                      onChange={(event) => update(row.membershipId, { notes: event.target.value || null })}
                      placeholder="Optional"
                    />
                  </td>
                  {canWrite ? (
                    <td>
                      <div className="actions">
                        <button type="button" className="btn btn-primary btn-sm" onClick={() => save(row)} disabled={pendingId === row.membershipId}>
                          {pendingId === row.membershipId ? "Saving…" : "Save"}
                        </button>
                        {row.recordId ? (
                          <button type="button" className="icon-btn" title="Clear record" onClick={() => clear(row)} disabled={pendingId === row.membershipId}>
                            <Icon name="trash" />
                          </button>
                        ) : null}
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState icon="team" title="No active staff" message="Invite your team before marking attendance." />
      )}
    </section>
  );
}
