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
 "use client";

import { AuthBrand } from "@/components/brand/auth-brand";
import { PasswordInput } from "@/components/ui/password-input";
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
      router.replace(target);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="auth-card">
      <AuthBrand />
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
          <PasswordInput id="password" name="password" className="input" autoComplete="current-password" required placeholder="Your password" />
        </div>
        <div style={{ textAlign: "right", marginTop: 8 }}>
          <Link href="/forgot-password" className="link">Forgot password?</Link>
        </div>
        <button type="submit" className="btn btn-primary btn-block btn-lg" style={{ marginTop: 14 }} disabled={pending}>
          {pending ? "Signing inâ€¦" : "Sign in"}
        </button>
      </form>
      <p className="auth-footer">
        New here? <Link href="/register" className="link">Create your salon account</Link>
      </p>
      <div className="demo-note">
        Invited by your salon? Sign in with the email address that received the invitation.
      </div>
    </div>
  );
}

