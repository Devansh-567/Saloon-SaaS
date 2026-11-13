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

export function formatMoney(value: unknown, currency = "INR", locale = "en-IN") {
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
