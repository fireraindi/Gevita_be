const JAKARTA_TIMEZONE = "Asia/Jakarta";

export function isValidCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year!, month! - 1, day!));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month! - 1 &&
    date.getUTCDate() === day
  );
}

export function getCurrentJakartaDate(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: JAKARTA_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function getCurrentJakartaYear(now: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: JAKARTA_TIMEZONE,
    year: "numeric",
  }).formatToParts(now);
  return Number(parts.find((item) => item.type === "year")?.value ?? "0");
}

export function getCurrentMonthRange(now: Date = new Date()): { startDate: string; endDate: string } {
  const [year, month] = getCurrentJakartaDate(now).split("-").map(Number);
  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const endDate = new Date(Date.UTC(year!, month!, 1)).toISOString().slice(0, 10);
  return { startDate, endDate };
}

export function getDefaultInclusiveMonthRange(now: Date = new Date()): { startDate: string; endDate: string } {
  const [year, month] = getCurrentJakartaDate(now).split("-").map(Number);
  const monthText = String(month).padStart(2, "0");
  const lastDay = new Date(Date.UTC(year!, month!, 0)).getUTCDate();
  return {
    startDate: `${year}-${monthText}-01`,
    endDate: `${year}-${monthText}-${String(lastDay).padStart(2, "0")}`,
  };
}

export function formatJakartaTime(date: Date | null): string | null {
  if (!date) return null;
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: JAKARTA_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "00";
  return `${part("hour")}:${part("minute")}:${part("second")}`;
}

export function getInclusiveDateRange(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const current = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  while (current <= end) {
    dates.push(current.toISOString().slice(0, 10));
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return dates;
}

