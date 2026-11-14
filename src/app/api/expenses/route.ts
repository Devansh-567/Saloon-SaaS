import { NextRequest } from "next/server";
import { withApi, ok, readJson } from "@/lib/api";
import { requireApiTenant } from "@/lib/auth";
import { expenseInput } from "@/lib/validation";
import { createExpense } from "@/services/expenses";

export async function POST(request: NextRequest) {
  return withApi(request, async () => {
    const context = await requireApiTenant("expenses.write");
    return ok(await createExpense(context, await readJson(request, expenseInput)), 201);
  });
}
