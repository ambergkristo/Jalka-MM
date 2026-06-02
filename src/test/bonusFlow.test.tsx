import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { BonusPredictionPanel } from '../client/components/BonusPredictionPanel.js';

describe('eriennustused flow', () => {
  it('does not ask players to manually repeat derived group outcomes', () => {
    const state = { groups: [{ id: 'A' }], teams: [], competition: { prediction_deadline: '2026-06-11T19:00:00.000Z' }, bonusPrediction: null };
    const html = renderToStaticMarkup(<BonusPredictionPanel state={state} locked={false} saving="" onSave={() => undefined} />);
    expect(html).toContain('Eriennustused');
    expect(html).toContain('Alagrupi boonused arvutatakse mänguennustustest.');
    expect(html).not.toContain('<label>Alagrupi võitja');
    expect(html).not.toContain('Teine koht');
    expect(html).not.toContain('Edasipääsejad');
  });
});
