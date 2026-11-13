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
 import type { Metadata } from "next";
import { listPlans } from "@/services/platform";
import { asNumber } from "@/lib/utils";
import { PlansPanel } from "@/components/platform/plans-panel";

export const metadata: Metadata = { title: "Plans" };
export const dynamic = "force-dynamic";

export default async function PlatformPlansPage() {
  const plans = await listPlans();

  return (
    <div className="stack" style={{ gap: 20 }}>
      <div className="page-head">
        <div>
          <h1>Plans</h1>
          <p className="page-subtitle">Packaging and limits shown to salons.</p>
        </div>
      </div>
      <PlansPanel
        plans={plans.map((plan) => ({
          id: plan.id,
          name: plan.name,
          slug: plan.slug,
          description: plan.description,
          monthlyPrice: asNumber(plan.monthlyPrice),
          yearlyPrice: plan.yearlyPrice === null ? null : asNumber(plan.yearlyPrice),
          features: Array.isArray(plan.features) ? (plan.features as string[]) : [],
          limits: (plan.limits || {}) as { maxBranches?: number; maxStaff?: number },
          active: plan.active,
          subscriptions: plan._count.subscriptions,
        }))}
      />
    </div>
  );
}

