import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LandingDashboard } from '../client/pages/LandingDashboard.js';
import { PlayerDetailPage } from '../client/pages/PlayerDetailPage.js';
import { ResultsPage } from '../client/pages/ResultsPage.js';
import { TournamentPage } from '../client/pages/TournamentPage.js';

describe('public dashboard pages', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-06T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders landing with opening fixtures, empty latest results, and no group leaders block', () => {
    const markup = renderToStaticMarkup(<LandingDashboard />);

    expect(markup).toContain('Avapäeva mängud');
    expect(markup).toContain('Lõppenud mänge veel ei ole.');
    expect(markup).not.toContain('Alagruppide liidrid');
    expect(markup).not.toContain('href="/tournament#group-a"');
    expect(markup).not.toContain('Brasiilia');
    expect(markup).not.toContain('Horvaatia');
    expect(markup).not.toContain('Hispaania');
  });

  it('renders results page without fake latest results', () => {
    const markup = renderToStaticMarkup(<ResultsPage />);

    expect(markup).toContain('Lõppenud mänge veel ei ole.');
    expect(markup).not.toContain('Punktid läksid jagamisele');
    expect(markup).not.toContain('võttis tähtsa võidu');
  });

  it('renders tournament page with placeholder playoff bracket before qualifiers are resolved', () => {
    const markup = renderToStaticMarkup(<TournamentPage />);
    const bracketMarkup = markup.slice(markup.indexOf('Play-off'));

    expect(markup).not.toContain('Turniiri kokkuvõte');
    expect(markup).not.toContain('Mängude edenemine etappide kaupa');
    expect(bracketMarkup).toContain('A1');
    expect(bracketMarkup).toContain('Parim 3. koht');
    expect(bracketMarkup).toContain('1/16-1 võitja');
    expect(bracketMarkup).not.toContain('Mehhiko');
    expect(bracketMarkup).not.toContain('Brasiilia');
    expect(bracketMarkup).not.toContain('Lõppenud');
  });

  it('renders player profile with zero public stats and grouped match score predictions', () => {
    const markup = renderToStaticMarkup(<PlayerDetailPage playerId="kristo-amberg" />);

    expect(markup).toContain('Kristo Amberg');
    expect(markup).toContain('Mängude ennustused');
    expect(markup).toContain('Mehhiko');
    expect(markup).toContain('Lõuna-Aafrika');
    expect(markup).toContain('0%');
    expect(markup).not.toContain('@');
  });
});
