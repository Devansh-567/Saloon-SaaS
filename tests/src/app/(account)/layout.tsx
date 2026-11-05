import Link from "next/link";
import { LogoutButton } from "@/components/auth/logout-button";

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", background: "var(--paper)" }}>
      <header style={{ borderBottom: "1px solid var(--line)", background: "var(--surface)" }}>
        <div className="container" style={{ height: 64, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
          <Link href="/dashboard" className="public-brand" style={{ color: "var(--ink)", fontSize: "1rem" }}>
            <span className="brand-mark" style={{ width: 32, height: 32, borderRadius: 9, fontSize: 13 }}>
              S
            </span>
            Salon SaaS
          </Link>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <Link href="/dashboard" className="btn btn-ghost btn-sm">
              Back to workspace
            </Link>
            <LogoutButton className="btn btn-secondary btn-sm" />
          </div>
        </div>
      </header>
      <main className="container" style={{ paddingTop: 36, paddingBottom: 50, maxWidth: 980 }}>
        {children}
      </main>
    </div>
  );
}
