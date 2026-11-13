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
 import Link from "next/link";
import { Icon } from "@/components/ui/icons";

export default function NotFound() {
  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "grid",
        placeItems: "center",
        padding: "32px 20px",
        background: "var(--paper)",
        color: "var(--ink)",
      }}
    >
      <div style={{ textAlign: "center", maxWidth: 460 }}>
        <div className="brand-mark" style={{ margin: "0 auto 22px", width: 54, height: 54, fontSize: 24 }}>
          S
        </div>
        <p style={{ letterSpacing: "0.22em", textTransform: "uppercase", fontSize: 11.5, color: "var(--muted)", marginBottom: 10 }}>
          Page not found
        </p>
        <h1 style={{ fontSize: "clamp(2rem, 6vw, 3rem)", marginBottom: 12 }}>This chair is empty</h1>
        <p className="page-subtitle" style={{ margin: "0 auto 26px" }}>
          The page you were looking for has moved, been renamed, or never existed. Let&apos;s get you back to the salon floor.
        </p>
        <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
          <Link href="/dashboard" className="btn btn-primary">
            <Icon name="home" />
            Back to dashboard
          </Link>
          <Link href="/" className="btn btn-secondary">
            Go to homepage
          </Link>
        </div>
      </div>
    </div>
  );
}

