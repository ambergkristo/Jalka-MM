import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { MatchCard } from '../client/components/MatchCard.js';
import type { DashboardMatch } from '../client/data/mock.js';

function match(overrides: Partial<DashboardMatch> = {}): DashboardMatch {
  return {
    id: '73',
    homeTeam: 'Mexico',
    awayTeam: 'Japan',
    kickoffTime: '30.06 22:00',
    stage: 'R32',
    status: 'scheduled',
    venue: 'Estadio Azteca',
    ...overrides
  };
}

describe('match card', () => {
  it('renders scheduled fixtures with kickoff time instead of an active score box', () => {
    const markup = renderToStaticMarkup(
      <MatchCard
        match={match({
          homeScore: 0,
          awayScore: 0
        })}
      />
    );

    expect(markup).toContain('R32');
    expect(markup).toContain('#73');
    expect(markup).toContain('30.06');
    expect(markup).toContain('22:00');
    expect(markup).not.toContain('0-0');
    expect(markup).not.toContain('0 - 0');
    expect(markup).toContain('Algamas');
  });

  it('renders live fixtures with an active score box', () => {
    const markup = renderToStaticMarkup(
      <MatchCard
        match={match({
          status: 'live',
          homeScore: 1,
          awayScore: 0
        })}
      />
    );

    expect(markup).toContain('OTSE');
    expect(markup).toContain('Hetkeseis 1-0');
    expect(markup).toContain('<strong>1</strong>');
    expect(markup).toContain('<strong>0</strong>');
  });
});

