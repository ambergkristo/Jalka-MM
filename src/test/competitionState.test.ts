import { describe, expect, it } from 'vitest';
import { defaultPlayerView, deriveCompetitionState, landingPrimaryLabel } from '../client/lib/competitionState.js';

const future = '2026-06-11T19:00:00.000Z';
const past = '2026-01-01T00:00:00.000Z';

function state(overrides: Record<string, unknown> = {}) {
  return {
    competition: { prediction_deadline: future, predictions_locked: 0 },
    matches: [{ id: 1 }, { id: 2 }],
    results: [],
    ...overrides
  };
}

describe('competition state routing', () => {
  it('routes open predictions toward prediction entry', () => {
    const current = deriveCompetitionState(state(), Date.parse('2026-05-01T00:00:00.000Z'));
    expect(current).toBe('predictions_open');
    expect(defaultPlayerView(current)).toBe('predict');
    expect(landingPrimaryLabel(current, false)).toBe('Mine ennustama');
  });

  it('routes locked predictions toward results or overview', () => {
    const current = deriveCompetitionState(state({ competition: { prediction_deadline: past, predictions_locked: 0 } }), Date.parse('2026-05-01T00:00:00.000Z'));
    expect(current).toBe('predictions_locked_before_tournament');
    expect(defaultPlayerView(current)).toBe('results');
    expect(landingPrimaryLabel(current, true)).toBe('Vaata oma ennustusi');
  });

  it('routes tournament live and finished states toward results', () => {
    expect(deriveCompetitionState(state({ results: [{ match_id: 1 }] }))).toBe('tournament_live');
    expect(deriveCompetitionState(state({ results: [{ match_id: 1 }, { match_id: 2 }] }))).toBe('tournament_finished');
    expect(landingPrimaryLabel('tournament_live', true)).toBe('Vaata tulemusi');
    expect(landingPrimaryLabel('tournament_finished', true)).toBe('Vaata lõpptulemusi');
  });
});
