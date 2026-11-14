"use client";

import { PoweredBy } from "@/components/brand/company-logo";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/client";
import { initials } from "@/lib/utils";
import { Icon, type IconName } from "@/components/ui/icons";
import { ThemeToggle } from "@/components/layout/theme-toggle";

type NavItem = { href: string; label: string; icon: IconName };

const NAV: NavItem[] = [
  { href: "/platform", label: "Overview", icon: "dashboard" },
  { href: "/platform/salons", label: "Salons", icon: "building" },
  { href: "/platform/plans", label: "Plans", icon: "card" },
  { href: "/platform/notifications", label: "Notifications", icon: "send" },
  { href: "/platform/audit", label: "Audit log", icon: "file" },
  { href: "/platform/settings", label: "Settings", icon: "settings" },
];

const TITLES: Record<string, string> = {
  "/platform": "Platform overview",
  "/platform/salons": "Salons",
  "/platform/plans": "Plans",
  "/platform/notifications": "Notifications",
  "/platform/audit": "Audit log",
  "/platform/settings": "Platform settings",
};

export function PlatformShell({
  children,
  user,
}: {
  children: React.ReactNode;
  user: { name: string; email: string };
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
    setUserOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  const title = TITLES[pathname] || "Platform";
  const isActive = (href: string) => (href === "/platform" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`));

  async function logout() {
    try {
      await apiRequest("/api/auth/logout", { method: "POST" });
    } finally {
      router.push("/login");
      router.refresh();
    }
  }

  return (
    <div className="app-shell">
      <div className={`overlay ${menuOpen ? "open" : ""}`} onClick={() => setMenuOpen(false)} aria-hidden="true" />
      <aside className={`sidebar ${menuOpen ? "open" : ""}`}>
        <Link href="/platform" className="brand">
          <span className="brand-mark">P</span>
          <span className="brand-name">
            <strong>Platform admin</strong>
            <span>All salons</span>
          </span>
        </Link>
        <nav className="side-nav" aria-label="Platform navigation">
          <div>
            <div className="nav-section">Operations</div>
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`nav-link ${isActive(item.href) ? "active" : ""}`}
                aria-current={isActive(item.href) ? "page" : undefined}
              >
                <Icon name={item.icon} />
                {item.label}
              </Link>
            ))}
          </div>
        </nav>
        <div className="sidebar-foot">
          <div className="side-user">
            <span className="avatar on-dark">{initials(user.name)}</span>
            <span className="side-user-copy">
              <strong>{user.name}</strong>
              <span>Super admin</span>
            </span>
          </div>
          <PoweredBy onDark />
        </div>
      </aside>

      <div className="app-main">
        <header className="topbar">
          <div className="topbar-left">
            <button type="button" className="icon-btn menu-toggle" onClick={() => setMenuOpen(true)} aria-label="Open navigation">
              <Icon name="menu" />
            </button>
            <div className="page-context">
              <strong>{title}</strong>
              Platform control room
            </div>
          </div>
          <div className="topbar-right">
            <ThemeToggle />
            <div className="user-menu">
              <button type="button" className="user-trigger" onClick={() => setUserOpen((value) => !value)} aria-expanded={userOpen}>
                <span className="avatar">{initials(user.name)}</span>
                <span className="user-trigger-name">{user.name.split(" ")[0]}</span>
                <Icon name="chevron" style={{ width: 13, height: 13, transform: "rotate(90deg)" }} />
              </button>
              {userOpen ? (
                <div className="dropdown">
                  <div className="dropdown-head">
                    <strong>{user.name}</strong>
                    <span>{user.email}</span>
                  </div>
                  <div className="dropdown-label">Account</div>
                  <Link href="/profile" className="dropdown-item">
                    <Icon name="shield" />
                    Profile & security
                  </Link>
                  <button type="button" className="dropdown-item danger" onClick={logout}>
                    <Icon name="logout" />
                    Sign out
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </header>
        <main className="content">{children}</main>
      </div>
    </div>
  );
}
