/**
 * Parse Jira-style time input to minutes.
 * Accepts: "1d", "2d 4h", "3h", "1d 2h 30m", "45m"
 * Rules: 1 day = 8 hours, 1 hour = 60 minutes
 */
export function parseTimeToMinutes(input: string): number {
  if (!input || !input.trim()) return 0;

  const trimmed = input.trim();

  // Validate: only allow d, h, m tokens with numbers
  const validPattern = /^(\s*\d+\s*[dhm]\s*)+$/;
  if (!validPattern.test(trimmed)) {
    throw new Error(
      `Invalid time format: "${input}". Use formats like "1d", "2h", "30m", "1d 2h 30m".`,
    );
  }

  let totalMinutes = 0;

  const dayMatch = trimmed.match(/(\d+)\s*d/);
  const hourMatch = trimmed.match(/(\d+)\s*h/);
  const minMatch = trimmed.match(/(\d+)\s*m/);

  if (dayMatch) totalMinutes += parseInt(dayMatch[1], 10) * 8 * 60;
  if (hourMatch) totalMinutes += parseInt(hourMatch[1], 10) * 60;
  if (minMatch) totalMinutes += parseInt(minMatch[1], 10);

  return totalMinutes;
}

/**
 * Format minutes into a human-readable string.
 * Examples:
 *   480  → "1 day"
 *   540  → "1 day 1 hour"
 *   615  → "1 day 2 hours 15 minutes"
 *   90   → "1 hour 30 minutes"
 *   45   → "45 minutes"
 *   0    → "0 minutes"
 */
export function formatMinutesToReadable(minutes: number): string {
  if (minutes === 0) return "0 minutes";

  const MINS_PER_DAY = 8 * 60;
  const MINS_PER_HOUR = 60;

  const days = Math.floor(minutes / MINS_PER_DAY);
  const remaining = minutes % MINS_PER_DAY;
  const hours = Math.floor(remaining / MINS_PER_HOUR);
  const mins = remaining % MINS_PER_HOUR;

  const parts: string[] = [];

  if (days > 0) parts.push(`${days} ${days === 1 ? "day" : "days"}`);
  if (hours > 0) parts.push(`${hours} ${hours === 1 ? "hour" : "hours"}`);
  if (mins > 0) parts.push(`${mins} ${mins === 1 ? "minute" : "minutes"}`);

  return parts.join(" ");
}
