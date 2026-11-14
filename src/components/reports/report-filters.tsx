"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/icons";

const RANGES = [
  { id: "today", label: "Today" },
  { id: "week", label: "This week" },
  { id: "mtd", label: "This month" },
  { id: "last", label: "Last month" },
  { id: "7d", label: "Last 7 days" },
  { id: "30d", label: "Last 30 days" },
  { id: "90d", label: "Last 90 days" },
  { id: "custom", label: "Pick my own dates" },
];

export function ReportFilters({ range, from, to }: { range: string; from: string; to: string }) {
  const [period, setPeriod] = useState(range);
  const [fromValue, setFromValue] = useState(from);
  const [toValue, setToValue] = useState(to);

  return (
    <form className="toolbar" method="get">
      <div className="field">
        <label className="field-label" htmlFor="range">Period</label>
        <select
          id="range"
          name="range"
          className="select"
          value={period}
          onChange={(event) => setPeriod(event.target.value)}
        >
          {RANGES.map((item) => (
            <option key={item.id} value={item.id}>{item.label}</option>
          ))}
        </select>
      </div>
      <div className="field">
        <label className="field-label" htmlFor="from">From date</label>
        <input
          id="from"
          name="from"
          type="date"
          className="input"
          value={fromValue}
          max={toValue || undefined}
          onChange={(event) => {
            setFromValue(event.target.value);
            setPeriod("custom");
          }}
        />
      </div>
      <div className="field">
        <label className="field-label" htmlFor="to">To date</label>
        <input
          id="to"
          name="to"
          type="date"
          className="input"
          value={toValue}
          min={fromValue || undefined}
          onChange={(event) => {
            setToValue(event.target.value);
            setPeriod("custom");
          }}
        />
      </div>
      <button type="submit" className="btn btn-secondary">
        <Icon name="filter" /> Show report
      </button>
    </form>
  );
}
