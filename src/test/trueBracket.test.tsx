import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { TrueBracket } from '../client/components/TrueBracket.js';
import { buildPublicPlayoffBracketTree } from '../domain/publicBracket.js';

const playoffBracketTree = buildPublicPlayoffBracketTree();

describe('true playoff bracket', () => {
  it('contains left, right, centered final, and third-place structures', () => {
    expect(playoffBracketTree.left.side).toBe('LEFT');
    expect(playoffBracketTree.right.side).toBe('RIGHT');
    expect(playoffBracketTree.final.side).toBe('CENTER');
    expect(playoffBracketTree.final.stage).toBe('FINAL');
    expect(playoffBracketTree.thirdPlace.stage).toBe('THIRD_PLACE');
    expect(playoffBracketTree.left.rounds.map((round) => round.matches.length)).toEqual([8, 4, 2, 1]);
    expect(playoffBracketTree.right.rounds.map((round) => round.matches.length)).toEqual([8, 4, 2, 1]);
  });

  it('renders public placeholder slots without pre-filled teams or scores', () => {
    const markup = renderToStaticMarkup(<TrueBracket tree={playoffBracketTree} />);
    expect(markup).toContain('class="bracket-trophy"');
    expect(markup).toContain('A1');
    expect(markup).toContain('Parim 3. koht');
    expect(markup).toContain('1/16-3 võitja');
    expect(markup).toContain('Finaal');
    expect(markup).toContain('3. koha mäng');
    expect(markup).not.toContain('Mehhiko');
    expect(markup).not.toContain('Brasiilia');
    expect(markup).not.toContain('Lõppenud');
    expect(markup).not.toContain('<b>2</b>');
    expect(markup).not.toContain('<b>1</b>');
  });

  it('hydrates country slots only when a resolver explicitly marks them resolved', () => {
    const tree = buildPublicPlayoffBracketTree({
      resolvedSlots: {
        A1: { teamId: 'MEX', teamName: 'Mehhiko', teamCode: 'MEX' }
      }
    });
    const markup = renderToStaticMarkup(<TrueBracket tree={tree} />);

    expect(markup).toContain('Mehhiko');
    expect(markup).not.toContain('Brasiilia');
  });

  it('keeps public bracket labels Estonian', () => {
    const markup = renderToStaticMarkup(<TrueBracket tree={playoffBracketTree} />);
    expect(markup).not.toContain('Winner ');
    expect(markup).not.toContain('Left side');
    expect(markup).not.toContain('Right side');
    expect(markup).not.toContain('Scheduled');
    expect(markup).not.toContain('Final</');
  });

  it('mirrors the right side so its semi-final is closest to the centered final', () => {
    const markup = renderToStaticMarkup(<TrueBracket tree={playoffBracketTree} />);
    const rightSideStart = markup.indexOf('aria-label="Parem pool"');
    const rightSideMarkup = markup.slice(rightSideStart);

    expect(rightSideStart).toBeGreaterThan(-1);
    expect(rightSideMarkup.indexOf('Poolfinaal')).toBeLessThan(rightSideMarkup.indexOf('Veerandfinaalid'));
    expect(rightSideMarkup.indexOf('Veerandfinaalid')).toBeLessThan(rightSideMarkup.indexOf('1/8-finaalid'));
    expect(rightSideMarkup.indexOf('1/8-finaalid')).toBeLessThan(rightSideMarkup.indexOf('1/16-finaalid'));
  });
});
