export class ApiClientError extends Error {
  status: number;
  code: string;
  details: unknown;

  constructor(message: string, status: number, code = "REQUEST_FAILED", details?: unknown) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body && !(options.body instanceof FormData) && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  const response = await fetch(path, {
    ...options,
    headers,
    credentials: "same-origin",
    cache: "no-store",
  });
  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json") ? await response.json().catch(() => null) : null;
  if (!response.ok) {
    const error = data?.error;
    throw new ApiClientError(
      error?.message || `Request failed with status ${response.status}`,
      response.status,
      error?.code,
      error?.details,
    );
  }
  return data as T;
}

export function clearUrlParam(key: string) {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (!url.searchParams.has(key)) return;
  url.searchParams.delete(key);
  window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
}

export function errorMessage(error: unknown) {
  if (error instanceof ApiClientError) {
    if (Array.isArray(error.details) && error.details.length) {
      const first = error.details[0] as { message?: string; path?: Array<string | number> };
      if (first?.message) {
        const field = first.path?.filter((part) => typeof part === "string").join(".");
        return field ? `${field}: ${first.message}` : first.message;
      }
    }
    return error.message;
  }
  if (error instanceof Error) return error.message;
  return "Something went wrong. Please try again.";
}
