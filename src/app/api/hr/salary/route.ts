import { NextRequest } from "next/server";
import { withApi, ok, readJson } from "@/lib/api";
import { requireApiTenant } from "@/lib/auth";
import { forbidden } from "@/lib/errors";
import { salaryPaymentInput } from "@/lib/validation";
import { canSeeAllHr, createSalaryPayment, listSalaryPayments } from "@/services/hr";

export async function GET(request: NextRequest) {
  return withApi(request, async () => {
    const context = await requireApiTenant();
    if (!canSeeAllHr(context) && !context.permissions.includes("hr.self")) throw forbidden("You cannot see salary records");
    const membershipId = request.nextUrl.searchParams.get("membershipId") || undefined;
    const from = request.nextUrl.searchParams.get("from") || undefined;
    const to = request.nextUrl.searchParams.get("to") || undefined;
    return ok(await listSalaryPayments(context, { membershipId, from, to }));
  });
}

export async function POST(request: NextRequest) {
  return withApi(request, async () => {
    const context = await requireApiTenant("hr.write");
    return ok(await createSalaryPayment(context, await readJson(request, salaryPaymentInput)), 201);
  });
}
