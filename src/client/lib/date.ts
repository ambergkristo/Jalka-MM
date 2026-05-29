export function formatMatchDate(value: unknown): string {
  if (typeof value !== 'string' || value.trim() === '') return 'Date TBC';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date TBC';
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}
