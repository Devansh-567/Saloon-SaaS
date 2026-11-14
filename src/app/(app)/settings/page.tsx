import type { Metadata } from "next";
import { requireTenantPage } from "@/lib/guards";
import { hasPermission } from "@/lib/auth";
import { getSalonSettingsData } from "@/services/salon-config";
import { formatDay } from "@/lib/utils";
import { BranchesPanel, SalonProfilePanel } from "@/components/settings/settings-panel";

export const metadata: Metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const context = await requireTenantPage("settings.write");
  const data = await getSalonSettingsData(context);
  const canWrite = hasPermission(context, "settings.write");

  return (
    <div className="stack" style={{ gap: 20 }}>
      <div className="page-head">
        <div>
          <h1>Settings</h1>
          <p className="page-subtitle">Business identity, operating defaults, and branch locations.</p>
        </div>
      </div>

      <SalonProfilePanel
        salon={{
          name: data.salon.name,
          email: data.salon.email,
          phone: data.salon.phone,
          address: data.salon.address,
          timezone: data.salon.timezone,
          currency: data.salon.currency,
          locale: data.salon.locale,
          logoFileId: data.salon.logoFileId,
          settings: data.salon.settings,
        }}
      />

      <BranchesPanel
        branches={data.branches.map((branch) => ({
          id: branch.id,
          name: branch.name,
          phone: branch.phone,
          address: branch.address,
          isPrimary: branch.isPrimary,
          active: branch.active,
        }))}
        canWrite={canWrite}
      />

      {data.subscription ? (
        <section className="card">
          <div className="card-head">
            <div>
              <h2>Subscription</h2>
              <p>Managed by the platform team.</p>
            </div>
            <span className={`badge ${data.subscription.status === "ACTIVE" ? "badge-success" : "badge-warning"}`}>
              {data.subscription.status.replaceAll("_", " ").toLowerCase()}
            </span>
          </div>
          <div className="card-body">
            <div className="grid-3">
              <div className="stat-card">
                <div className="stat-top"><span>Plan</span></div>
                <div className="stat-value" style={{ fontSize: 20 }}>{data.subscription.plan.name}</div>
                <div className="stat-foot">
                  {Array.isArray(data.subscription.plan.features) ? data.subscription.plan.features.length : 0} features included
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-top"><span>Trial ends</span></div>
                <div className="stat-value" style={{ fontSize: 20 }}>
                  {data.subscription.trialEndsAt ? formatDay(data.subscription.trialEndsAt, context.salon.timezone, context.salon.locale) : "—"}
                </div>
                <div className="stat-foot">After this date, billing begins</div>
              </div>
              <div className="stat-card">
                <div className="stat-top"><span>Current period</span></div>
                <div className="stat-value" style={{ fontSize: 20 }}>
                  {data.subscription.currentPeriodEnd ? formatDay(data.subscription.currentPeriodEnd, context.salon.timezone, context.salon.locale) : "—"}
                </div>
                <div className="stat-foot">
                  {Object.entries(data.subscription.plan.limits || {})
                    .map(([key, value]) => `${key.replace("max", "max ").toLowerCase()}: ${value}`)
                    .join(" · ") || "No limits"}
                </div>
              </div>
            </div>
            <p className="hint" style={{ marginTop: 14 }}>
              Need a change? Contact platform support. Your current plan covers up to{" "}
              {(data.subscription.plan.limits as { maxStaff?: number })?.maxStaff
                ? `${(data.subscription.plan.limits as { maxStaff?: number }).maxStaff} staff`
                : "unlimited staff"}
              {" and "}
              {(data.subscription.plan.limits as { maxBranches?: number })?.maxBranches
                ? `${(data.subscription.plan.limits as { maxBranches?: number }).maxBranches} branches`
                : "unlimited branches"}
              .
            </p>
          </div>
        </section>
      ) : null}

    </div>
  );
}
