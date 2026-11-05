import type { Metadata } from "next";
import Link from "next/link";
import { getPlatformDashboard, getPlatformSettings } from "@/services/platform";
import { formatDate, formatMoney } from "@/lib/utils";
import { StatusBadge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icons";

export const metadata: Metadata = { title: "Platform overview" };
export const dynamic = "force-dynamic";

export default async function PlatformOverviewPage() {
  const [data, settings] = await Promise.all([getPlatformDashboard(), getPlatformSettings()]);
  const number = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

  return (
    <div className="stack" style={{ gap: 20 }}>
      <div className="page-head">
        <div>
          <h1>Overview</h1>
          <p className="page-subtitle">{settings.platformName} · every salon on the platform at a glance.</p>
        </div>
      </div>

      {settings.notice ? (
        <div className="alert alert-info">
          <Icon name="info" />
          <span>{settings.notice}</span>
        </div>
      ) : null}

      <div className="grid-4">
        <div className="stat-card">
          <div className="stat-top">
            <span>Salons</span>
            <Icon name="building" />
          </div>
          <div className="stat-value">{data.salonCount}</div>
          <div className="stat-foot">
            {data.activeSalons} active · {data.suspendedSalons} suspended
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-top">
            <span>Subscriptions</span>
            <Icon name="card" />
          </div>
          <div className="stat-value">{data.activeSubscriptions}</div>
          <div className="stat-foot">{data.trials} on trial</div>
        </div>
        <div className="stat-card">
          <div className="stat-top">
            <span>MRR</span>
            <Icon name="money" />
          </div>
          <div className="stat-value">{formatMoney(data.mrr, "USD", "en-US")}</div>
          <div className="stat-foot">Active plans at list price</div>
        </div>
        <div className="stat-card">
          <div className="stat-top">
            <span>Invoiced volume</span>
            <Icon name="chart" />
          </div>
          <div className="stat-value">{number.format(data.gmv)}</div>
          <div className="stat-foot">Across all salons · mixed currencies</div>
        </div>
      </div>

      <div className="grid-3">
        <div className="stat-card">
          <div className="stat-top">
            <span>Customers</span>
            <Icon name="users" />
          </div>
          <div className="stat-value">{number.format(data.customerCount)}</div>
          <div className="stat-foot">Customer records platform-wide</div>
        </div>
        <div className="stat-card">
          <div className="stat-top">
            <span>Appointments</span>
            <Icon name="calendar" />
          </div>
          <div className="stat-value">{number.format(data.appointmentCount)}</div>
          <div className="stat-foot">All time, all statuses</div>
        </div>
        <div className="stat-card">
          <div className="stat-top">
            <span>Plan mix</span>
            <Icon name="sparkle" />
          </div>
          <div className="stat-value">{data.planCounts.length}</div>
          <div className="stat-foot">
            {data.planCounts.map((plan) => `${plan.name}: ${plan.count}`).join(" · ") || "No plans assigned"}
          </div>
        </div>
      </div>

      <div className="grid-2">
        <section className="card">
          <div className="card-head">
            <div>
              <h2>Newest salons</h2>
              <p>Recently onboarded businesses.</p>
            </div>
            <Link href="/platform/salons" className="btn btn-secondary btn-sm">Manage salons</Link>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Salon</th>
                  <th>Status</th>
                  <th className="hide-mobile">Joined</th>
                </tr>
              </thead>
              <tbody>
                {data.recentSalons.map((salon) => (
                  <tr key={salon.id}>
                    <td>
                      <Link className="link" href={`/platform/salons?q=${encodeURIComponent(salon.name)}`}>
                        {salon.name}
                      </Link>
                    </td>
                    <td><StatusBadge status={salon.status} /></td>
                    <td className="hide-mobile">{formatDate(salon.createdAt, "UTC", "en-US")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card">
          <div className="card-head">
            <div>
              <h2>Recent activity</h2>
              <p>Latest audited events across the platform.</p>
            </div>
            <Link href="/platform/audit" className="btn btn-secondary btn-sm">Full log</Link>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Action</th>
                  <th>Scope</th>
                  <th className="hide-mobile">When</th>
                </tr>
              </thead>
              <tbody>
                {data.recentAudit.map((log) => (
                  <tr key={log.id}>
                    <td>
                      <div className="cell-title">{log.action}</div>
                      <div className="cell-sub">{log.entityType}</div>
                    </td>
                    <td>{log.salon}</td>
                    <td className="hide-mobile">{formatDate(log.createdAt, "UTC", "en-US")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
