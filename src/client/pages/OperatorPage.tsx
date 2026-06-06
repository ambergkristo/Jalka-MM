import { useEffect, useMemo, useState, type Dispatch, type FormEvent, type SetStateAction } from 'react';
import matchesSeed from '../../data/worldcup2026/matches.json' with { type: 'json' };
import { Card } from '../components/Card.js';
import { PageHeader } from '../components/PageHeader.js';
import type { PublicDashboardSnapshot } from '../lib/publicApi.js';

type SeedMatch = (typeof matchesSeed)[number];
type DecidedAfter = 'FT' | 'AET' | 'PEN';

interface ScorerRow {
  playerName: string;
  teamName: string;
  teamCode: string;
  goals: string;
}

const SECRET_STORAGE_KEY = 'jalka-mm.results-agent-secret';
const defaultScorerRow: ScorerRow = { playerName: '', teamName: '', teamCode: '', goals: '1' };

export function OperatorPage() {
  const [storedSecret, setStoredSecret] = useState<string>(() => readStoredSecret());
  const [secretInput, setSecretInput] = useState('');
  const [selectedMatchId, setSelectedMatchId] = useState<number>(groupStageMatches[0]?.id ?? 1);
  const [homeScore, setHomeScore] = useState('0');
  const [awayScore, setAwayScore] = useState('0');
  const [decidedAfter, setDecidedAfter] = useState<DecidedAfter>('FT');
  const [notes, setNotes] = useState('');
  const [scorers, setScorers] = useState<ScorerRow[]>([defaultScorerRow]);
  const [feedback, setFeedback] = useState<{ tone: 'good' | 'danger' | 'gold'; message: string } | undefined>();
  const [submitState, setSubmitState] = useState<'idle' | 'submitting'>('idle');
  const [snapshot, setSnapshot] = useState<PublicDashboardSnapshot | undefined>();
  const [snapshotVersion, setSnapshotVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/public-dashboard')
      .then((response) => response.ok ? response.json() as Promise<PublicDashboardSnapshot> : undefined)
      .then((data) => {
        if (!cancelled && data) setSnapshot(data);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [snapshotVersion]);

  const matchStatusById = useMemo(() => buildPublicStatusMap(snapshot), [snapshot]);
  const selectedMatch = useMemo(() => groupStageMatches.find((match) => match.id === selectedMatchId) ?? groupStageMatches[0], [selectedMatchId]);
  const selectedPublicStatus = selectedMatch ? matchStatusById[selectedMatch.id] ?? 'SCHEDULED' : 'SCHEDULED';

  function unlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextSecret = secretInput.trim();
    if (!nextSecret) {
      setFeedback({ tone: 'danger', message: 'Sisesta operaatori salajane võti.' });
      return;
    }
    setStoredSecret(nextSecret);
    persistSecret(nextSecret);
    setSecretInput('');
    setFeedback({ tone: 'good', message: 'Operaatori ligipääs avatud.' });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!storedSecret) {
      setFeedback({ tone: 'danger', message: 'Ava operaatori ligipääs enne kinnitamist.' });
      return;
    }

    setSubmitState('submitting');
    setFeedback(undefined);
    try {
      const payloadScorers = buildScorersPayload(scorers);
      const home = Number(homeScore);
      const away = Number(awayScore);
      if (!Number.isInteger(home) || home < 0 || !Number.isInteger(away) || away < 0) {
        throw new Error('Skoor peab olema mittenegatiivne täisarv.');
      }

      const response = await fetch('/api/results-agent/manual-confirm', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-results-agent-secret': storedSecret
        },
        body: JSON.stringify({
          matchId: selectedMatch?.id,
          homeScore: home,
          awayScore: away,
          status: 'CONFIRMED_FINAL',
          decidedAfter,
          notes: notes.trim() || undefined,
          source: 'operator-ui',
          confirmedBy: 'operator',
          scorers: payloadScorers
        })
      });

      const body = await safeJson(response);
      if (!response.ok) {
        throw new Error(String(body?.error ?? 'Tulemust ei õnnestunud kinnitada.'));
      }

      setFeedback({
        tone: 'good',
        message: `Tulemus kinnitatud. Audit ${String(body.auditId ?? 'salvestatud')} ja edetabel arvutati uuesti.`
      });
      setSnapshotVersion((value) => value + 1);
    } catch (error) {
      setFeedback({
        tone: 'danger',
        message: error instanceof Error ? error.message : 'Kinnitamine ebaõnnestus.'
      });
    } finally {
      setSubmitState('idle');
    }
  }

  if (!storedSecret) {
    return (
      <section className="operator-page">
        <PageHeader
          eyebrow="Operaator"
          title="Operaatori töölaud"
          description="Kinnitatud tulemus arvutab edetabeli uuesti. Kasuta ainult lõpliku tulemuse kinnitamiseks."
        />
        <Card title="Operaatori ligipääs" eyebrow="Turvatud sisend" className="operator-panel">
          <form className="operator-form" onSubmit={unlock}>
            <label className="operator-field">
              <span>Operaatori ligipääs</span>
              <input
                autoComplete="off"
                inputMode="text"
                value={secretInput}
                onChange={(event) => setSecretInput(event.target.value)}
                placeholder="Sisesta PIN või saladus"
              />
            </label>
            <button type="submit" className="button-link">Ava töölaud</button>
          </form>
          <p className="operator-copy">Kinnitatud tulemus arvutab edetabeli uuesti. Kasuta ainult lõpliku tulemuse kinnitamiseks.</p>
          {feedback && <p className={`operator-feedback ${feedback.tone}`}>{feedback.message}</p>}
        </Card>
      </section>
    );
  }

  return (
    <section className="operator-page">
      <PageHeader
        eyebrow="Operaator"
        title="Operaatori töölaud"
        description="Kinnitatud tulemus arvutab edetabeli uuesti. Kasuta ainult lõpliku tulemuse kinnitamiseks."
      />

      <section className="operator-grid">
        <Card title="Operaatori ligipääs" eyebrow="Turvatud sisend" className="operator-panel">
          <div className="operator-locked">
            <span className="status-badge good">Ligipääs avatud</span>
            <p className="operator-copy">Sisestatud võti hoitakse ainult seansis ja päisest läheb see ainult kinnitustaotlusele.</p>
          </div>
        </Card>

        <Card title="Mängu valik" eyebrow="Ajakava" className="operator-panel">
          <label className="operator-field">
            <span>Alagrupi mäng</span>
            <select value={String(selectedMatch?.id ?? '')} onChange={(event) => setSelectedMatchId(Number(event.target.value))}>
              {groupStageMatches.map((match) => (
                <option key={match.id} value={match.id}>
                  {formatMatchOption(match, matchStatusById[match.id])}
                </option>
              ))}
            </select>
          </label>

          {selectedMatch && (
            <dl className="operator-match-summary">
              <div><dt>Mängu ID</dt><dd>{selectedMatch.id}</dd></div>
              <div><dt>Kuupäev</dt><dd>{formatTallinnDate(selectedMatch.kickoffAt)}</dd></div>
              <div><dt>Grupp</dt><dd>{selectedMatch.groupId ? `Alagrupp ${selectedMatch.groupId}` : selectedMatch.stage}</dd></div>
              <div><dt>Kodus</dt><dd>{selectedMatch.homeSlot}</dd></div>
              <div><dt>Külaline</dt><dd>{selectedMatch.awaySlot}</dd></div>
              <div><dt>Avalik seis</dt><dd>{selectedPublicStatus}</dd></div>
            </dl>
          )}
        </Card>

        <Card title="Tulemuse kinnitamine" eyebrow="Sisend" className="operator-panel">
          <form className="operator-form" onSubmit={submit}>
            <div className="operator-score-grid">
              <label className="operator-field">
                <span>Kodumeeskonna väravad</span>
                <input type="number" min="0" step="1" value={homeScore} onChange={(event) => setHomeScore(event.target.value)} />
              </label>
              <label className="operator-field">
                <span>Külalismeeskonna väravad</span>
                <input type="number" min="0" step="1" value={awayScore} onChange={(event) => setAwayScore(event.target.value)} />
              </label>
              <label className="operator-field">
                <span>Lahendus</span>
                <select value={decidedAfter} onChange={(event) => setDecidedAfter(event.target.value as DecidedAfter)}>
                  <option value="FT">FT</option>
                  <option value="AET">AET</option>
                  <option value="PEN">PEN</option>
                </select>
              </label>
            </div>

            <label className="operator-field">
              <span>Märkused</span>
              <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} placeholder="Miks tulemus kinnitati" />
            </label>

            <div className="operator-scorer-header">
              <div>
                <strong>Väravalööjad</strong>
                <p>Lisa üks või mitu rida. Tühi rida jäetakse vahele.</p>
              </div>
              <button type="button" className="button-link" onClick={() => setScorers((rows) => [...rows, { ...defaultScorerRow }])}>
                Lisa rida
              </button>
            </div>

            <div className="operator-scorer-list">
              {scorers.map((scorer, index) => (
                <div className="operator-scorer-row" key={`${index}-${scorer.playerName}-${scorer.teamCode}-${scorer.teamName}`}>
                  <label className="operator-field">
                    <span>Mängija</span>
                    <input value={scorer.playerName} onChange={(event) => updateScorer(index, 'playerName', event.target.value, setScorers)} placeholder="Mängija nimi" />
                  </label>
                  <label className="operator-field">
                    <span>Võistkond</span>
                    <input value={scorer.teamName} onChange={(event) => updateScorer(index, 'teamName', event.target.value, setScorers)} placeholder="Mehhiko" />
                  </label>
                  <label className="operator-field">
                    <span>Kood</span>
                    <input value={scorer.teamCode} onChange={(event) => updateScorer(index, 'teamCode', event.target.value, setScorers)} placeholder="MEX" />
                  </label>
                  <label className="operator-field">
                    <span>Väravaid</span>
                    <input type="number" min="1" step="1" value={scorer.goals} onChange={(event) => updateScorer(index, 'goals', event.target.value, setScorers)} />
                  </label>
                  <button
                    type="button"
                    className="button-link operator-remove"
                    onClick={() => setScorers((rows) => rows.length > 1 ? rows.filter((_, rowIndex) => rowIndex !== index) : rows)}
                    aria-label={`Eemalda lööja rida ${index + 1}`}
                  >
                    Eemalda
                  </button>
                </div>
              ))}
            </div>

            <button type="submit" className="button-link" disabled={submitState === 'submitting'}>
              {submitState === 'submitting' ? 'Kinnitan...' : 'Kinnita tulemus'}
            </button>
          </form>
        </Card>

        <Card title="Seis" eyebrow="Tagasiside" className="operator-panel">
          <p className="operator-copy">Kinnitatud tulemus arvutab edetabeli uuesti. Kasuta ainult lõpliku tulemuse kinnitamiseks.</p>
          {feedback ? <p className={`operator-feedback ${feedback.tone}`}>{feedback.message}</p> : <p className="operator-copy">Oota kinnituse tulemust või ava uus seanss, kui ligipääs aegus.</p>}
        </Card>
      </section>
    </section>
  );
}

function buildPublicStatusMap(snapshot?: PublicDashboardSnapshot): Record<string, string> {
  const map: Record<string, string> = {};
  for (const result of snapshot?.latestResults ?? []) map[result.id] = 'CONFIRMED_FINAL';
  for (const match of snapshot?.upcomingMatches ?? []) map[match.id] = match.status === 'live' ? 'LIVE' : match.status === 'confirming' ? 'CONFIRMING' : 'SCHEDULED';
  return map;
}

function buildScorersPayload(rows: ScorerRow[]): Array<{ playerName: string; teamName?: string; teamCode?: string; goals: number }> | undefined {
  const payload = rows.flatMap((row) => {
    const playerName = row.playerName.trim();
    const teamName = row.teamName.trim();
    const teamCode = row.teamCode.trim();
    const goals = Number(row.goals || '1');
    if (!playerName && !teamName && !teamCode) return [];
    if (!playerName || (!teamName && !teamCode) || !Number.isInteger(goals) || goals <= 0) {
      throw new Error('Täida väravalööja nimi ja võistkond enne esitamist.');
    }
    return [{ playerName, teamName: teamName || undefined, teamCode: teamCode || undefined, goals }];
  });
  return payload.length > 0 ? payload : undefined;
}

function readStoredSecret(): string {
  if (typeof window === 'undefined') return '';
  return window.sessionStorage.getItem(SECRET_STORAGE_KEY) ?? '';
}

function persistSecret(secret: string): void {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(SECRET_STORAGE_KEY, secret);
}

function formatMatchOption(match: SeedMatch, publicStatus?: string): string {
  return `#${match.id} ${formatTallinnDate(match.kickoffAt)} ${match.homeSlot} - ${match.awaySlot}${publicStatus ? ` · ${publicStatus}` : ''}`;
}

function formatTallinnDate(value: string): string {
  return new Intl.DateTimeFormat('et-EE', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Tallinn'
  }).format(new Date(value)).replace(/\.$/, '');
}

async function safeJson(response: Response): Promise<Record<string, unknown> | undefined> {
  try {
    return await response.json() as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

function updateScorer<K extends keyof ScorerRow>(index: number, key: K, value: string, setRows: Dispatch<SetStateAction<ScorerRow[]>>) {
  setRows((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, [key]: value } : row));
}

const groupStageMatches = (matchesSeed as SeedMatch[]).filter((match) => match.stage === 'GROUP');
