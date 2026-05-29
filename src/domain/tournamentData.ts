import metadataJson from '../data/worldcup2026/metadata.json' with { type: 'json' };
import teamsJson from '../data/worldcup2026/teams.json' with { type: 'json' };
import groupsJson from '../data/worldcup2026/groups.json' with { type: 'json' };
import matchesJson from '../data/worldcup2026/matches.json' with { type: 'json' };
import bracketJson from '../data/worldcup2026/bracket.json' with { type: 'json' };
import type { Match, Team, TournamentMetadata } from './types.js';

export interface TournamentGroup {
  id: string;
  name: string;
  verificationStatus?: string;
}

export interface TournamentData {
  metadata: TournamentMetadata;
  teams: Team[];
  groups: TournamentGroup[];
  matches: Match[];
  bracket: unknown;
}

export function getTournamentData(): TournamentData {
  return {
    metadata: metadataJson as TournamentMetadata,
    teams: teamsJson as Team[],
    groups: groupsJson as TournamentGroup[],
    matches: matchesJson as Match[],
    bracket: bracketJson
  };
}
