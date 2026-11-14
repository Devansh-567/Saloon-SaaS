import { NextRequest } from "next/server";
import { withApi, ok, readJson } from "@/lib/api";
import { mfaVerifyInput } from "@/lib/validation";
import { verifyMfaLogin } from "@/services/auth-service";

export async function POST(request: NextRequest) {
  return withApi(request, async () => {
    const input = await readJson(request, mfaVerifyInput);
    return ok(await verifyMfaLogin(input));
  });
}
