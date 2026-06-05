import { mkdirSync, statSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname } from 'node:path';
import { generateUniquePlayerId } from '../domain/playerIds.js';
import { loadPredictionSeedData } from '../domain/predictionRepository.js';
import type { AwardsPrediction, KnockoutPrediction, LeaderboardEntry, Player, PlayerMatchPrediction } from '../domain/predictionRepository.js';
import type { WorkSheet } from 'xlsx';

const require = createRequire(import.meta.url);
const xlsx = require('xlsx') as typeof import('xlsx');

const workbookPath = 'imports/data.xlsx';
const generatedSeedFiles = [
  'src/data/players.json',
  'src/data/predictions/matchPredictions.json',
  'src/data/predictions/groupPredictions.json',
  'src/data/predictions/knockoutPredictions.json',
  'src/data/predictions/awardsPredictions.json',
  'src/data/predictions/leaderboardSeed.json'
];
const validGroups = new Set(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L']);

interface ImportedPlayer extends Player {
  sourceNumber: number;
  sourceName: string;
  sourceRow: number;
  sourceSheet?: string;
  sourcePoints: number;
}

interface RawGroupPredictionSet {
  playerId: string;
  groups: Array<{ group: string; first: string; second: string; third: string }>;
}

interface ImportReport {
  sourceWorkbook: string;
  sourceWorkbookSize: number;
  sourceWorkbookLastModified: string;
  sheetsFound: string[];
  playerCountImported: number;
  skippedRows: Array<{ row: number; reason: string }>;
  missingFields: string[];
  unknownColumns: string[];
  predictionSectionsDetected: Record<string, number>;
  warnings: string[];
  generatedSeedFiles: string[];
  emailPrivacy: {
    sourceEmailsDetected: number;
    publicEmailFieldsWritten: number;
  };
  discoveredMapping: Record<string, string>;
  validationErrors: string[];
}

main();

function main() {
  const workbookInfo = statSync(workbookPath);
  const workbook = xlsx.readFile(workbookPath);
  const warnings: string[] = [];
  const skippedRows: ImportReport['skippedRows'] = [];
  const missingFields: string[] = [];
  const dataSheet = workbook.Sheets.data;
  if (!dataSheet) throw new Error('Workbook is missing required sheet: data');

  const dataRows = rowsFromSheet(dataSheet);
  const playerSheetNames = workbook.SheetNames.filter((sheet) => /^\d+\./.test(sheet));
  const playerSheetByNumber = new Map(playerSheetNames.map((sheet) => [Number(sheet.match(/^(\d+)\./)?.[1]), sheet]));
  const importedPlayers = extractPlayers(dataRows, playerSheetByNumber, skippedRows, missingFields);
  const publicPlayers = importedPlayers.map(({ id, name, location }) => ({ id, name, location }));
  const matchPredictions: PlayerMatchPrediction[] = [];
  const groupPredictions: RawGroupPredictionSet[] = [];
  const knockoutPredictions: KnockoutPrediction[] = [];
  const awardsPredictions: AwardsPrediction[] = [];

  for (const player of importedPlayers) {
    if (!player.sourceSheet) {
      warnings.push(`No individual player sheet found for ${player.name}; predictions skipped.`);
      continue;
    }
    const sheet = workbook.Sheets[player.sourceSheet];
    const rows = rowsFromSheet(sheet);
    matchPredictions.push(...extractMatchPredictions(player, rows, warnings));
    groupPredictions.push({ playerId: player.id, groups: extractGroupPredictions(player, rows, warnings) });
    knockoutPredictions.push(extractKnockoutPrediction(player, rows));
    const awards = extractAwardsPrediction(player, rows, warnings);
    if (awards) awardsPredictions.push(awards);
  }

  const leaderboardSeed = createLeaderboardSeed(importedPlayers, workbookInfo.mtime.toISOString());
  writeJson('src/data/players.json', publicPlayers);
  writeJson('src/data/predictions/matchPredictions.json', matchPredictions);
  writeJson('src/data/predictions/groupPredictions.json', groupPredictions);
  writeJson('src/data/predictions/knockoutPredictions.json', knockoutPredictions);
  writeJson('src/data/predictions/awardsPredictions.json', awardsPredictions);
  writeJson('src/data/predictions/leaderboardSeed.json', leaderboardSeed);

  const validation = loadPredictionSeedData({
    players: publicPlayers,
    matchPredictions,
    groupPredictions,
    knockoutPredictions,
    awardsPredictions,
    leaderboard: leaderboardSeed
  });

  const report: ImportReport = {
    sourceWorkbook: workbookPath,
    sourceWorkbookSize: workbookInfo.size,
    sourceWorkbookLastModified: workbookInfo.mtime.toISOString(),
    sheetsFound: workbook.SheetNames,
    playerCountImported: publicPlayers.length,
    skippedRows,
    missingFields,
    unknownColumns: ['data sheet columns after awards/knockout summary are not imported in Sprint 8'],
    predictionSectionsDetected: {
      playerSheets: playerSheetNames.length,
      matchPredictions: matchPredictions.length,
      groupPredictionSets: groupPredictions.length,
      knockoutPredictions: knockoutPredictions.length,
      awardsPredictions: awardsPredictions.length
    },
    warnings: [
      ...warnings,
      'Emails were read only to detect source privacy risk and were not written to public seed files.',
      'Existing Excel points are imported into leaderboardSeed; exact score and hit-rate metrics are initialized to 0 until app scoring recalculates them.',
      'Best Player is detected in player sheets but deferred because the public AwardsPrediction model does not include it yet.'
    ],
    generatedSeedFiles,
    emailPrivacy: {
      sourceEmailsDetected: countSourceEmails(dataRows),
      publicEmailFieldsWritten: 0
    },
    discoveredMapping: {
      players: 'data sheet rows 4+, columns A:D = name, KOV/location, email, existing points',
      matchPredictions: 'individual player sheets rows 1-72, columns B:E = home team, home score, away score, away team; matchId = row number',
      groupPredictions: 'individual player sheets rows 76-87, columns B/E/H/F = group first, second, third, group id',
      knockoutPredictions: 'individual player sheets rows 91-106 R32, 107-114 R16, 115-118 QF, 119-120 SF, row 122 Final',
      awardsPredictions: 'individual player sheets rows 124/132, column C = champion/top scorer'
    },
    validationErrors: validation.errors
  };
  writeJson('imports/import-report.json', report);
  if (validation.errors.length > 0) {
    console.error(JSON.stringify({ valid: false, errors: validation.errors }, null, 2));
    process.exitCode = 1;
    return;
  }
  console.log(JSON.stringify({ valid: true, playersImported: publicPlayers.length, generatedSeedFiles }, null, 2));
}

function extractPlayers(rows: unknown[][], playerSheetByNumber: Map<number, string>, skippedRows: ImportReport['skippedRows'], missingFields: string[]): ImportedPlayer[] {
  const players: ImportedPlayer[] = [];
  const usedIds = new Set<string>();
  for (let index = 3; index < rows.length; index += 1) {
    const row = rows[index] ?? [];
    const rawName = text(row[0]);
    if (!rawName) {
      skippedRows.push({ row: index + 1, reason: 'empty name' });
      continue;
    }
    const sourceNumberMatch = rawName.match(/^(\d+)\./);
    if (!sourceNumberMatch) {
      skippedRows.push({ row: index + 1, reason: 'no numeric player prefix for matching an individual player sheet' });
      continue;
    }
    const sourceNumber = Number(sourceNumberMatch[1]);
    const sourceSheet = playerSheetByNumber.get(sourceNumber);
    if (!sourceSheet) {
      skippedRows.push({ row: index + 1, reason: `no individual player sheet found for source number ${sourceNumber}` });
      continue;
    }
    const name = rawName.replace(/^\d+\.\s*/, '').trim();
    if (!name) {
      skippedRows.push({ row: index + 1, reason: 'name was only numeric prefix' });
      continue;
    }
    const location = text(row[1]);
    const email = text(row[2]);
    if (!location) missingFields.push(`Row ${index + 1}: missing KOV/location for ${name}`);
    if (!email) missingFields.push(`Row ${index + 1}: missing email in source workbook for ${name}`);
    players.push({
      id: generateUniquePlayerId(name, usedIds),
      name,
      location: location || undefined,
      sourceNumber,
      sourceName: rawName,
      sourceRow: index + 1,
      sourceSheet,
      sourcePoints: number(row[3]) ?? 0
    });
  }
  return players;
}

function extractMatchPredictions(player: ImportedPlayer, rows: unknown[][], warnings: string[]): PlayerMatchPrediction[] {
  const predictions: PlayerMatchPrediction[] = [];
  for (let index = 0; index < 72; index += 1) {
    const row = rows[index] ?? [];
    const homeScore = number(row[2]);
    const awayScore = number(row[3]);
    if (homeScore === undefined || awayScore === undefined) {
      warnings.push(`${player.name}: missing score for group match ${index + 1}; match prediction skipped.`);
      continue;
    }
    predictions.push({
      playerId: player.id,
      matchId: index + 1,
      predictedHomeTeam: text(row[1]) || undefined,
      predictedAwayTeam: text(row[4]) || undefined,
      homeScore,
      awayScore
    });
  }
  return predictions;
}

function extractGroupPredictions(player: ImportedPlayer, rows: unknown[][], warnings: string[]) {
  const groups = [];
  for (let index = 75; index <= 86; index += 1) {
    const row = rows[index] ?? [];
    const group = text(row[5]);
    if (!validGroups.has(group)) {
      warnings.push(`${player.name}: group prediction row ${index + 1} has invalid group id "${group}".`);
      continue;
    }
    groups.push({
      group,
      first: text(row[1]),
      second: text(row[4]),
      third: text(row[7])
    });
  }
  return groups;
}

function extractKnockoutPrediction(player: ImportedPlayer, rows: unknown[][]): KnockoutPrediction {
  return {
    playerId: player.id,
    rounds: [
      { round: 'R32', teams: uniqueTeams(rows, 90, 105) },
      { round: 'R16', teams: uniqueTeams(rows, 106, 113) },
      { round: 'QF', teams: uniqueTeams(rows, 114, 117) },
      { round: 'SF', teams: uniqueTeams(rows, 118, 119) },
      { round: 'Final', teams: uniqueTeams(rows, 121, 121) }
    ]
  };
}

function extractAwardsPrediction(player: ImportedPlayer, rows: unknown[][], warnings: string[]): AwardsPrediction | undefined {
  const championTeam = text(rows[123]?.[2]);
  const topScorerName = text(rows[131]?.[2]);
  if (!championTeam && !topScorerName) {
    warnings.push(`${player.name}: awards prediction section is empty.`);
    return undefined;
  }
  return {
    playerId: player.id,
    championTeam: championTeam || 'Prediction unavailable',
    championStatus: 'Still alive',
    topScorerName: topScorerName || 'Prediction unavailable',
    topScorerTeam: 'Unknown team',
    topScorerCurrentGoals: 0,
    topScorerStatus: 'In chase'
  };
}

function createLeaderboardSeed(players: ImportedPlayer[], lastUpdatedAt: string): LeaderboardEntry[] {
  return [...players]
    .sort((a, b) => {
      if (b.sourcePoints !== a.sourcePoints) return b.sourcePoints - a.sourcePoints;
      return a.name.localeCompare(b.name, 'et');
    })
    .map((player, index) => ({
      playerId: player.id,
      rank: index + 1,
      points: player.sourcePoints,
      exactScores: 0,
      correctResults: 0,
      hitRate: 0,
      lastUpdatedAt
    }));
}

function uniqueTeams(rows: unknown[][], from: number, to: number): string[] {
  const teams: string[] = [];
  for (let index = from; index <= to; index += 1) {
    const row = rows[index] ?? [];
    for (const value of [text(row[1]), text(row[4])]) {
      if (value && !teams.includes(value)) teams.push(value);
    }
  }
  return teams;
}

function rowsFromSheet(sheet: WorkSheet): unknown[][] {
  return xlsx.utils.sheet_to_json(sheet, { header: 1, defval: null, blankrows: false }) as unknown[][];
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : typeof value === 'number' ? String(value) : '';
}

function number(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : undefined;
}

function countSourceEmails(rows: unknown[][]): number {
  return rows.slice(3).filter((row) => /@/.test(text(row[2]))).length;
}

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}
