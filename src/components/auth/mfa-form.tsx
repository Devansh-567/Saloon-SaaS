"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiRequest, errorMessage } from "@/lib/client";
import { useToast } from "@/components/ui/toast";

export function MfaForm() {
  const router = useRouter();
  const toast = useToast();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError("");
    try {
      const result = await apiRequest<{ redirectTo: string }>("/api/auth/mfa/verify", {
        method: "POST",
        body: JSON.stringify({ code: form.get("code") }),
      });
      toast.success("Identity verified.");
      router.push(result.redirectTo || "/dashboard");
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="auth-card">
      <div className="public-brand" style={{ marginBottom: 28, color: "var(--ink)" }}>
        <span className="brand-mark">S</span>
        Salon SaaS
      </div>
      <h1>Verify it&apos;s you.</h1>
      <p className="auth-sub">Enter the six-digit code from your authenticator app, or use one of your recovery codes.</p>
      {error ? <div className="alert alert-error">{error}</div> : null}
      <form onSubmit={submit}>
        <div className="field">
          <label htmlFor="code">Authentication code</label>
          <input
            id="code"
            name="code"
            className="input mono"
            required
            autoFocus
            autoComplete="one-time-code"
            inputMode="text"
            placeholder="000000"
            style={{ fontSize: 22, letterSpacing: ".24em", textAlign: "center", padding: "12px" }}
          />
        </div>
        <button type="submit" className="btn btn-primary btn-block btn-lg" style={{ marginTop: 20 }} disabled={pending}>
          {pending ? "Verifying…" : "Verify and continue"}
        </button>
      </form>
      <p className="auth-footer">
        Not your account? <Link href="/login" className="link">Return to sign in</Link>
      </p>
    </div>
  );
}
