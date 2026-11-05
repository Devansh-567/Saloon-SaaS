"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon, type IconName } from "@/components/ui/icons";
import { apiRequest } from "@/lib/client";
import type { Permission } from "@/lib/permissions";
import { allowedQuickActions, visibleNavGroups } from "@/lib/nav";

type CustomerHit = { id: string; name: string; phone: string };

type Item =
  | { kind: "action"; id: string; label: string; icon: IconName; href: string }
  | { kind: "nav"; id: string; label: string; icon: IconName; href: string }
  | { kind: "customer"; id: string; label: string; icon: IconName; href: string; detail: string };

export function CommandPalette({
  open,
  onClose,
  permissions,
}: {
  open: boolean;
  onClose: () => void;
  permissions: Permission[];
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [customers, setCustomers] = useState<CustomerHit[]>([]);
  const [searching, setSearching] = useState(false);

  const canSearchCustomers = permissions.includes("customers.read");

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setActive(0);
    setCustomers([]);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const timer = window.setTimeout(() => inputRef.current?.focus(), 30);
    return () => {
      document.body.style.overflow = previous;
      window.clearTimeout(timer);
    };
  }, [open]);

  useEffect(() => {
    const term = query.trim();
    if (!open || !canSearchCustomers || term.length < 2) {
      setCustomers([]);
      setSearching(false);
      return;
    }
    const controller = new AbortController();
    setSearching(true);
    const timer = window.setTimeout(async () => {
      try {
        const data = await apiRequest<{ items: CustomerHit[] }>(`/api/customers?q=${encodeURIComponent(term)}`, {
          signal: controller.signal,
        });
        setCustomers((data.items || []).slice(0, 5));
      } catch {
        setCustomers([]);
      } finally {
        setSearching(false);
      }
    }, 180);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query, open, canSearchCustomers]);

  const items = useMemo<Item[]>(() => {
    const term = query.trim().toLowerCase();
    const match = (label: string) => !term || label.toLowerCase().includes(term);
    const actions = allowedQuickActions(permissions)
      .filter((action) => match(action.label))
      .map((action) => ({ kind: "action" as const, id: action.href, label: action.label, icon: action.icon, href: action.href }));
    const nav = visibleNavGroups(permissions)
      .flatMap((group) => group.items)
      .filter((entry) => match(entry.label))
      .map((entry) => ({ kind: "nav" as const, id: entry.href, label: entry.label, icon: entry.icon, href: entry.href }));
    const hits = customers.map((customer) => ({
      kind: "customer" as const,
      id: `customer-${customer.id}`,
      label: customer.name,
      icon: "user" as IconName,
      href: `/customers/${customer.id}`,
      detail: customer.phone,
    }));
    return [...actions, ...nav, ...hits];
  }, [query, permissions, customers]);

  useEffect(() => {
    setActive(0);
  }, [query, customers.length]);

  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: "nearest" });
  }, [active, open, items]);

  if (!open) return null;

  const sections: Array<{ label: string; items: Item[] }> = [
    { label: "Quick actions", items: items.filter((item) => item.kind === "action") },
    { label: "Go to", items: items.filter((item) => item.kind === "nav") },
    { label: searching && query.trim().length >= 2 ? "Searching customers…" : "Customers", items: items.filter((item) => item.kind === "customer") },
  ].filter((section) => section.items.length > 0);

  function choose(item: Item) {
    onClose();
    router.push(item.href);
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((value) => (items.length ? (value + 1) % items.length : 0));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((value) => (items.length ? (value - 1 + items.length) % items.length : 0));
      return;
    }
    if (event.key === "Enter" && items[active]) {
      event.preventDefault();
      choose(items[active]);
    }
  }

  return (
    <div
      className="palette-backdrop"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div className="palette" role="dialog" aria-modal="true" aria-label="Command palette" onKeyDown={onKeyDown}>
        <div className="palette-input">
          <Icon name="search" style={{ width: 17, height: 17 }} />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search…"
            aria-label="Search actions, pages, and customers"
            autoComplete="off"
            spellCheck={false}
          />
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close command palette">
            <Icon name="x" />
          </button>
        </div>
        <div className="palette-list" ref={listRef}>
          {sections.length === 0 ? (
            <div className="palette-empty">{searching ? "Searching…" : "No matches found."}</div>
          ) : (
            sections.map((section) => (
              <div key={section.label}>
                <div className="palette-section">{section.label}</div>
                {section.items.map((item) => {
                  const index = items.indexOf(item);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={`palette-item ${index === active ? "active" : ""}`}
                      data-active={index === active}
                      onMouseEnter={() => setActive(index)}
                      onClick={() => choose(item)}
                    >
                      <Icon name={item.icon} />
                      <span>{item.label}</span>
                      {item.kind === "customer" ? <span className="desc">{item.detail}</span> : null}
                      {item.kind === "action" ? <span className="desc">Action</span> : null}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
        <div className="palette-foot">
          <span>
            <Icon name="arrowUp" style={{ width: 12, height: 12 }} />
            <Icon name="arrowDown" style={{ width: 12, height: 12 }} />
            Navigate
          </span>
          <span>↵ Open</span>
          <span>Esc Close</span>
        </div>
      </div>
    </div>
  );
}
