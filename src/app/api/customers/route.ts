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
import { customerInput } from "@/lib/validation";
import { createCustomer, listCustomers } from "@/services/customers";

export async function GET(request: NextRequest) {
  return withApi(request, async () => {
    const context = await requireApiTenant("customers.read");
    const query = request.nextUrl.searchParams.get("q") || undefined;
    const page = Math.max(1, Number(request.nextUrl.searchParams.get("page")) || 1);
    return ok(await listCustomers(context, { q: query, page, pageSize: 15 }));
  });
}

export async function POST(request: NextRequest) {
  return withApi(request, async () => {
    const context = await requireApiTenant("customers.write");
    const input = await readJson(request, customerInput);
    return ok(await createCustomer(context, input), 201);
  });
}

