# Copyright (c) 2026 Devansh Singh
# All Rights Reserved.
#
# This software and its source code are proprietary
# and confidential property of Guru AI Technologies.
#
# Unauthorized copying, modification, distribution,
# or use of this software, in whole or in part,
# is strictly prohibited without prior written
# permission from Guru AI Technologies.
// 2026 Devansh Singh
// Guru AI Technologies
 import { CompanyLogo } from "@/components/brand/company-logo";
import { BRAND } from "@/lib/brand";
import Link from "next/link";
import { LogoutButton } from "@/components/auth/logout-button";

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", background: "var(--paper)" }}>
      <header style={{ borderBottom: "1px solid var(--line)", background: "var(--surface)" }}>
        <div className="container" style={{ height: 64, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
          <Link href="/dashboard" aria-label={BRAND.name}>
            <CompanyLogo height={32} link={false} />
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

