import { db, seedTournamentData } from '../server/db.js';
import { confirmManualResultRuntime } from '../server/results/resultAgentRuntime.js';
import type { ManualResultDecidedAfter, ManualResultConfirmationInput } from '../server/results/manualResultCorrection.js';

await seedTournamentData();

const confirmation = parseArgs(process.argv.slice(2));
const summary = await confirmManualResultRuntime(confirmation);

console.log(JSON.stringify({
  status: 'ok',
  matchId: summary.matchId,
  action: summary.action,
  previousScore: score(summary.previousHomeScore, summary.previousAwayScore),
  newScore: score(summary.newHomeScore, summary.newAwayScore),
  clearedNeedsReview: summary.clearedNeedsReview,
  leaderboardRebuilt: summary.leaderboardRebuilt,
  playersProcessed: summary.playersProcessed,
  auditId: summary.auditId,
  warnings: summary.warnings
}, null, 2));

await db.close();

function parseArgs(args: string[]): ManualResultConfirmationInput {
  const values = new Map(args.flatMap((arg) => {
    if (!arg.startsWith('--')) return [];
    const separator = arg.indexOf('=');
    if (separator === -1) return [[arg.slice(2), '']];
    return [[arg.slice(2, separator), arg.slice(separator + 1)]];
  }));

  return {
    matchId: requiredInteger(values, 'matchId'),
    homeScore: requiredInteger(values, 'homeScore'),
    awayScore: requiredInteger(values, 'awayScore'),
    status: 'CONFIRMED_FINAL',
    decidedAfter: optionalDecidedAfter(values.get('decidedAfter')),
    penaltyWinnerTeamId: optionalString(values.get('penaltyWinnerTeamId')),
    penaltyWinnerTeamCode: optionalString(values.get('penaltyWinnerTeamCode')),
    notes: optionalString(values.get('notes')),
    source: optionalString(values.get('source')) ?? 'manual',
    confirmedBy: optionalString(values.get('confirmedBy')) ?? 'operator'
  };
}

function requiredInteger(values: Map<string, string>, key: string): number {
  const raw = values.get(key);
  const parsed = Number(raw);
  if (!Number.isInteger(parsed)) throw new Error(`Missing or invalid --${key}=<integer>`);
  return parsed;
}

function optionalString(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function optionalDecidedAfter(value: string | undefined): ManualResultDecidedAfter | undefined {
  if (!value) return undefined;
  if (value === 'FT' || value === 'AET' || value === 'PEN') return value;
  throw new Error('--decidedAfter must be FT, AET, or PEN');
}

function score(home: number | undefined, away: number | undefined): string | undefined {
  if (typeof home !== 'number' || typeof away !== 'number') return undefined;
  return `${home}-${away}`;
}
