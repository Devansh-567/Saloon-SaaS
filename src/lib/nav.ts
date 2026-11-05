import type { IconName } from "@/components/ui/icons";
import type { Permission } from "@/lib/permissions";

export type NavItem = { href: string; label: string; icon: IconName; permission?: Permission };
export type NavGroup = { label: string; items: NavItem[] };

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Every day",
    items: [
      { href: "/dashboard", label: "Home", icon: "dashboard" },
      { href: "/appointments", label: "Bookings", icon: "calendar", permission: "appointments.read" },
      { href: "/queue", label: "Waiting List", icon: "ticket", permission: "queue.read" },
      { href: "/customers", label: "Customers", icon: "users", permission: "customers.read" },
      { href: "/billing", label: "Bills", icon: "card", permission: "billing.read" },
      { href: "/reports", label: "Reports", icon: "chart", permission: "reports.read" },
    ],
  },
  {
    label: "Salon",
    items: [
      { href: "/services", label: "Services & prices", icon: "service", permission: "services.read" },
      { href: "/inventory", label: "Stock", icon: "box", permission: "inventory.read" },
      { href: "/expenses", label: "Expenses", icon: "receipt", permission: "expenses.read" },
    ],
  },
  {
    label: "People",
    items: [
      { href: "/team", label: "Staff Logins", icon: "team", permission: "team.read" },
      { href: "/staff", label: "Attendance & Salary", icon: "clock", permission: "hr.read" },
      { href: "/my-work", label: "My work", icon: "user", permission: "hr.self" },
      { href: "/roles", label: "Staff Permissions", icon: "shield", permission: "roles.write" },
      { href: "/activity", label: "History", icon: "eye", permission: "audit.read" },
    ],
  },
  {
    label: "Admin",
    items: [{ href: "/settings", label: "Settings", icon: "settings", permission: "settings.write" }],
  },
];

export const PAGE_TITLES: Array<[string, string]> = [
  ["/dashboard", "Home"],
  ["/appointments", "Bookings"],
  ["/queue", "Waiting List"],
  ["/customers", "Customers"],
  ["/billing/new", "New Bill"],
  ["/billing", "Bills"],
  ["/reports", "Reports"],
  ["/services", "Services & prices"],
  ["/inventory", "Stock"],
  ["/expenses", "Expenses"],
  ["/team", "Staff Logins"],
  ["/staff", "Attendance & Salary"],
  ["/my-work", "My work"],
  ["/roles", "Staff Permissions"],
  ["/activity", "History"],
  ["/settings", "Settings"],
];

export type QuickAction = { href: string; label: string; icon: IconName; permission?: Permission };

export const QUICK_ACTIONS: QuickAction[] = [
  { href: "/appointments?new=1", label: "Book Appointment", icon: "calendar", permission: "appointments.write" },
  { href: "/queue?walkin=1", label: "Add to Waiting List", icon: "ticket", permission: "queue.write" },
  { href: "/customers?new=1", label: "Add Customer", icon: "users", permission: "customers.write" },
  { href: "/billing/new", label: "New Bill", icon: "card", permission: "billing.write" },
  { href: "/expenses?new=1", label: "Add Expense", icon: "receipt", permission: "expenses.write" },
];

export const MOBILE_NAV_PRIORITY = ["/dashboard", "/appointments", "/queue", "/customers", "/billing"];

export function visibleNavGroups(permissions: readonly Permission[]): NavGroup[] {
  return NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => !item.permission || permissions.includes(item.permission)),
  })).filter((group) => group.items.length > 0);
}

export function allowedQuickActions(permissions: readonly Permission[]): QuickAction[] {
  return QUICK_ACTIONS.filter((action) => !action.permission || permissions.includes(action.permission));
}

export function mobileNavItems(permissions: readonly Permission[], limit = 4): NavItem[] {
  const flat = visibleNavGroups(permissions).flatMap((group) => group.items);
  const prioritized = MOBILE_NAV_PRIORITY.map((href) => flat.find((item) => item.href === href)).filter(
    (item): item is NavItem => Boolean(item),
  );
  const rest = flat.filter((item) => !prioritized.includes(item));
  return [...prioritized, ...rest].slice(0, limit);
}

export function pageTitle(pathname: string): string {
  return PAGE_TITLES.find(([href]) => pathname === href || pathname.startsWith(`${href}/`))?.[1] || "Workspace";
}

export function isNavActive(pathname: string, href: string): boolean {
  return href === "/dashboard" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}
