export interface OfficialMatchPointCorrection {
  playerId: string;
  matchId: number;
  points: 0 | 2 | 4 | 6;
  source: string;
  reason: string;
}

const corrections = new Map<string, OfficialMatchPointCorrection>([
  [
    'martin-becis:17',
    {
      playerId: 'martin-becis',
      matchId: 17,
      points: 2,
      source: 'Argo scoresheet ALAGRUPI ERI',
      reason: 'Official scoresheet column differs from the detailed workbook row while the organizer total matches the scoresheet.'
    }
  ],
  [
    'martin-becis:20',
    {
      playerId: 'martin-becis',
      matchId: 20,
      points: 2,
      source: 'Argo scoresheet ALAGRUPI ERI',
      reason: 'Official scoresheet column differs from the detailed workbook row while the organizer total matches the scoresheet.'
    }
  ]
]);

export function getOfficialMatchPointCorrection(playerId: string, matchId: number): OfficialMatchPointCorrection | undefined {
  return corrections.get(`${playerId}:${matchId}`);
}
