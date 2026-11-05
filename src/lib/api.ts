import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import { AppError } from "./errors";
import { logger } from "./logger";
import { getClientIp, } from "./utils";
import { env } from "./env";
import { rateLimit } from "./rate-limit";

export function ok(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

function sameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  const allowed = new Set([new URL(env.APP_URL).origin, new URL(request.url).origin]);
  return allowed.has(origin);
}

async function parseBody(request: NextRequest): Promise<unknown> {
  const type = request.headers.get("content-type") || "";
  if (type.includes("application/json")) return request.json();
  return undefined;
}

export async function withApi(request: NextRequest, handler: () => Promise<NextResponse>) {
  try {
    const mutating = !["GET", "HEAD", "OPTIONS"].includes(request.method);
    if (mutating) {
      if (!sameOrigin(request)) {
        throw new AppError(403, "CSRF_REJECTED", "Request origin rejected");
      }
      await rateLimit(`api:${getClientIp(request.headers)}`, 180, 60_000);
    }
    return await handler();
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message, details: error.details } },
        {
          status: error.status,
          headers: error.status === 429 && error.details && typeof error.details === "object" && "retryAfter" in error.details
            ? { "Retry-After": String((error.details as { retryAfter: number }).retryAfter) }
            : undefined,
        },
      );
    }
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "Please check the submitted data", details: error.issues } },
        { status: 400 },
      );
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return NextResponse.json(
          { error: { code: "CONFLICT", message: "A record with this value already exists" } },
          { status: 409 },
        );
      }
      if (error.code === "P2025") {
        return NextResponse.json({ error: { code: "NOT_FOUND", message: "Record not found" } }, { status: 404 });
      }
    }
    logger.error("api_unhandled_error", {
      method: request.method,
      path: request.nextUrl.pathname,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack?.split("\n").slice(0, 5).join("\n") : undefined,
    });
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Something went wrong. Please try again." } },
      { status: 500 },
    );
  }
}

export async function readJson<T>(request: NextRequest, schema: { parse: (input: unknown) => T }) {
  return schema.parse(await parseBody(request));
}
