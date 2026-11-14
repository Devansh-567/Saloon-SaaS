"use client";

import { Icon } from "@/components/ui/icons";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="card" style={{ padding: "46px 30px", textAlign: "center", maxWidth: 560, margin: "40px auto" }}>
      <div className="empty-icon" style={{ margin: "0 auto 14px" }}>
        <Icon name="alert" />
      </div>
      <h2 style={{ marginBottom: 8 }}>Something went wrong</h2>
      <p className="page-subtitle" style={{ margin: "0 auto 22px" }}>
        {error.message || "An unexpected error interrupted this page. Your data is safe."}
      </p>
      <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
        <button type="button" className="btn btn-primary" onClick={reset}>
          <Icon name="refresh" />
          Try again
        </button>
        <a className="btn btn-secondary" href="/dashboard">
          <Icon name="home" />
          Back to dashboard
        </a>
      </div>
      {error.digest ? (
        <p style={{ marginTop: 20, marginBottom: 0, fontSize: 11.5, color: "var(--muted)" }}>Reference: {error.digest}</p>
      ) : null}
    </div>
  );
}
