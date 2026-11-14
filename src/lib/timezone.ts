function partsInZone(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value || 0);
  const hour = get("hour") === 24 ? 0 : get("hour");
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour,
    minute: get("minute"),
    second: get("second"),
  };
}

function offsetAt(date: Date, timeZone: string) {
  const parts = partsInZone(date, timeZone);
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return asUtc - date.getTime();
}

export function zonedStartOfDay(date: string, timeZone: string) {
  const [year, month, day] = date.split("-").map(Number);
  if (!year || !month || !day) return new Date(`${date}T00:00:00.000Z`);
  const guess = Date.UTC(year, month - 1, day);
  let result = new Date(guess - offsetAt(new Date(guess), timeZone));
  result = new Date(guess - offsetAt(result, timeZone));
  return result;
}

export function zonedDateTimeToUtc(value: string, timeZone: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value);
  if (!match) return new Date(value);
  const utcGuess = Date.UTC(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(match[4]),
    Number(match[5]),
    match[6] ? Number(match[6]) : 0,
  );
  let result = new Date(utcGuess - offsetAt(new Date(utcGuess), timeZone));
  result = new Date(utcGuess - offsetAt(result, timeZone));
  return result;
}

export function zonedDayBounds(date: string, timeZone: string) {
  const start = zonedStartOfDay(date, timeZone);
  const nextDate = new Date(`${date}T12:00:00.000Z`);
  nextDate.setUTCDate(nextDate.getUTCDate() + 1);
  const next = zonedStartOfDay(nextDate.toISOString().slice(0, 10), timeZone);
  return { from: start, to: new Date(next.getTime() - 1) };
}

export function zonedDateInput(date: Date, timeZone: string) {
  const parts = partsInZone(date, timeZone);
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

export function zonedTimeInput(date: Date, timeZone: string) {
  const parts = partsInZone(date, timeZone);
  return `${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}`;
}

export function zonedLocalInput(date: Date, timeZone: string) {
  return `${zonedDateInput(date, timeZone)}T${zonedTimeInput(date, timeZone)}`;
}
