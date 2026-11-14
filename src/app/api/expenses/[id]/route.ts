import { NextRequest } from "next/server";
import { withApi, ok } from "@/lib/api";
import { requireApiTenant } from "@/lib/auth";
import { voidExpense } from "@/services/expenses";

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApi(request, async () => {
    const context = await requireApiTenant("expenses.write");
    const { id } = await params;
    await voidExpense(context, id);
    return ok({ success: true });
  });
}
