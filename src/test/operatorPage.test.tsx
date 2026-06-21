import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { matchRoute } from '../client/App.js';
import { Navigation } from '../client/components/Navigation.js';
import {
  OperatorPage,
  appendScorerRow,
  buildScorersPayload,
  clearStoredSecret,
  classifyError,
  filterOperatorMatches,
  parseScore,
  persistSecret,
  postManualConfirm,
  readStoredSecret,
  removeScorerRow
} from '../client/pages/OperatorPage.js';

describe('operator page', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete (globalThis as typeof globalThis & { window?: Window }).window;
  });

  it('renders the locked operator unlock screen and does not expose the secret', () => {
    expect(matchRoute('/operator')).toEqual({ name: 'operator' });

    const markup = renderToStaticMarkup(<OperatorPage />);

    expect(markup).toContain('Operaatori ligipääs');
    expect(markup).toContain('Sisesta operaatori kood');
    expect(markup).toContain('Ava operaatori vaade');
    expect(markup).not.toContain('jalka-mm-operator-secret');
  });

  it('renders the unlocked operator workspace when the secret is already saved locally', () => {
    const storage = memoryStorage();
    Object.defineProperty(globalThis, 'window', { value: { localStorage: storage }, configurable: true });
    persistSecret('top-secret');

    const markup = renderToStaticMarkup(<OperatorPage />);

    expect(markup).toContain('Logi operaatorist välja');
    expect(markup).toContain('Match filter');
    expect(markup).toContain('Lisa väravalööja');
    expect(markup).toContain('Re-sync scorers from confirmed provider results');
    expect(markup).toContain('Provider Health');
    expect(markup).toContain('Verifier inactive');
  });

  it('shows the operator navigation link', () => {
    const markup = renderToStaticMarkup(<Navigation pathname="/" />);

    expect(markup).toContain('href="/operator"');
    expect(markup).toContain('Operaator');
  });

  it('filters matches and supports scorer row add/remove helpers', () => {
    const matches = [
      { id: 1, kickoffAt: '2026-06-11T19:00:00.000Z', publicStatus: 'SCHEDULED', isConfirmed: false },
      { id: 2, kickoffAt: '2026-06-12T19:00:00.000Z', publicStatus: 'CONFIRMED_FINAL', isConfirmed: true }
    ] as const;

    expect(filterOperatorMatches(matches as never, 'confirmed')).toHaveLength(1);
    expect(appendScorerRow([{ playerName: '', teamCode: '', goals: '1' }])).toHaveLength(2);
    expect(removeScorerRow([{ playerName: '', teamCode: '', goals: '1' }], 0)).toHaveLength(1);
  });

  it('builds a scorer payload only when the row is complete', () => {
    const selectedMatch = {
      homeTeam: { code: 'MEX', nameEt: 'Mehhiko', name: 'Mexico' },
      awayTeam: { code: 'RSA', nameEt: 'Lõuna-Aafrika', name: 'South Africa' }
    } as never;

    expect(buildScorersPayload([], selectedMatch)).toBeUndefined();
    expect(
      buildScorersPayload([{ playerName: 'Santiago Gimenez', teamCode: 'MEX', goals: '2' }], selectedMatch)
    ).toEqual([
      { playerName: 'Santiago Gimenez', teamCode: 'MEX', teamName: 'Mehhiko', goals: 2 }
    ]);
    expect(() => buildScorersPayload([{ playerName: '', teamCode: 'MEX', goals: '1' }], selectedMatch)).toThrow('Sisesta väravalööja nimi.');
  });

  it('stores and reads the operator secret locally', () => {
    const storage = memoryStorage();
    Object.defineProperty(globalThis, 'window', { value: { localStorage: storage }, configurable: true });

    persistSecret('top-secret');
    expect(readStoredSecret()).toBe('top-secret');
  });

  it('sends the operator secret header and classifies authentication failure', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: false,
      status: 403,
      async json() {
        return { error: 'Invalid results-agent secret.' };
      }
    } as Response));

    const response = await postManualConfirm({
      secret: 'top-secret',
      payload: {
        matchId: 1,
        homeScore: 2,
        awayScore: 1,
        decidedAfter: 'FT',
        source: 'manual-ui',
        confirmedBy: 'operator-ui',
        notes: 'checked',
        scorers: [{ playerName: 'Santiago Gimenez', teamName: 'Mehhiko', teamCode: 'MEX', goals: 2 }]
      },
      fetchImpl
    });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0][1]).toMatchObject({
      headers: {
        'content-type': 'application/json',
        'x-results-agent-secret': 'top-secret'
      }
    });
    expect(response.authFailed).toBe(true);
    expect(response.ok).toBe(false);
  });

  it('returns success for a confirmed manual result response', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      async json() {
        return { auditId: 'audit-1' };
      }
    } as Response));

    const response = await postManualConfirm({
      secret: 'top-secret',
      payload: {
        matchId: 1,
        homeScore: 2,
        awayScore: 1,
        decidedAfter: 'FT',
        source: 'manual-ui',
        confirmedBy: 'operator-ui'
      },
      fetchImpl
    });

    expect(response.ok).toBe(true);
    expect(response.body).toMatchObject({ auditId: 'audit-1' });
  });

  it('clears the saved secret when logging out', () => {
    const storage = memoryStorage();
    Object.defineProperty(globalThis, 'window', { value: { localStorage: storage }, configurable: true });

    persistSecret('top-secret');
    clearStoredSecret();

    expect(readStoredSecret()).toBe('');
  });

  it('parses scores safely', () => {
    expect(parseScore('2')).toBe(2);
    expect(() => parseScore('-1')).toThrow('Kontrolli skoori ja proovi uuesti.');
    expect(classifyError('Invalid results-agent secret.')).toBe('Vale operaatori kood.');
  });
});

function memoryStorage(): Storage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.get(key) ?? null;
    },
    key(index: number) {
      return [...store.keys()][index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    }
  };
}
