import { NextRequest } from "next/server";
import { withApi, ok, readJson } from "@/lib/api";
import { forgotPasswordInput } from "@/lib/validation";
import { requestPasswordReset } from "@/services/password-reset";
import { getClientIp } from "@/lib/utils";

export async function POST(request: NextRequest) {
  return withApi(request, async () => {
    const input = await readJson(request, forgotPasswordInput);
    return ok(await requestPasswordReset(input, { ip: getClientIp(request.headers) }));
  });
}
