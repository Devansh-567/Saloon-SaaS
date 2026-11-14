"use client";

import { useEffect, useRef, useState } from "react";
import { apiRequest } from "@/lib/client";
import { Icon } from "@/components/ui/icons";

export type CustomerOption = { id: string; name: string; phone: string; email: string | null; loyaltyPoints?: number };
type CustomerList = { items: CustomerOption[] };

export function CustomerPicker({
  initial,
  required = true,
  allowNew = false,
  onSelect,
}: {
  initial?: CustomerOption | null;
  required?: boolean;
  allowNew?: boolean;
  onSelect?: (customer: CustomerOption | null) => void;
}) {
  const [query, setQuery] = useState(initial?.name || "");
  const [selected, setSelected] = useState<CustomerOption | null>(initial || null);
  const [results, setResults] = useState<CustomerOption[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const requestId = useRef(0);

  useEffect(() => {
    function close(event: MouseEvent) {
      if (wrap.current && !wrap.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(async () => {
      const current = ++requestId.current;
      setLoading(true);
      try {
        const data = await apiRequest<CustomerList>(`/api/customers?q=${encodeURIComponent(query)}&page=1`);
        if (current === requestId.current) setResults(data.items);
      } catch {
        if (current === requestId.current) setResults([]);
      } finally {
        if (current === requestId.current) setLoading(false);
      }
    }, 220);
    return () => window.clearTimeout(timer);
  }, [query, open]);

  function choose(customer: CustomerOption) {
    setSelected(customer);
    onSelect?.(customer);
    setQuery(customer.name);
    setOpen(false);
  }

  function clear() {
    setSelected(null);
    onSelect?.(null);
    setQuery("");
    setResults([]);
    setOpen(true);
  }

  return (
    <div className="field" ref={wrap} style={{ position: "relative" }}>
      <label htmlFor="customer-search">Customer</label>
      <input type="hidden" name="customerId" value={selected?.id || ""} />
      {allowNew ? <input type="hidden" name="newCustomerName" value={selected ? "" : query.trim()} /> : null}
      <div style={{ position: "relative" }}>
        <input
          id="customer-search"
          className="input"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setSelected(null);
            onSelect?.(null);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search by name, phone, or email"
          autoComplete="off"
          required={required && !selected}
        />
        {selected ? (
          <button
            type="button"
            onClick={clear}
            className="icon-btn"
            style={{ position: "absolute", right: 4, top: 4, width: 28, height: 28, border: 0, background: "transparent" }}
            aria-label="Clear customer"
          >
            <Icon name="x" style={{ width: 14, height: 14 }} />
          </button>
        ) : null}
      </div>
      {allowNew && !selected && query.trim() ? (
        <small>Not in the list? We will save &quot;{query.trim()}&quot; as a new customer. You can add the phone number later.</small>
      ) : null}
      {selected ? (
        <small>
          {selected.phone}
          {selected.email ? ` · ${selected.email}` : ""}
        </small>
      ) : null}
      {open && !selected ? (
        <div className="dropdown" style={{ left: 0, right: 0, width: "auto", top: "calc(100% - 2px)", maxHeight: 260, overflowY: "auto" }}>
          {loading ? (
            <div className="dropdown-label">Searching…</div>
          ) : results.length ? (
            results.map((customer) => (
              <button type="button" key={customer.id} className="dropdown-item" onMouseDown={() => choose(customer)}>
                <span className="avatar" style={{ width: 26, height: 26, fontSize: 9 }}>
                  {customer.name.slice(0, 2).toUpperCase()}
                </span>
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: "block", fontWeight: 600 }}>{customer.name}</span>
                  <span style={{ display: "block", color: "var(--muted)", fontSize: 10.5 }}>{customer.phone}</span>
                </span>
              </button>
            ))
          ) : (
            <div className="dropdown-label">{query ? "No matching customers" : "Type to search customers"}</div>
          )}
        </div>
      ) : null}
    </div>
  );
}
