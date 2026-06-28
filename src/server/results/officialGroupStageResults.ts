import officialResultsJson from '../../data/worldcup2026/official-group-stage-results.json' with { type: 'json' };

interface OfficialGroupStageResultRow {
  matchId: number;
  homeScore: number;
  awayScore: number;
}

const officialResults = (officialResultsJson as {
  results: OfficialGroupStageResultRow[];
}).results;

const officialResultByMatchId = new Map(officialResults.map((result) => [result.matchId, result]));

export interface ResolvedOfficialGroupStageResult {
  homeScore: number;
  awayScore: number;
}

export function getOfficialGroupStageResult(matchId: number): ResolvedOfficialGroupStageResult | undefined {
  const result = officialResultByMatchId.get(matchId);
  if (!result) return undefined;
  return {
    homeScore: result.homeScore,
    awayScore: result.awayScore
  };
}

export function useOfficialGroupStageResults(confirmedGroupStageMatches: number): boolean {
  return confirmedGroupStageMatches >= 72;
}
