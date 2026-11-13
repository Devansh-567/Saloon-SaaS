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

