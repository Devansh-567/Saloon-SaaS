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
import { withApi, ok, readJson } from "@/lib/api";
import { requireApiTenant } from "@/lib/auth";
import { customerNoteInput } from "@/lib/validation";
import { addCustomerNote } from "@/services/customers";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApi(request, async () => {
    const context = await requireApiTenant("customers.write");
    const { id } = await params;
    return ok(await addCustomerNote(context, id, await readJson(request, customerNoteInput)), 201);
  });
}
