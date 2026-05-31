export function formatMatchDate(value: unknown): string {
  if (typeof value !== 'string' || value.trim() === '' || value === 'TBC') return 'Kuupäev täpsustamisel';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Kuupäev täpsustamisel';
  return new Intl.DateTimeFormat('et-EE', {
    timeZone: 'Europe/Tallinn',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(date);
}

export function formatEstoniaKickoffTime(value: unknown): string {
  if (typeof value !== 'string' || value.trim() === '' || value === 'TBC') return 'Aeg täpsustamisel';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Aeg täpsustamisel';
  const formatted = new Intl.DateTimeFormat('et-EE', {
    timeZone: 'Europe/Tallinn',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(date);
  return `${formatted.replace(',', ' ·').replace(' kell ', ' ')} Eesti aeg`;
}

export function formatDeadlineDateTime(value: unknown): string {
  if (typeof value !== 'string' || value.trim() === '') return 'Tähtaeg määramata';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Tähtaeg määramata';
  return new Intl.DateTimeFormat('et-EE', {
    timeZone: 'Europe/Tallinn',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(date).replace(',', ' kell');
}
