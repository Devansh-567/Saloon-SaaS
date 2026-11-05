"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiRequest, errorMessage } from "@/lib/client";
import { useToast } from "@/components/ui/toast";

export function LoginForm({ next, initialError }: { next?: string; initialError?: string }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(initialError === "no-access" ? "This account has no active salon access." : "");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError("");
    try {
      const result = await apiRequest<{ mfaRequired: boolean; redirectTo: string }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: form.get("email"), password: form.get("password") }),
      });
      toast.success(result.mfaRequired ? "Password verified. Enter your authenticator code." : "Welcome back.");
      const target = !result.mfaRequired && next && next.startsWith("/") && !next.startsWith("//") ? next : result.redirectTo;
      router.push(target);
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
      <h1>Welcome back.</h1>
      <p className="auth-sub">Sign in to run the day from one place.</p>
      {error ? <div className="alert alert-error">{error}</div> : null}
      <form onSubmit={submit}>
        <div className="field">
          <label htmlFor="email">Email address</label>
          <input id="email" name="email" type="email" className="input" autoComplete="email" required placeholder="you@salon.com" />
        </div>
        <div className="field" style={{ marginTop: 14 }}>
          <label htmlFor="password">Password</label>
          <input id="password" name="password" type="password" className="input" autoComplete="current-password" required placeholder="Your password" />
        </div>
        <button type="submit" className="btn btn-primary btn-block btn-lg" style={{ marginTop: 20 }} disabled={pending}>
          {pending ? "Signing in…" : "Sign in"}
        </button>
      </form>
      <p className="auth-footer">
        New to Salon SaaS? <Link href="/register" className="link">Create your salon workspace</Link>
      </p>
      <div className="demo-note">
        Access is role-based. If you were invited to an existing salon, use the email address that received the invitation.
      </div>
    </div>
  );
}
