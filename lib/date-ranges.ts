import { HttpError } from "@/lib/http";

const VIETNAM_UTC_OFFSET_HOURS = 7;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function parseDateParts(value: string) {
  if (!DATE_PATTERN.test(value)) {
    throw new HttpError(422, "Ngày không hợp lệ");
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
  ) {
    throw new HttpError(422, "Ngày không hợp lệ");
  }

  return { year, month, day };
}

function vietnamLocalDateToUtc(value: string, dayOffset = 0) {
  const { year, month, day } = parseDateParts(value);

  return new Date(Date.UTC(
    year,
    month - 1,
    day + dayOffset,
    -VIETNAM_UTC_OFFSET_HOURS,
  ));
}

export function vietnamDayRangeUtc(value: string) {
  return {
    start: vietnamLocalDateToUtc(value),
    end: vietnamLocalDateToUtc(value, 1),
  };
}

export function vietnamDateRangeUtc(from: string, to: string) {
  const range = {
    start: vietnamLocalDateToUtc(from),
    end: vietnamLocalDateToUtc(to, 1),
  };

  if (range.start >= range.end) {
    throw new HttpError(422, "Khoảng ngày không hợp lệ");
  }

  return range;
}

export function vietnamMonthRangeUtc(value: string) {
  const { year, month } = parseDateParts(value);
  const start = new Date(Date.UTC(year, month - 1, 1, -VIETNAM_UTC_OFFSET_HOURS));
  const end = new Date(Date.UTC(year, month, 1, -VIETNAM_UTC_OFFSET_HOURS));

  return { start, end };
}

export function todayInVietnam() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return `${values.year}-${values.month}-${values.day}`;
}
