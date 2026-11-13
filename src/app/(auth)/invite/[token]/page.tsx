// 2026 Devansh Singh
// Guru AI Technologies
import { AuthBrand } from "@/components/brand/auth-brand";
import type { Metadata } from "next";
import Link from "next/link";
import { getVerifiedViewer } from "@/lib/auth";
import { getInvitationInfo } from "@/services/team";
import { InviteForm } from "@/components/auth/invite-form";

export const metadata: Metadata = { title: "Salon invitation" };
export const dynamic = "force-dynamic";

export default async function InvitationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const viewer = await getVerifiedViewer();
  try {
    const info = await getInvitationInfo(token);
    return (
      <InviteForm
        token={token}
        salonName={info.salonName}
        email={info.email}
        role={info.role}
        accountExists={info.accountExists}
        signedIn={Boolean(viewer)}
      />
    );
  } catch (error) {
    return (
      <div className="auth-card">
        <AuthBrand />
        <h1>Invitation unavailable.</h1>
        <p className="auth-sub">{error instanceof Error ? error.message : "This invitation link cannot be used."}</p>
        <Link href="/login" className="btn btn-primary btn-block">
          Go to sign in
        </Link>
      </div>
    );
  }
}
