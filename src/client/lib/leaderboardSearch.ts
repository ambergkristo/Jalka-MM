import type { LeaderboardRowView } from './predictionViewModels.js';

export function filterLeaderboardRows(rows: LeaderboardRowView[], query: string): LeaderboardRowView[] {
  const terms = normalizeLeaderboardSearchValue(query).split(/\s+/).filter(Boolean);
  if (terms.length === 0) return rows;

  return rows.filter((row) => {
    const searchable = normalizeLeaderboardSearchValue(`${row.player} ${row.playerId}`);
    return terms.every((term) => searchable.includes(term));
  });
}

export function normalizeLeaderboardSearchValue(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}
