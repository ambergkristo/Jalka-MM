export function formatMatchDate(value: unknown): string {
  if (typeof value !== 'string' || value.trim() === '' || value === 'TBC') return 'Date TBC';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date TBC';
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}

export function formatEstoniaKickoffTime(value: unknown): string {
  if (typeof value !== 'string' || value.trim() === '' || value === 'TBC') return 'Time TBC';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Time TBC';
  return `${new Intl.DateTimeFormat('et-EE', {
    timeZone: 'Europe/Tallinn',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(date)} Eesti aeg`;
}
