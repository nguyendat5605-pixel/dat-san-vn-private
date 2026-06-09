const VIETNAM_UTC_OFFSET_HOURS = 7;
const VIETNAM_UTC_OFFSET_MS = VIETNAM_UTC_OFFSET_HOURS * 60 * 60 * 1000;

export interface VietnamDayRange {
  date: string;
  startUtc: Date;
  endUtc: Date;
}

/**
 * Build [start, end) UTC boundaries for a Vietnam business day.
 * Do not use server-local setHours(): production servers may run in UTC while
 * venue revenue reporting must follow Asia/Ho_Chi_Minh calendar days.
 */
export function getVietnamDayRange(date: Date = new Date()): VietnamDayRange {
  return getVietnamDayRangeFromDateString(getVietnamDateString(date));
}

/**
 * Treat YYYY-MM-DD as a Vietnam calendar date, not a server-local date.
 */
export function getVietnamDayRangeFromDateString(
  dateString: string,
): VietnamDayRange {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateString);

  if (!match) {
    throw new Error('Vietnam business date must use YYYY-MM-DD format');
  }

  const [, yearRaw, monthRaw, dayRaw] = match;
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);

  const utcMonthIndex = month - 1;
  const startUtcMs =
    Date.UTC(year, utcMonthIndex, day) - VIETNAM_UTC_OFFSET_MS;
  const endUtcMs =
    Date.UTC(year, utcMonthIndex, day + 1) - VIETNAM_UTC_OFFSET_MS;
  const startUtc = new Date(startUtcMs);

  if (getVietnamDateString(startUtc) !== dateString) {
    throw new Error('Invalid Vietnam business date');
  }

  return {
    date: dateString,
    startUtc,
    endUtc: new Date(endUtcMs),
  };
}

function getVietnamDateString(date: Date): string {
  const vietnamTimeMs = date.getTime() + VIETNAM_UTC_OFFSET_MS;
  return new Date(vietnamTimeMs).toISOString().slice(0, 10);
}
