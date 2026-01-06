/**
 * Formats a duration in seconds to a human-readable SLA string
 * @param seconds - Duration in seconds
 * @returns Formatted string like "2d 03h 15m" or "5h 12m"
 */
export function formatSLA(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || seconds < 0) {
    return '-';
  }

  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds - (days * 86400)) / 3600);
  const minutes = Math.floor((seconds - (days * 86400) - (hours * 3600)) / 60);

  let result = '';

  if (days > 0) {
    result += `${days}d `;
  }

  if (hours > 0 || days > 0) {
    result += `${hours.toString().padStart(days > 0 ? 2 : 1, '0')}h `;
  }

  result += `${minutes.toString().padStart(hours > 0 || days > 0 ? 2 : 1, '0')}m`;

  return result.trim();
}

/**
 * Calculates SLA in seconds between two dates
 */
export function calculateSLASeconds(startDate: Date | string, endDate: Date | string): number {
  const start = typeof startDate === 'string' ? new Date(startDate) : startDate;
  const end = typeof endDate === 'string' ? new Date(endDate) : endDate;
  return Math.floor((end.getTime() - start.getTime()) / 1000);
}
