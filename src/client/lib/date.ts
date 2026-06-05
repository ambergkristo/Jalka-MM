export function formatMatchDate(value: unknown): string {
  if (typeof value !== 'string' || value.trim() === '' || value === 'TBC') return 'Date TBC';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date TBC';
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Tallinn',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(date);
}

export function formatEstoniaKickoffTime(value: unknown): string {
  if (typeof value !== 'string' || value.trim() === '' || value === 'TBC') return 'Kickoff TBC';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Kickoff TBC';
  const formatted = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Tallinn',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(date);
  return `${formatted} Estonia time`;
}
