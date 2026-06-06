import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { db } from '../server/db.js';
import { DatabaseResultRepository } from '../server/results/databaseResultRepository.js';
import { createResultProvider } from '../server/results/resultProviderFactory.js';
import { loadResultProviderConfig } from '../server/results/resultProviderConfig.js';
import { runResultUpdateCycle } from '../server/results/resultAgent.js';

const CANDIDATE_FILE_PATH = join(process.cwd(), 'imports', 'open-worldcup-fixtures-2026.candidate.json');

if (isMainModule()) {
  void (async () => {
    try {
      await run();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(JSON.stringify({ status: 'failed', error: message }, null, 2));
      process.exitCode = 1;
    } finally {
      await db.close();
    }
  })();
}

async function run(): Promise<void> {
  const now = parseNow(process.argv.slice(2)) ?? new Date();
  const config = loadResultProviderConfig();
  const provider = createResultProvider(config);
  const repository = new DatabaseResultRepository(db);
  const summary = await runResultUpdateCycle({
    repository,
    leaderboardRepository: repository,
    provider,
    now,
    dryRun: true,
    confirmationDelayMinutes: config.confirmationDelayMinutes
  });
  const candidateFile = loadCandidateFile();
  const skipWarnings = summary.warnings.filter((warning) => /skipped until manually verified/i.test(warning));

  console.log(JSON.stringify({
    status: 'ok',
    providerChain: config.providerChain,
    writeMode: config.writeMode,
    apiBaseUrl: config.openWorldCup.apiBaseUrl,
    now: now.toISOString(),
    dryRun: true,
    providerReachable: summary.observationsProcessed > 0,
    observationsProduced: summary.observationsProcessed,
    mappedHighConfidenceFixturesUsed: summary.observationsProcessed - skipWarnings.length,
    skippedMediumLowUnmatched: skipWarnings.length,
    finalCount: summary.finalObservations,
    provisionalCount: summary.provisionalObservations,
    liveCount: summary.liveObservations,
    scheduledCount: summary.scheduledObservations,
    wouldConfirm: summary.wouldConfirm,
    wouldNeedsReview: summary.wouldNeedsReview,
    dbWrites: 0,
    candidateMapSummary: candidateFile ? candidateFile.confidenceSummary : undefined,
    knownGap: normalizeKnownGap(candidateFile),
    notes: summary.observationsProcessed === 0
      ? ['No tracked matches were due at the selected time. Re-run with --now=2026-06-11T19:30:00Z to exercise the provider path.']
      : summary.warnings
  }, null, 2));
}

function loadCandidateFile(): { confidenceSummary: { high: number; medium: number; low: number; unmatched: number }; unmatchedReport?: Array<{ providerFixtureId: string; reason: string }> } | undefined {
  try {
    if (!existsSync(CANDIDATE_FILE_PATH)) return undefined;
    return JSON.parse(readFileSync(CANDIDATE_FILE_PATH, 'utf8'));
  } catch {
    return undefined;
  }
}

function normalizeKnownGap(candidateFile: ReturnType<typeof loadCandidateFile>): { providerFixtureId: string; reason: string } {
  const known = candidateFile?.unmatchedReport?.find((entry) => entry.providerFixtureId === '99');
  return {
    providerFixtureId: '99',
    reason: 'reversed knockout pairing skipped until manually verified',
    ...(known ? { ...known, reason: 'reversed knockout pairing skipped until manually verified' } : {})
  };
}

function parseNow(args: string[]): Date | undefined {
  const value = args.find((arg) => arg.startsWith('--now='));
  if (!value) return undefined;
  const raw = value.slice('--now='.length).trim();
  const parsed = Date.parse(raw);
  if (!Number.isFinite(parsed)) throw new Error(`Invalid --now value "${raw}". Use an ISO-8601 timestamp.`);
  return new Date(parsed);
}

function isMainModule(): boolean {
  if (process.argv.length < 2) return false;
  return import.meta.url === pathToFileURL(process.argv[1]).href;
}
