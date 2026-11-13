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
 "use client";

import { Icon } from "@/components/ui/icons";

export default function PlatformError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="card" style={{ padding: "46px 30px", textAlign: "center", maxWidth: 560, margin: "40px auto" }}>
      <div className="empty-icon" style={{ margin: "0 auto 14px" }}>
        <Icon name="alert" />
      </div>
      <h2 style={{ marginBottom: 8 }}>The control room hit a snag</h2>
      <p className="page-subtitle" style={{ margin: "0 auto 22px" }}>
        {error.message || "An unexpected error interrupted this page. Nothing was changed."}
      </p>
      <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
        <button type="button" className="btn btn-primary" onClick={reset}>
          <Icon name="refresh" />
          Try again
        </button>
        <a className="btn btn-secondary" href="/platform">
          <Icon name="home" />
          Platform overview
        </a>
      </div>
      {error.digest ? (
        <p style={{ marginTop: 20, marginBottom: 0, fontSize: 11.5, color: "var(--muted)" }}>Reference: {error.digest}</p>
      ) : null}
    </div>
  );
}

