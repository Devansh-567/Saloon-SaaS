import type { Metadata } from "next";
import { requireTenantPage } from "@/lib/guards";
import { SecurityPanel } from "@/components/account/security-panel";
import { initials } from "@/lib/utils";

export const metadata: Metadata = { title: "Profile & security" };

export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ required?: string }> }) {
  const context = await requireTenantPage(undefined, { skipPasswordGate: true });
  const params = await searchParams;
  const required = params.required === "1" && context.user.mustChangePassword;

  return (
    <div className="stack">
      <div>
        <h1 style={{ marginBottom: 6 }}>Profile & security</h1>
        <p className="page-subtitle">Your account identity, password, and authentication settings.</p>
      </div>

      <section className="card">
        <div className="card-body" style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
          <span className="avatar lg" style={{ width: 54, height: 54, fontSize: 16 }}>
            {initials(context.user.name)}
          </span>
          <div style={{ flex: 1, minWidth: 180 }}>
            <strong style={{ fontSize: 15 }}>{context.user.name}</strong>
            <div style={{ color: "var(--muted)", fontSize: 12.5 }}>{context.user.email}</div>
            <div style={{ color: "var(--muted)", fontSize: 11.5, marginTop: 2 }}>
              {context.role.charAt(0) + context.role.slice(1).toLowerCase()} at {context.salon.name}
            </div>
          </div>
          <span className={`badge ${context.user.mfaEnabled ? "badge-success" : "badge-warning"}`}>
            {context.user.mfaEnabled ? "2-step login is ON" : "2-step login is OFF"}
          </span>
        </div>
      </section>

      <SecurityPanel mfaEnabled={context.user.mfaEnabled} required={required} />
    </div>
  );
}
