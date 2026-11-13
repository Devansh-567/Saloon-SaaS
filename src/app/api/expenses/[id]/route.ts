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
