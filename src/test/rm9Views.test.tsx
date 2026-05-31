import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { LandingPage } from '../client/components/LandingPage.js';
import { ResultsOverview } from '../client/components/ResultsOverview.js';
import { RulesView } from '../client/components/RulesView.js';

const baseState = {
  competition: { prediction_deadline: '2026-06-11T19:00:00.000Z', predictions_locked: 0 },
  teams: [],
  matches: [],
  predictions: [],
  results: [],
  leaderboard: [],
  currentPlayer: { status: 'pending' }
};

describe('RM9 player views', () => {
  it('renders landing actions and private league copy', () => {
    const html = renderToStaticMarkup(<LandingPage state={baseState} player={null} competitionState="predictions_open" onPrimary={() => undefined} onRules={() => undefined} />);
    expect(html).toContain('Sõprade jalgpalliennustus 2026');
    expect(html).toContain('Mine ennustama');
    expect(html).toContain('Reeglid');
  });

  it('renders required rules sections', () => {
    const html = renderToStaticMarkup(<RulesView />);
    expect(html).toContain('Osalemine');
    expect(html).toContain('Alagrupimängude punktid');
    expect(html).toContain('Täpne tulemus – 6 punkti');
    expect(html).toContain('Ametlikus edetabelis kuvatakse ainult korraldaja kinnitatud osalejad.');
  });

  it('renders honest results empty state without automated live claims', () => {
    const html = renderToStaticMarkup(<ResultsOverview state={baseState} player={{ id: 'p1' }} onLeaderboard={() => undefined} onDetails={() => undefined} onPredictions={() => undefined} />);
    expect(html).toContain('Tulemused ilmuvad siia pärast mängude lõppu.');
    expect(html).toContain('Rakendus ei kuva automaatset live-andmevoogu.');
    expect(html).not.toContain('LIVE');
  });

  it('renders stored actual result, own prediction, and points', () => {
    const state = {
      ...baseState,
      teams: [
        { id: 'MEX', code: 'MEX', name: 'Mexico', name_et: 'Mehhiko' },
        { id: 'RSA', code: 'RSA', name: 'South Africa', name_et: 'Lõuna-Aafrika' }
      ],
      matches: [{ id: 1, stage: 'GROUP', group_id: 'A', kickoff_at: '2026-06-11T19:00:00.000Z', home_team_id: 'MEX', away_team_id: 'RSA', home_slot: 'Mehhiko', away_slot: 'Lõuna-Aafrika' }],
      predictions: [{ match_id: 1, home_goals: 2, away_goals: 1 }],
      results: [{ match_id: 1, home_goals: 2, away_goals: 1 }],
      leaderboard: [{ playerId: 'p1', name: 'Test', totalPoints: 6, matchPoints: 6, bonusPoints: 0 }]
    };
    const html = renderToStaticMarkup(<ResultsOverview state={state} player={{ id: 'p1' }} initialBreakdown={[{ item_type: 'match', item_id: '1', points: 6 }]} onLeaderboard={() => undefined} onDetails={() => undefined} onPredictions={() => undefined} />);
    expect(html).toContain('2:1');
    expect(html).toContain('Minu ennustus: 2:1');
    expect(html).toContain('6 punkti');
  });
});
