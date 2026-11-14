"use client";

import { PoweredBy } from "@/components/brand/company-logo";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { Permission } from "@/lib/permissions";
import { initials } from "@/lib/utils";
import { apiRequest, errorMessage } from "@/lib/client";
import { isNavActive, mobileNavItems, pageTitle, visibleNavGroups } from "@/lib/nav";
import { Icon } from "@/components/ui/icons";
import { useToast } from "@/components/ui/toast";
import { CommandPalette } from "@/components/layout/command-palette";
import { QuickCreateMenu, QuickCreateSheet } from "@/components/layout/quick-create";
import { ThemeToggle } from "@/components/layout/theme-toggle";

type SalonOption = { id: string; name: string };

function accentContrast(hex: string) {
  const value = parseInt(hex.replace("#", ""), 16);
  if (Number.isNaN(value)) return "#fffdf9";
  const channels = [(value >> 16) & 255, (value >> 8) & 255, value & 255].map((channel) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
  return luminance > 0.55 ? "#241a12" : "#fffdf9";
}

export function AppShell({
  children,
  user,
  salon,
  branch,
  roleLabel,
  permissions,
  salons,
  accentColor,
}: {
  children: React.ReactNode;
  user: { id: string; name: string; email: string };
  salon: { id: string; name: string; logoFileId: string | null; currency: string };
  branch: string | null;
  roleLabel: string;
  permissions: Permission[];
  salons: SalonOption[];
  accentColor?: string | null;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const toast = useToast();
  const [menuOpen, setMenuOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [shortcut, setShortcut] = useState("Ctrl K");

  useEffect(() => {
    setMenuOpen(false);
    setUserOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform)) setShortcut("⌘ K");
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((value) => !value);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  const accent = accentColor && /^#[0-9a-fA-F]{6}$/.test(accentColor) ? accentColor : null;

  useEffect(() => {
    const root = document.documentElement;
    if (!accent) return;
    root.style.setProperty("--salon-accent", accent);
    root.style.setProperty("--salon-accent-contrast", accentContrast(accent));
    return () => {
      root.style.removeProperty("--salon-accent");
      root.style.removeProperty("--salon-accent-contrast");
    };
  }, [accent]);

  const visibleGroups = visibleNavGroups(permissions);
  const bottomItems = mobileNavItems(permissions, 4);
  const title = pageTitle(pathname);
  const isActive = (href: string) => isNavActive(pathname, href);

  async function switchSalon(salonId: string) {
    if (salonId === salon.id || switching) return;
    setSwitching(true);
    try {
      await apiRequest("/api/auth/switch-salon", { method: "POST", body: JSON.stringify({ salonId }) });
      router.push("/dashboard");
      router.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSwitching(false);
    }
  }

  async function logout() {
    try {
      await apiRequest("/api/auth/logout", { method: "POST" });
    } finally {
      router.push("/login");
      router.refresh();
    }
  }

  const logo = salon.logoFileId ? `/api/files/${salon.logoFileId}` : null;
  const bottomMid = Math.ceil(bottomItems.length / 2);

  return (
    <div className="app-shell">
      <div className={`overlay ${menuOpen ? "open" : ""}`} onClick={() => setMenuOpen(false)} aria-hidden="true" />
      <aside className={`sidebar ${menuOpen ? "open" : ""}`}>
        <Link href="/dashboard" className="brand">
          <span className="brand-mark">{logo ? <img src={logo} alt="" /> : salon.name.slice(0, 1).toUpperCase()}</span>
          <span className="brand-name">
            <strong>{salon.name}</strong>
            <span>{branch || "All branches"}</span>
          </span>
        </Link>
        <nav className="side-nav" aria-label="Main navigation">
          {visibleGroups.map((group) => (
            <div key={group.label}>
              <div className="nav-section">{group.label}</div>
              {group.items.map((item) => (
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
          ))}
        </nav>
        <div className="sidebar-foot">
          <div className="side-user">
            <span className="avatar on-dark">{initials(user.name)}</span>
            <span className="side-user-copy">
              <strong>{user.name}</strong>
              <span>{roleLabel}</span>
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
              {branch ? branch : salon.name}
            </div>
          </div>
          <div className="topbar-right">
            <button type="button" className="topbar-search" onClick={() => setPaletteOpen(true)} aria-label="Search and commands">
              <Icon name="search" />
              <span className="topbar-search-label">Search…</span>
              <span className="kbd">{shortcut}</span>
            </button>
            <QuickCreateMenu permissions={permissions} />
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
                  {salons.length > 1 ? (
                    <>
                      <div className="dropdown-label">Switch salon</div>
                      {salons.map((option) => (
                        <button
                          key={option.id}
                          type="button"
                          className="dropdown-item"
                          onClick={() => switchSalon(option.id)}
                          disabled={switching || option.id === salon.id}
                        >
                          <Icon name="building" />
                          <span style={{ flex: 1 }}>{option.name}</span>
                          {option.id === salon.id ? <Icon name="check" style={{ width: 14, height: 14 }} /> : null}
                        </button>
                      ))}
                    </>
                  ) : null}
                  <div className="dropdown-label">Account</div>
                  <Link href="/profile" className="dropdown-item">
                    <Icon name="user" />
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

      <nav className="bottom-nav" aria-label="Primary navigation">
        {bottomItems.slice(0, bottomMid).map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`bottom-nav-link ${isActive(item.href) ? "active" : ""}`}
            aria-current={isActive(item.href) ? "page" : undefined}
          >
            <Icon name={item.icon} />
            {item.label.split(" ")[0]}
          </Link>
        ))}
        <QuickCreateSheet permissions={permissions} />
        {bottomItems.slice(bottomMid).map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`bottom-nav-link ${isActive(item.href) ? "active" : ""}`}
            aria-current={isActive(item.href) ? "page" : undefined}
          >
            <Icon name={item.icon} />
            {item.label.split(" ")[0]}
          </Link>
        ))}
      </nav>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} permissions={permissions} />
    </div>
  );
}
