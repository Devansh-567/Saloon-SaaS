"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Icon } from "@/components/ui/icons";
import { allowedQuickActions } from "@/lib/nav";
import type { Permission } from "@/lib/permissions";

function useCloseOnNavigate(open: boolean, close: () => void) {
  const pathname = usePathname();
  useEffect(() => {
    if (open) close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
}

export function QuickCreateMenu({ permissions }: { permissions: Permission[] }) {
  const [open, setOpen] = useState(false);
  const actions = allowedQuickActions(permissions);
  useCloseOnNavigate(open, () => setOpen(false));

  if (actions.length === 0) return null;

  return (
    <div className="user-menu">
      <button type="button" className="topbar-add" aria-expanded={open} aria-haspopup="menu" onClick={() => setOpen((value) => !value)}>
        <Icon name="plus" />
        New
      </button>
      {open ? (
        <div className="dropdown" role="menu">
          <div className="dropdown-label">Quick create</div>
          {actions.map((action) => (
            <Link key={action.href} href={action.href} className="dropdown-item" role="menuitem" onClick={() => setOpen(false)}>
              <Icon name={action.icon} />
              {action.label}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function QuickCreateSheet({ permissions }: { permissions: Permission[] }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const actions = allowedQuickActions(permissions);
  useCloseOnNavigate(open, () => setOpen(false));

  if (actions.length === 0) return null;

  return (
    <>
      <button type="button" className="bottom-nav-add" aria-label="Create new" onClick={() => setOpen(true)}>
        <Icon name="plus" />
      </button>
      {open ? (
        <div
          className="sheet-backdrop"
          role="presentation"
          onMouseDown={(event) => event.target === event.currentTarget && setOpen(false)}
        >
          <div className="sheet" role="dialog" aria-modal="true" aria-label="Quick create">
            <div className="sheet-handle" />
            <div className="sheet-title">Quick create</div>
            {actions.map((action) => (
              <button
                key={action.href}
                type="button"
                className="sheet-item"
                onClick={() => {
                  setOpen(false);
                  router.push(action.href);
                }}
              >
                <Icon name={action.icon} />
                {action.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </>
  );
}
