const OFFSET_SUFFIX = /(Z|([+-])(\d{2}):(\d{2}))$/;

function dateKeyAtOffset(date: Date, offsetMinutes: number) {
  return new Date(date.getTime() + offsetMinutes * 60_000)
    .toISOString()
    .slice(0, 10);
}

function offsetMinutesFromIso(value: string) {
  const match = value.match(OFFSET_SUFFIX);
  if (!match || match[1] === "Z") return 0;
  const minutes = Number(match[3]) * 60 + Number(match[4]);
  return match[2] === "-" ? -minutes : minutes;
}

/** Minimum value for a datetime-local field: midnight today on this device. */
export function localDeliveryDateMinimum(now = new Date()) {
  const local = new Date(now);
  local.setHours(0, 0, 0, 0);
  return new Date(local.getTime() - local.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);
}

/** Preserve the device offset so the API can validate the chosen calendar day. */
export function localDateTimeToOffsetIso(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;

  const offset = -date.getTimezoneOffset();
  const sign = offset >= 0 ? "+" : "-";
  const absolute = Math.abs(offset);
  const hours = String(Math.floor(absolute / 60)).padStart(2, "0");
  const minutes = String(absolute % 60).padStart(2, "0");
  return `${value}:00${sign}${hours}:${minutes}`;
}

/** True only when the selected local calendar day is earlier than today. */
export function isPreviousLocalCalendarDate(value: string, now = new Date()) {
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return false;
  const offsetMinutes = offsetMinutesFromIso(value);
  return value.slice(0, 10) < dateKeyAtOffset(now, offsetMinutes);
}
