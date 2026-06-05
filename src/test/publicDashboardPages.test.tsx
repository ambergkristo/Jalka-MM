import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LandingDashboard } from '../client/pages/LandingDashboard.js';
import { ResultsPage } from '../client/pages/ResultsPage.js';

describe('public dashboard pages', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-06T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders landing with opening fixtures, empty latest results, and group shortcuts', () => {
    const markup = renderToStaticMarkup(<LandingDashboard />);

    expect(markup).toContain('Avapäeva mängud');
    expect(markup).toContain('Lõppenud mänge veel ei ole.');
    expect(markup).toContain('href="/tournament#group-a"');
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
});
