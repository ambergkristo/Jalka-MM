import { describe, expect, it } from 'vitest';
import type { Match, Team, TournamentMetadata } from '../domain/types.js';
import { createTournamentAuditReport } from '../domain/tournamentAudit.js';
import { allowedVerificationStatuses, validateTournamentData } from '../domain/tournamentValidation.js';

const metadata: TournamentMetadata = { sourceName: 'Test', sourceReference: 'test', sourceRetrievedAt: '2026-01-01T00:00:00.000Z', verificationStatus: 'seeded' };
const groups = Array.from({ length: 12 }, (_, index) => ({ id: String.fromCharCode(65 + index), name: `Group ${String.fromCharCode(65 + index)}` }));
const teams: Team[] = groups.flatMap((group) => Array.from({ length: 4 }, (_, index) => ({ id: `${group.id}${index + 1}`, code: `${group.id}${index + 1}`, name: `Group ${group.id} Team ${index + 1}`, flag: '◇', groupId: group.id })));
const matches: Match[] = [
  ...Array.from({ length: 72 }, (_, index) => ({ id: index + 1, stage: 'GROUP' as const, groupId: groups[Math.floor(index / 6)].id, kickoffAt: index === 0 ? 'TBC' : '2026-06-11T19:00:00.000Z', homeTeamId: `${groups[Math.floor(index / 6)].id}1`, awayTeamId: `${groups[Math.floor(index / 6)].id}2`, homeSlot: 'Home', awaySlot: 'Away' })),
  ...Array.from({ length: 32 }, (_, index) => ({ id: index + 73, stage: 'R32' as const, kickoffAt: '2026-07-01T19:00:00.000Z', homeSlot: 'Winner Group A', awaySlot: 'Best 3rd-place team' }))
];

describe('validateTournamentData', () => {
  it('defines the allowed verification statuses', () => {
    expect(allowedVerificationStatuses).toEqual(['official', 'partial_official', 'seeded', 'manual', 'unknown']);
  });

  it('accepts a complete seeded 104-match data set and TBC dates', () => {
    const result = validateTournamentData({ metadata, teams, groups, matches });
    expect(result.valid).toBe(true);
    expect(result.counts.matches).toBe(104);
    expect(result.warnings[0]).toContain('not official');
    expect(result.unresolved.kickoffTimes).toBe(1);
    expect(result.unresolved.groupStageKickoffMatchIds).toEqual([1]);
    expect(result.riskLevel).toBe('high');
  });

  it('supports mixed ISO and TBC kickoff data without invalid date output', () => {
    const result = validateTournamentData({ metadata, teams, groups, matches: matches.map((match, index) => index === 1 ? { ...match, kickoffAt: 'TBC' } : match) });
    expect(result.valid).toBe(true);
    expect(result.unresolved.groupStageKickoffMatchIds).toEqual([1, 2]);
  });

  it('fails when required metadata is missing', () => {
    const result = validateTournamentData({ metadata: { ...metadata, sourceName: '', sourceReference: '' }, teams, groups, matches });
    expect(result.errors).toContain('metadata.sourceName is required');
    expect(result.errors).toContain('metadata.sourceReference is required');
  });

  it('fails when verification status is invalid', () => {
    const result = validateTournamentData({ metadata: { ...metadata, verificationStatus: 'claimed' as any }, teams, groups, matches });
    expect(result.errors).toContain('metadata.verificationStatus claimed is not allowed');
  });

  it('requires source metadata for partial official data', () => {
    const result = validateTournamentData({ metadata: { ...metadata, verificationStatus: 'partial_official', sourceReference: '' }, teams, groups, matches });
    expect(result.errors).toContain('metadata.sourceReference is required');
  });

  it('detects duplicate matches', () => {
    const result = validateTournamentData({ metadata, teams, groups, matches: [{ ...matches[0] }, { ...matches[0] }] });
    expect(result.errors).toContain('Duplicate match id 1');
  });

  it('detects duplicate teams', () => {
    const result = validateTournamentData({ metadata, teams: [{ ...teams[0] }, { ...teams[0] }, ...teams.slice(2)], groups, matches });
    expect(result.errors).toContain('Duplicate team id A1');
  });

  it('detects invalid team references', () => {
    const result = validateTournamentData({ metadata, teams, groups, matches: [{ ...matches[0], homeTeamId: 'NOPE' }] });
    expect(result.errors).toContain('Match 1 references invalid home team NOPE');
  });

  it('detects invalid group references', () => {
    const result = validateTournamentData({ metadata, teams, groups, matches: [{ ...matches[0], groupId: 'Z' }] });
    expect(result.errors).toContain('Match 1 references invalid group Z');
  });

  it('creates an official data audit report', () => {
    const report = createTournamentAuditReport({ metadata: { ...metadata, verificationStatus: 'partial_official' }, teams, groups, matches });
    expect(report.valid).toBe(true);
    expect(report.verificationStatus).toBe('partial_official');
    expect(report.unresolvedKickoffTimes).toBe(1);
    expect(report.unresolvedGroupStageKickoffMatchIds).toEqual([1]);
    expect(report.riskLevel).toBe('medium');
  });
});
