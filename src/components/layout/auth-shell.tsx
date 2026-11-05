import Link from "next/link";
import { Icon } from "@/components/ui/icons";
import { CompanyLogo, PoweredBy } from "@/components/brand/company-logo";

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth-shell">
      <aside className="auth-side">
        <Link href="/" className="public-brand">
          <CompanyLogo onDark height={34} link={false} />
        </Link>
        <div>
          <h2>
            Run the salon.
            <br />
            <em>Not the busywork.</em>
          </h2>
          <p>
            One simple place for appointments, waiting customers, bills, stock and your staff.
          </p>
        </div>
        <div style={{ display: "flex", gap: 18, flexWrap: "wrap", color: "rgba(255,255,255,.58)", fontSize: 11.5 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Icon name="shield" style={{ width: 15, height: 15 }} /> Your data stays private
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Icon name="file" style={{ width: 15, height: 15 }} /> Files kept safely
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Icon name="lock" style={{ width: 15, height: 15 }} /> 2-step login
          </span>
        </div>
      </aside>
      <main className="auth-main">
        {children}
        <PoweredBy />
      </main>
    </div>
  );
}
