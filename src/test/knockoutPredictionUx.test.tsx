import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { MatchCard, slotLabelEt, stageLabel } from '../client/components/MatchPredictions.js';

const teams = [
  { id: 'A1', code: 'MEX', name: 'Mexico', name_et: 'Mehhiko', flag: 'x' },
  { id: 'B2', code: 'RSA', name: 'South Africa', name_et: 'Lõuna-Aafrika', flag: 'x' }
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
  });

  it('renders selected knockout teams with controlled country selectors', () => {
    const html = renderToStaticMarkup(
      <MatchCard
        match={{ id: 73, stage: 'R32', kickoff_at: 'TBC', home_slot: 'Group A runners-up', away_slot: 'Group B runners-up' }}
        teams={teams as any}
        teamsById={teamsById}
        disabled={false}
        value={{ matchId: 73, homeGoals: 1, awayGoals: 1, homeTeamPredictionId: 'A1', awayTeamPredictionId: 'B2', penaltyWinner: 'HOME', predictedWinnerTeamId: 'A1' }}
        onChange={() => undefined}
      />
    );
    expect(html).toContain('Otsi riiki');
    expect(html).toContain('Mehhiko');
    expect(html).toContain('Penaltiseeria võitja');
    expect(html).toContain('Edasipääseja');
  });
});
