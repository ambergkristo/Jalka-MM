import { readFileSync } from 'node:fs';
import { loadPredictionSeedData } from '../domain/predictionRepository.js';

const seedFiles = [
  'src/data/players.json',
  'src/data/predictions/matchPredictions.json',
  'src/data/predictions/groupPredictions.json',
  'src/data/predictions/knockoutPredictions.json',
  'src/data/predictions/awardsPredictions.json',
  'src/data/predictions/leaderboardSeed.json'
];

const raw = {
  players: readJson(seedFiles[0]),
  matchPredictions: readJson(seedFiles[1]),
  groupPredictions: readJson(seedFiles[2]),
  knockoutPredictions: readJson(seedFiles[3]),
  awardsPredictions: readJson(seedFiles[4]),
  leaderboard: readJson(seedFiles[5])
};
const validation = loadPredictionSeedData(raw);
const emailLeaks = seedFiles.flatMap((path) => (/@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/.test(readFileSync(path, 'utf8')) ? [path] : []));
const errors = [...validation.errors, ...emailLeaks.map((path) => `Public seed file appears to contain an email address: ${path}`)];
const result = {
  valid: errors.length === 0,
  players: validation.data.players.length,
  matchPredictions: validation.data.matchPredictions.length,
  groupPredictions: validation.data.groupPredictions.length,
  knockoutPredictions: validation.data.knockoutPredictions.length,
  awardsPredictions: validation.data.awardsPredictions.length,
  leaderboardEntries: validation.data.leaderboard.length,
  errors
};

console.log(JSON.stringify(result, null, 2));
if (!result.valid) process.exitCode = 1;

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8')) as unknown;
}
