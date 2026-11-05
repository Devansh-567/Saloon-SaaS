import { NextRequest } from "next/server";
import { withApi, ok, readJson } from "@/lib/api";
import { resetPasswordInput } from "@/lib/validation";
import { resetPassword } from "@/services/password-reset";
import { getClientIp } from "@/lib/utils";

export async function POST(request: NextRequest) {
  return withApi(request, async () => {
    const input = await readJson(request, resetPasswordInput);
    await resetPassword(input, { ip: getClientIp(request.headers) });
    return ok({ ok: true });
  });
}
