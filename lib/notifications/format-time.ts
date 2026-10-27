// lib/notifications/format-time.ts
export type TimeKey =
  | { key: "justNow" }
  | { key: "minutesAgo"; count: number }
  | { key: "hoursAgo"; count: number }
  | { key: "yesterday" }
  | { key: "daysAgo"; count: number };

export function relativeTime(date: Date, now: Date = new Date()): TimeKey {
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);

  if (diffMin < 1) return { key: "justNow" };
  if (diffMin < 60) return { key: "minutesAgo", count: diffMin };

  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return { key: "hoursAgo", count: diffHours };

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return { key: "yesterday" };
  if (diffDays < 7) return { key: "daysAgo", count: diffDays };

  return { key: "daysAgo", count: diffDays };
}
