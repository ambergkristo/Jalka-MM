import matchesJson from '../../data/worldcup2026/matches.json' with { type: 'json' };
import type { Match } from '../../domain/types.js';
import type { DashboardMatch, DashboardResult } from './mock.js';

const TOURNAMENT_START_UTC = Date.parse('2026-06-11T00:00:00.000Z');
const OPENING_MATCHDAY_END_UTC = Date.parse('2026-06-12T06:00:00.000Z');
const matches = matchesJson as Match[];

export interface MatchSection {
  eyebrow: string;
  title: 'AvapÃ¤eva mÃ¤ngud' | 'TÃ¤nased mÃ¤ngud' | 'Tulevad mÃ¤ngud' | 'Tulevased playoff mÃ¤ngud';
  matches: DashboardMatch[];
}

export const confirmedLatestResults: DashboardResult[] = [];

export function getPublicMatchSection(now = new Date()): MatchSection {
  if (now.getTime() < TOURNAMENT_START_UTC) {
    return {
      eyebrow: '11. juuni 2026',
      title: 'AvapÃ¤eva mÃ¤ngud',
      matches: openingMatchdayFixtures()
    };
  }

  const today = matches
    .filter((match) => hasValidKickoff(match.kickoffAt) && sameTallinnDate(match.kickoffAt, now))
    .sort(byKickoff)
    .map(toDashboardMatch);

  if (today.length > 0) {
    return {
      eyebrow: 'TÃ¤na',
      title: 'TÃ¤nased mÃ¤ngud',
      matches: today
    };
  }

  return {
    eyebrow: 'Ajakava',
    title: 'Tulevad mÃ¤ngud',
    matches: upcomingFixtures(now, 3)
  };
}

export function upcomingFixtures(now = new Date(), limit = 3): DashboardMatch[] {
  return matches
    .filter((match) => hasValidKickoff(match.kickoffAt) && Date.parse(match.kickoffAt) >= now.getTime())
    .sort(byKickoff)
    .slice(0, limit)
    .map(toDashboardMatch);
}

function openingMatchdayFixtures(): DashboardMatch[] {
  return matches
    .filter((match) => {
      const kickoff = Date.parse(match.kickoffAt);
      return Number.isFinite(kickoff) && kickoff >= TOURNAMENT_START_UTC && kickoff < OPENING_MATCHDAY_END_UTC;
    })
    .sort(byKickoff)
    .map(toDashboardMatch);
}

function toDashboardMatch(match: Match): DashboardMatch {
  return {
    id: String(match.id),
    homeTeam: match.homeSlot,
    awayTeam: match.awaySlot,
    kickoffTime: formatTallinnKickoff(match.kickoffAt),
    stage: match.groupId ? `Alagrupp ${match.groupId}` : stageLabel(match.stage),
    status: 'scheduled',
    venue: venueCity(match.venue)
  };
}

function sameTallinnDate(kickoffAt: string, now: Date): boolean {
  if (!hasValidKickoff(kickoffAt)) return false;
  const formatter = new Intl.DateTimeFormat('et-EE', {
    timeZone: 'Europe/Tallinn',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  return formatter.format(new Date(kickoffAt)) === formatter.format(now);
}

export function formatTallinnKickoff(kickoffAt: string): string {
  if (!hasValidKickoff(kickoffAt)) return 'TBC';
  const date = new Intl.DateTimeFormat('et-EE', {
    timeZone: 'Europe/Tallinn',
    day: '2-digit',
    month: '2-digit'
  }).format(new Date(kickoffAt)).replace(/\.$/, '');
  const time = new Intl.DateTimeFormat('et-EE', {
    timeZone: 'Europe/Tallinn',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(kickoffAt));
  return `${date} ${time}`;
}

function venueCity(venue: string | undefined): string {
  if (!venue) return 'Toimumiskoht selgumisel';
  const parts = venue.split(',');
  return parts.at(-1)?.trim() || venue;
}

function byKickoff(a: Match, b: Match): number {
  return kickoffTimestamp(a.kickoffAt) - kickoffTimestamp(b.kickoffAt);
}

function stageLabel(stage: Match['stage']): string {
  return ({
    GROUP: 'Alagrupid',
    R32: '1/16-finaalid',
    R16: '1/8-finaalid',
    QF: 'Veerandfinaal',
    SF: 'Poolfinaal',
    THIRD_PLACE: '3. koha mäng',
    FINAL: 'Finaal'
  } as Record<Match['stage'], string>)[stage] ?? stage;
}

function hasValidKickoff(kickoffAt: string): boolean {
  return Number.isFinite(Date.parse(kickoffAt));
}

function kickoffTimestamp(kickoffAt: string): number {
  const timestamp = Date.parse(kickoffAt);
  return Number.isFinite(timestamp) ? timestamp : Number.POSITIVE_INFINITY;
}
