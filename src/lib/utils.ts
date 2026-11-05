export function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function asNumber(value: unknown) {
  if (value === null || value === undefined) return 0;
  return Number(value);
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function formatMoney(value: unknown, currency = "USD", locale = "en-US") {
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(asNumber(value));
}

export function formatDate(value: Date | string, timezone = "UTC", locale = "en-US") {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: timezone,
  }).format(new Date(value));
}

export function formatDay(value: Date | string, timezone = "UTC", locale = "en-US") {
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: timezone }).format(new Date(value));
}

export function formatTime(value: Date | string, timezone = "UTC", locale = "en-US") {
  return new Intl.DateTimeFormat(locale, { timeStyle: "short", timeZone: timezone }).format(new Date(value));
}

export function dateInputValue(value: Date | string) {
  const d = new Date(value);
  const offset = d.getTimezoneOffset();
  return new Date(d.getTime() - offset * 60000).toISOString().slice(0, 10);
}

export function isoDateOnly(value: Date | string) {
  return new Date(value).toISOString().slice(0, 10);
}

export function formatDateOnly(value: Date | string, locale = "en-US") {
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" }).format(new Date(value));
}

export function dateOnlyFromInput(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

export function formatMinutes(total: number) {
  const hours = Math.floor(total / 60);
  const minutes = Math.round(total % 60);
  if (!hours) return `${minutes}m`;
  return `${hours}h ${minutes ? `${minutes}m` : ""}`.trim();
}

export function getPagination(searchParams: { page?: string; pageSize?: string }, defaultSize = 20) {
  const page = Math.max(1, Number(searchParams.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.pageSize) || defaultSize));
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export function getClientIp(headers: Headers) {
  const forwarded = headers.get("x-forwarded-for");
  return (forwarded ? forwarded.split(",")[0] : headers.get("x-real-ip") || "unknown").trim();
}

export function startOfDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function endOfDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

export function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60000);
}

export function pctChange(current: number, previous: number) {
  if (!previous) return current ? 100 : 0;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const METHOD_NAMES: Record<string, string> = {
  CASH: "Cash",
  UPI: "UPI",
  CARD: "Card",
  BANK: "Bank transfer",
  OTHER: "Other",
};

export function paymentMethodLabel(method: string): string {
  return METHOD_NAMES[method] || method;
}
