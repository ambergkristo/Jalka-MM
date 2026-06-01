import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { isComplete, knockoutValidation, MatchCard, normalizeMatchPrediction, slotLabelEt, stageLabel } from '../client/components/MatchPredictions.js';

const teams = [
  { id: 'A1', code: 'MEX', name: 'Mexico', name_et: 'Mehhiko', flag: 'x' },
  { id: 'B2', code: 'RSA', name: 'South Africa', name_et: 'Lõuna-Aafrika', flag: 'x' },
  { id: 'C3', code: 'KOR', name: 'Korea Republic', name_et: 'Lõuna-Korea', flag: 'x' },
  { id: 'D4', code: 'CZE', name: 'Czechia', name_et: 'Tšehhi', flag: 'x' }
];
const teamsById = new Map(teams.map((team) => [team.id, team as any]));

describe('knockout prediction UX', () => {
  it('uses correct Estonian round labels', () => {
    expect(stageLabel('R32')).toBe('1/16-finaalid');
    expect(stageLabel('R16')).toBe('Kaheksandikfinaalid');
  });

  it('localizes technical bracket slot helper labels', () => {
    expect(slotLabelEt('Group A winners')).toBe('A-grupi võitja');
    expect(slotLabelEt('Group B runners-up')).toBe('B-grupi teine koht');
    expect(slotLabelEt('Group A/B/C/D/F third place')).toContain('Parim 3. koha meeskond');
    expect(slotLabelEt('Winner Match 73')).toBe('Mängu 73 võitja');
  });

  it('renders editable country picker triggers for previous-match playoff slots', () => {
    const html = renderToStaticMarkup(
      <MatchCard
        match={{ id: 89, stage: 'R16', kickoff_at: 'TBC', home_slot: 'Winner Match 73', away_slot: 'Winner Match 74' }}
        teams={teams as any}
        teamsById={teamsById}
        disabled={false}
        value={{ matchId: 89, homeGoals: 1, awayGoals: 0, homeTeamPredictionId: 'A1', awayTeamPredictionId: 'B2', predictedWinnerTeamId: 'A1' }}
        onChange={() => undefined}
      />
    );
    expect(html).toContain('Kodumeeskond');
    expect(html).toContain('Võõrsilmeeskond');
    expect(html).toContain('Mehhiko');
    expect(html).not.toContain('disabled=""');
  });

  it('allows completed but intentionally inconsistent playoff selections', () => {
    const matches = [
      { id: 73, stage: 'R32' },
      { id: 89, stage: 'R16' },
      { id: 101, stage: 'FINAL' }
    ];
    const draft = {
      73: normalizeMatchPrediction({ matchId: 73, homeGoals: 2, awayGoals: 0, homeTeamPredictionId: 'A1', awayTeamPredictionId: 'B2' }),
      89: normalizeMatchPrediction({ matchId: 89, homeGoals: 1, awayGoals: 0, homeTeamPredictionId: 'C3', awayTeamPredictionId: 'D4' }),
      101: normalizeMatchPrediction({ matchId: 101, homeGoals: 0, awayGoals: 1, homeTeamPredictionId: 'B2', awayTeamPredictionId: 'D4' })
    };
    expect(isComplete(draft, matches)).toBe(true);
    expect(draft[89].homeTeamPredictionId).toBe('C3');
  });

  it('validates only within one playoff match', () => {
    expect(knockoutValidation({ matchId: 73, homeGoals: 1, awayGoals: 0, homeTeamPredictionId: 'A1', awayTeamPredictionId: 'A1' })).toContain('Samas mängus ei saa mõlemal poolel olla sama riik.');
    expect(knockoutValidation({ matchId: 73, homeGoals: 1, awayGoals: 1, homeTeamPredictionId: 'A1', awayTeamPredictionId: 'B2' })).toContain('Viigilise tulemuse korral vali penaltiseeria võitja.');
    expect(knockoutValidation({ matchId: 73, homeGoals: 1, awayGoals: 0, homeTeamPredictionId: 'A1', awayTeamPredictionId: 'B2' })).toEqual([]);
  });
});
