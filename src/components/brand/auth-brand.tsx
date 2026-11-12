import { BRAND } from "@/lib/brand";
import { CompanyLogo } from "@/components/brand/company-logo";

export function AuthBrand() {
  return (
    <div className="auth-brand">
      <CompanyLogo height={46} link={false} />
      <span>{BRAND.tagline}</span>
    </div>
  );
}
