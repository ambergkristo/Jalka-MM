import { describe, expect, it } from 'vitest';
import { confirmedLatestResults, getPublicMatchSection } from '../client/data/publicDashboard.js';
import { groupLeaders } from '../client/data/mock.js';

describe('public dashboard data', () => {
  it('shows opening matchday fixtures before tournament start', () => {
    const section = getPublicMatchSection(new Date('2026-06-06T12:00:00.000Z'));

    expect(section.title).toBe('Avapäeva mängud');
    expect(section.eyebrow).toBe('11. juuni 2026');
    expect(section.matches.length).toBeGreaterThan(0);
    expect(section.matches[0]).toMatchObject({
      homeTeam: 'Mexico',
      awayTeam: 'South Africa',
      kickoffTime: '11.06 • 22:00',
      status: 'scheduled',
      stage: 'Alagrupp A'
    });
  });

  it('does not crash on placeholder kickoff times after tournament start', () => {
    const section = getPublicMatchSection(new Date('2026-06-12T12:00:00.000Z'));

    expect(section.title).toContain('mängud');
    expect(section.matches.every((match) => match.kickoffTime.length > 0)).toBe(true);
  });

  it('does not expose fake confirmed latest results', () => {
    expect(confirmedLatestResults).toEqual([]);
  });

  it('keeps group leader cards as neutral group shortcuts before results exist', () => {
    expect(groupLeaders).toHaveLength(12);
    expect(groupLeaders.every((group) => group.team === undefined && group.points === undefined && group.record === undefined)).toBe(true);
  });
});
