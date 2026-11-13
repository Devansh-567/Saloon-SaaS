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
 import { Icon, type IconName } from "@/components/ui/icons";
import { CompanyLogo, PoweredBy } from "@/components/brand/company-logo";
import { BRAND } from "@/lib/brand";

const POINTS: Array<{ icon: IconName; text: string }> = [
  { icon: "calendar", text: "Book appointments and keep the waiting list" },
  { icon: "card", text: "Make bills and take cash, UPI or card payments" },
  { icon: "box", text: "Know your stock, staff and daily earnings" },
];

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth-shell">
      <aside className="auth-side">
        <CompanyLogo onDark height={48} link={false} />
        <div>
          <h2>
            Run the salon.
            <br />
            <em>Not the busywork.</em>
          </h2>
          <p>{BRAND.tagline}</p>
          <ul className="auth-points">
            {POINTS.map((point) => (
              <li key={point.text}>
                <span>
                  <Icon name={point.icon} />
                </span>
                {point.text}
              </li>
            ))}
          </ul>
        </div>
        <small className="auth-side-foot">Your data stays private and safe.</small>
      </aside>
      <main className="auth-main">
        {children}
        <PoweredBy />
      </main>
    </div>
  );
}

