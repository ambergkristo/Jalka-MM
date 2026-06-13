import { useEffect, useMemo, useState, type Dispatch, type FormEvent, type SetStateAction } from 'react';
import matchesSeed from '../../data/worldcup2026/matches.json' with { type: 'json' };
import teamsSeed from '../../data/worldcup2026/teams.json' with { type: 'json' };
import { TeamBadge } from '../components/TeamBadge.js';
import { Card } from '../components/Card.js';
import { PageHeader } from '../components/PageHeader.js';
import { StatusBadge } from '../components/StatusBadge.js';
import type { PublicDashboardSnapshot } from '../lib/publicApi.js';

type SeedMatch = (typeof matchesSeed)[number];
type SeedTeam = (typeof teamsSeed)[number];
type DecidedAfter = 'FT' | 'AET' | 'PEN';
type MatchFilter = 'nearest' | 'all' | 'confirmed';

interface ScorerRow {
  playerName: string;
  teamCode: string;
  goals: string;
}

interface OperatorMatch {
  id: number;
  kickoffAt: string;
  stageLabel: string;
  groupLabel: string;
  homeTeam: SeedTeam | undefined;
  awayTeam: SeedTeam | undefined;
  publicStatus: string;
  confirmedHomeScore?: number;
  confirmedAwayScore?: number;
  isConfirmed: boolean;
}

interface ManualConfirmResult {
  auditId?: string;
  error?: string;
}

interface ManualConfirmResponse {
  ok: boolean;
  status: number;
  body?: ManualConfirmResult;
  authFailed: boolean;
}

type RepairAction = 'catch-up' | 'rebuild-public-dashboard' | 'rebuild-group-standings' | 'rebuild-leaderboard' | 'rebuild-top-scorers' | 'resync-scorers-from-confirmed-results';

interface PublicStateDiagnostics {
  generatedAt: string;
  serverTime: string;
  resultAgentStatus: {
    lastRunAt?: string;
    nextSuggestedRunAt?: string;
    staleMatchesCount: number;
    provider: string;
    mode: 'mock' | 'live';
    lastLeaderboardRebuildAt?: string;
    providerChain?: string[];
    writeMode?: 'mock' | 'dry-run' | 'live';
    providerReachable?: boolean;
    pendingWarningsCount?: number;
    latestConfirmedResultCount?: number;
    lastRunWarnings?: Array<{
      internalMatchId: number;
      providerFixtureId?: string;
      homeTeam: string;
      awayTeam: string;
      kickoffAt: string;
      providerStatus: string;
      normalizedStatus: string;
      providerScore?: string;
      reason: string;
      action: 'confirmed' | 'pending-confirmation' | 'needs-review' | 'skipped';
    }>;
    lastRunSummary?: {
      startedAt: string;
      finishedAt: string;
      checkedMatches: number;
      updatedMatches: number;
      finalizedMatches: number;
      dryRun: boolean;
      warningsCount: number;
    };
  };
  confirmedResultsCount: number;
  confirmedGoalsCount: number;
  liveMatchesCount: number;
  latestResultsCount: number;
  groupStandingsSource: string;
  groupStandingsRowsCount: number;
  topScorerRowsCount: number;
  leaderboardRowsCount: number;
  canonicalLeaderboardRowsCount: number;
  scorerFactsCount: number;
  topScorerCacheRowsCount: number;
  leaderboardCacheRowsCount: number;
  lastResultSyncAt?: string;
  lastPublicDashboardReadAt?: string;
  lastPublicSnapshotRebuildAt?: string;
  lastScorerRebuildAt?: string;
  lastProviderCheckAt?: string;
  lastLeaderboardRebuildAt?: string;
  providerScorerDataDetected?: 'yes' | 'no' | 'unknown';
  lastRepairAction?: RepairAction;
  lastRepairActionAt?: string;
  lastRepairActionStatus?: 'ok' | 'failed';
  lastRepairActionError?: string;
  staleState: boolean;
  staleReasons: string[];
  operatorStatus: 'OK' | 'Needs sync' | 'Running' | 'Failed';
}

const SECRET_STORAGE_KEY = 'jalka-mm-operator-secret';
const EMPTY_SCORER_ROW: ScorerRow = { playerName: '', teamCode: '', goals: '1' };
const teamById = new Map(teamsSeed.map((team) => [team.id, team]));
const allMatches = matchesSeed.map((match) => toOperatorMatch(match, undefined));

export function OperatorPage() {
  const [storedSecret, setStoredSecret] = useState<string>(() => readStoredSecret());
  const [unlockInput, setUnlockInput] = useState('');
  const [matchFilter, setMatchFilter] = useState<MatchFilter>('nearest');
  const [selectedMatchId, setSelectedMatchId] = useState<number>(allMatches[0]?.id ?? 1);
  const [homeScore, setHomeScore] = useState('0');
  const [awayScore, setAwayScore] = useState('0');
  const [decidedAfter, setDecidedAfter] = useState<DecidedAfter>('FT');
  const [notes, setNotes] = useState('');
  const [scorers, setScorers] = useState<ScorerRow[]>([EMPTY_SCORER_ROW]);
  const [feedback, setFeedback] = useState<FeedbackState | undefined>();
  const [submitState, setSubmitState] = useState<'idle' | 'submitting'>('idle');
  const [snapshot, setSnapshot] = useState<PublicDashboardSnapshot | undefined>();
  const [diagnostics, setDiagnostics] = useState<PublicStateDiagnostics | undefined>();
  const [repairState, setRepairState] = useState<{ action?: RepairAction; status: 'idle' | 'running' | 'ok' | 'failed'; message?: string }>({ status: 'idle' });
  const [refreshIndex, setRefreshIndex] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const load = async () => {
      try {
        const [dashboardResponse, diagnosticsResponse] = await Promise.all([
          fetch('/api/public-dashboard', { cache: 'no-store', signal: controller.signal }),
          fetch('/api/public-state/diagnostics', { cache: 'no-store', signal: controller.signal })
        ]);
        if (!cancelled && dashboardResponse.ok) {
          setSnapshot(await dashboardResponse.json() as PublicDashboardSnapshot);
        }
        if (!cancelled && diagnosticsResponse.ok) {
          setDiagnostics(await diagnosticsResponse.json() as PublicStateDiagnostics);
        }
      } catch {
        return undefined;
      }
    };

    void load();
    const interval = window.setInterval(() => {
      void load();
    }, 60_000);
    return () => {
      cancelled = true;
      controller.abort();
      window.clearInterval(interval);
    };
  }, [refreshIndex]);

  const publicMatchState = useMemo(() => buildPublicMatchState(snapshot), [snapshot]);
  const matches = useMemo(() => buildOperatorMatches(publicMatchState), [publicMatchState]);
  const visibleMatches = useMemo(() => filterOperatorMatches(matches, matchFilter), [matches, matchFilter]);
  const selectedMatch = matches.find((match) => match.id === selectedMatchId) ?? matches[0];
  const selectedMatchTeamOptions = selectedMatch ? [selectedMatch.homeTeam, selectedMatch.awayTeam].filter(Boolean) as SeedTeam[] : [];
  const statusLabel = classifyOperatorStatus(diagnostics, repairState.status);
  const statusTone = statusToneForLabel(statusLabel);
  const submitLabel = selectedMatch?.isConfirmed ? 'Salvesta parandus' : 'Kinnita tulemus';

  useEffect(() => {
    if (!selectedMatch) return;
    setHomeScore(String(selectedMatch.confirmedHomeScore ?? 0));
    setAwayScore(String(selectedMatch.confirmedAwayScore ?? 0));
    setDecidedAfter('FT');
    setNotes('');
    setScorers([EMPTY_SCORER_ROW]);
  }, [selectedMatchId, selectedMatch?.confirmedHomeScore, selectedMatch?.confirmedAwayScore]);

  async function unlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextSecret = unlockInput.trim();
    if (!nextSecret) {
      setFeedback({ tone: 'danger', message: 'Sisesta operaatori kood.' });
      return;
    }
    persistSecret(nextSecret);
    setStoredSecret(nextSecret);
    setUnlockInput('');
    setFeedback({ tone: 'good', message: 'Operaatori vaade avatud.' });
  }

  function logout() {
    clearStoredSecret();
    setStoredSecret('');
    setFeedback(undefined);
  }

  async function runRepair(action: RepairAction) {
    if (!storedSecret) {
      setFeedback({ tone: 'danger', message: 'Vale operaatori kood.' });
      return;
    }
    setRepairState({ action, status: 'running', message: 'Töötan...' });
    try {
      const response = await fetch('/api/public-state/repair', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-results-agent-secret': storedSecret
        },
        body: JSON.stringify({ action })
      });
      const body = await safeJson(response);
      if (response.status === 401 || response.status === 403) {
        clearStoredSecret();
        setStoredSecret('');
        setRepairState({ action, status: 'failed', message: 'Vale operaatori kood.' });
        setFeedback({ tone: 'danger', message: 'Vale operaatori kood.' });
        return;
      }
      if (!response.ok) {
        throw new Error((body as { error?: string } | undefined)?.error ?? 'Tõrge paranduse käivitamisel.');
      }
      const message = (body as { message?: string } | undefined)?.message ?? 'Parandus lõpetatud.';
      setRepairState({ action, status: 'ok', message });
      setFeedback({ tone: 'good', message });
      setRefreshIndex((value) => value + 1);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Tõrge paranduse käivitamisel.';
      setRepairState({ action, status: 'failed', message });
      setFeedback({ tone: 'danger', message: classifyError(message) });
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!storedSecret) {
      setFeedback({ tone: 'danger', message: 'Vale operaatori kood.' });
      return;
    }
    if (!selectedMatch) {
      setFeedback({ tone: 'danger', message: 'Mängu ei leitud.' });
      return;
    }

    let payloadScorers: ManualConfirmPayload['scorers'];
    try {
      payloadScorers = buildScorersPayload(scorers, selectedMatch);
      const home = parseScore(homeScore);
      const away = parseScore(awayScore);
      setSubmitState('submitting');
      setFeedback(undefined);

      const result = await postManualConfirm({
        secret: storedSecret,
        payload: {
          matchId: selectedMatch.id,
          homeScore: home,
          awayScore: away,
          decidedAfter,
          source: 'manual-ui',
          confirmedBy: 'operator-ui',
          notes: notes.trim() || undefined,
          scorers: payloadScorers
        }
      });

      if (result.authFailed) {
        clearStoredSecret();
        setStoredSecret('');
        setFeedback({ tone: 'danger', message: 'Vale operaatori kood.' });
        return;
      }

      if (!result.ok) {
        throw new Error(result.body?.error ?? 'Tulemust ei saanud salvestada.');
      }

      setFeedback({
        tone: 'good',
        message: 'Tulemus kinnitatud. Edetabel uuendatud. Grupitabel uuendatud. Väravalööjad uuendatud.'
      });
      setRefreshIndex((value) => value + 1);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Tulemust ei saanud salvestada.';
      setFeedback({ tone: 'danger', message: classifyError(message) });
    } finally {
      setSubmitState('idle');
    }
  }

  if (!storedSecret) {
    return (
      <section className="operator-page">
        <PageHeader eyebrow="Operaator" title="Operaator" description="Sisesta lõplik tulemus ainult siis, kui tulemus on kinnitatud. Kinnitamine arvutab edetabeli uuesti." />
        <Card title="Operaatori ligipääs" eyebrow="Turvatud sisend" className="operator-panel">
          <form className="operator-form" onSubmit={unlock}>
            <label className="operator-field">
              <span>Sisesta operaatori kood</span>
              <input
                autoComplete="off"
                inputMode="text"
                value={unlockInput}
                onChange={(event) => setUnlockInput(event.target.value)}
                placeholder="Operaatori kood"
              />
            </label>
            <button type="submit" className="button-link">Ava operaatori vaade</button>
          </form>
          <p className="operator-copy">Sisesta lõplik tulemus ainult siis, kui tulemus on kinnitatud. Kinnitamine arvutab edetabeli uuesti.</p>
          {feedback && <p className={`operator-feedback ${feedback.tone}`}>{feedback.message}</p>}
        </Card>
      </section>
    );
  }

  return (
    <section className="operator-page">
      <PageHeader eyebrow="Operaator" title="Operaator" description="Sisesta lõplik tulemus ainult siis, kui tulemus on kinnitatud. Kinnitamine arvutab edetabeli uuesti." />

      <section className="operator-grid">
        <Card title="Operaatori ligipääs" eyebrow="Turvatud sisend" className="operator-panel">
          <div className="operator-locked">
            <span className="status-badge good">Ligipääs avatud</span>
            <div className="operator-auth-actions">
              <p className="operator-copy">Salvestatud kood hoitakse ainult selles seadmes lokaalselt.</p>
              <button type="button" className="button-link" onClick={logout}>Logi operaatorist välja</button>
            </div>
          </div>
        </Card>

        <Card title="Seisund" eyebrow="Diagnostika" className="operator-panel">
          <div className="operator-health">
            <div className="operator-health-topline">
              <StatusBadge value={repairState.status === 'running' ? 'Running' : statusLabel} tone={statusToneForLabel(repairState.status === 'running' ? 'Running' : statusLabel)} />
              {diagnostics?.resultAgentStatus.writeMode && <span className="operator-copy">Write mode: {diagnostics.resultAgentStatus.writeMode}</span>}
            </div>
            <div className="operator-health-grid">
              <div><span>Result-agent</span><strong>{diagnostics?.resultAgentStatus.writeMode === 'live' ? 'Live' : diagnostics?.resultAgentStatus.writeMode === 'dry-run' ? 'Dry run' : 'Mock'}</strong></div>
              <div><span>Viimane provideri kontroll</span><strong>{formatTimestamp(diagnostics?.lastProviderCheckAt ?? diagnostics?.resultAgentStatus.lastRunAt)}</strong></div>
              <div><span>Viimane result sync</span><strong>{formatTimestamp(diagnostics?.lastResultSyncAt)}</strong></div>
              <div><span>Viimane snapshot rebuild</span><strong>{formatTimestamp(diagnostics?.lastPublicSnapshotRebuildAt)}</strong></div>
              <div><span>Kinnitatud tulemused</span><strong>{diagnostics?.confirmedResultsCount ?? 0}</strong></div>
              <div><span>Kinnitatud väravad</span><strong>{diagnostics?.confirmedGoalsCount ?? 0}</strong></div>
              <div><span>Live mänge</span><strong>{diagnostics?.liveMatchesCount ?? 0}</strong></div>
              <div><span>Viimaseid tulemusi</span><strong>{diagnostics?.latestResultsCount ?? 0}</strong></div>
              <div><span>Scorer facts</span><strong>{diagnostics?.scorerFactsCount ?? 0}</strong></div>
              <div><span>Top scorer ridu</span><strong>{diagnostics?.topScorerRowsCount ?? 0}</strong></div>
              <div><span>Leaderboard ridu</span><strong>{diagnostics?.leaderboardRowsCount ?? 0}</strong></div>
              <div><span>Top scorer rebuild</span><strong>{formatTimestamp(diagnostics?.lastScorerRebuildAt)}</strong></div>
              <div><span>Provider scorer data</span><strong>{diagnostics?.providerScorerDataDetected ?? 'unknown'}</strong></div>
            </div>
            {diagnostics?.staleReasons?.length ? <ul className="operator-health-list">{diagnostics.staleReasons.map((reason) => <li key={reason}>{reason}</li>)}</ul> : null}
          </div>
        </Card>

        <Card title="Parandused" eyebrow="Turvalised toimingud" className="operator-panel">
          <div className="operator-repair-actions">
            {REPAIR_ACTIONS.map((action) => (
              <button
                key={action.action}
                type="button"
                className="button-link"
                onClick={() => void runRepair(action.action)}
                disabled={repairState.status === 'running'}
              >
                {action.label}
              </button>
            ))}
          </div>
          <p className="operator-copy">Need toimingud kasutavad ainult kinnitatud tulemusi ja olemasolevaid scorer faktisid.</p>
          {repairState.message ? <p className={`operator-feedback ${repairState.status === 'failed' ? 'danger' : repairState.status === 'running' ? 'gold' : 'good'}`}>{repairState.message}</p> : null}
        </Card>

        <Card title="Match filter" eyebrow="Valik" className="operator-panel">
          <div className="operator-filter-bar" role="tablist" aria-label="Mängude filter">
            {FILTER_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`operator-filter ${matchFilter === option.value ? 'active' : ''}`}
                onClick={() => setMatchFilter(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </Card>

        <Card title="Match list" eyebrow="Mängud" className="operator-panel">
          <div className="operator-match-list">
            {visibleMatches.map((match) => (
              <button
                key={match.id}
                type="button"
                className={`operator-match-card ${selectedMatch?.id === match.id ? 'active' : ''}`}
                onClick={() => setSelectedMatchId(match.id)}
              >
                <div className="operator-match-card-topline">
                  <strong>#{match.id}</strong>
                  <span>{match.stageLabel}</span>
                </div>
                <small>{formatTallinnDate(match.kickoffAt)}</small>
                <div className="operator-match-teams">
                  <TeamBadge team={match.homeTeam} />
                  <span className="operator-match-vs">vs</span>
                  <TeamBadge team={match.awayTeam} align="right" />
                </div>
                <div className="operator-match-meta">
                  <span className={`status-badge ${match.isConfirmed ? 'good' : 'gold'}`}>{match.publicStatus}</span>
                  {match.isConfirmed && <span className="operator-score-pill">{match.confirmedHomeScore}-{match.confirmedAwayScore}</span>}
                  <span className="operator-match-action">{match.isConfirmed ? 'Muuda tulemust' : 'Lisa tulemus'}</span>
                </div>
              </button>
            ))}
          </div>
        </Card>

        <Card title="Result form" eyebrow="Sisend" className="operator-panel">
          {selectedMatch ? (
            <form className="operator-form" onSubmit={submit}>
              <div className="operator-selected-summary">
                <div>
                  <span>Mängu ID</span>
                  <strong>{selectedMatch.id}</strong>
                </div>
                <div>
                  <span>Seis</span>
                  <strong>{selectedMatch.publicStatus}</strong>
                </div>
                <div>
                  <span>Rühm / etapp</span>
                  <strong>{selectedMatch.groupLabel}</strong>
                </div>
              </div>

              <div className="operator-score-grid">
                <label className="operator-field">
                  <span>{selectedMatch.homeTeam?.nameEt ?? selectedMatch.homeTeam?.name ?? 'Kodumeeskond'}</span>
                  <input type="number" min="0" step="1" value={homeScore} onChange={(event) => setHomeScore(event.target.value)} />
                </label>
                <label className="operator-field">
                  <span>{selectedMatch.awayTeam?.nameEt ?? selectedMatch.awayTeam?.name ?? 'Külaline'}</span>
                  <input type="number" min="0" step="1" value={awayScore} onChange={(event) => setAwayScore(event.target.value)} />
                </label>
                <label className="operator-field">
                  <span>Mäng lõppes</span>
                  <select value={decidedAfter} onChange={(event) => setDecidedAfter(event.target.value as DecidedAfter)}>
                    <option value="FT">FT / Normaalaeg</option>
                    <option value="AET">AET / Lisaaeg</option>
                    <option value="PEN">PEN / Penaltid</option>
                  </select>
                </label>
              </div>

              <label className="operator-field">
                <span>Märkus</span>
                <input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Valikuline märkus" />
              </label>

              <section className="operator-scorer-section">
                <div className="operator-scorer-header">
                  <div>
                    <strong>Väravalööjad</strong>
                    <p>Lisa üks või mitu lööjat. Tühi loend on lubatud.</p>
                  </div>
                  <button type="button" className="button-link" onClick={() => setScorers((rows) => appendScorerRow(rows))}>
                    + Lisa väravalööja
                  </button>
                </div>

                <div className="operator-scorer-list">
                  {scorers.map((scorer, index) => (
                    <div className="operator-scorer-row" key={`${index}-${scorer.playerName}-${scorer.teamCode}`}>
                      <label className="operator-field">
                        <span>Võistkond</span>
                        <select value={scorer.teamCode} onChange={(event) => updateScorer(index, 'teamCode', event.target.value, setScorers)}>
                          <option value="">Vali võistkond</option>
                          {selectedMatchTeamOptions.map((team) => (
                            <option key={team.id} value={team.code ?? ''}>
                              {team.nameEt ?? team.name ?? team.code}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="operator-field">
                        <span>Mängija</span>
                        <input value={scorer.playerName} onChange={(event) => updateScorer(index, 'playerName', event.target.value, setScorers)} placeholder="Mängija nimi" />
                      </label>
                      <label className="operator-field">
                        <span>Väravad</span>
                        <input type="number" min="1" step="1" value={scorer.goals} onChange={(event) => updateScorer(index, 'goals', event.target.value, setScorers)} />
                      </label>
                      <button type="button" className="operator-remove" onClick={() => setScorers((rows) => removeScorerRow(rows, index))}>
                        Eemalda
                      </button>
                    </div>
                  ))}
                </div>
              </section>

              <button type="submit" className="button-link" disabled={submitState === 'submitting'}>
                {submitState === 'submitting' ? 'Salvestan...' : submitLabel}
              </button>
            </form>
          ) : (
            <p className="operator-copy">Mängu ei leitud.</p>
          )}
        </Card>

        <Card title="Confirmation" eyebrow="Tagasiside" className="operator-panel">
          <p className="operator-copy">Sisesta lõplik tulemus ainult siis, kui tulemus on kinnitatud. Kinnitamine arvutab edetabeli uuesti.</p>
          {feedback ? <p className={`operator-feedback ${feedback.tone}`}>{feedback.message}</p> : <p className="operator-copy">Vali mäng ja kinnita tulemus, kui kõik andmed on kontrollitud.</p>}
        </Card>
      </section>
    </section>
  );
}

function buildPublicMatchState(snapshot?: PublicDashboardSnapshot): Map<string, { publicStatus: string; confirmedHomeScore?: number; confirmedAwayScore?: number }> {
  const map = new Map<string, { publicStatus: string; confirmedHomeScore?: number; confirmedAwayScore?: number }>();
  for (const match of snapshot?.upcomingMatches ?? []) {
    map.set(match.id, {
      publicStatus: match.status === 'live' ? 'LIVE' : match.status === 'confirming' ? 'CONFIRMING' : 'SCHEDULED'
    });
  }
  for (const result of snapshot?.latestResults ?? []) {
    map.set(result.id, {
      publicStatus: 'CONFIRMED_FINAL',
      confirmedHomeScore: result.homeScore,
      confirmedAwayScore: result.awayScore
    });
  }
  return map;
}

function buildOperatorMatches(publicMatchState: Map<string, { publicStatus: string; confirmedHomeScore?: number; confirmedAwayScore?: number }>): OperatorMatch[] {
  return matchesSeed.map((match) => {
    const publicState = publicMatchState.get(String(match.id)) ?? { publicStatus: 'SCHEDULED' };
    return toOperatorMatch(match, publicState);
  }).sort((left, right) => Date.parse(left.kickoffAt) - Date.parse(right.kickoffAt) || left.id - right.id);
}

function toOperatorMatch(match: SeedMatch, publicState?: { publicStatus: string; confirmedHomeScore?: number; confirmedAwayScore?: number }): OperatorMatch {
  const homeTeam = teamById.get(match.homeTeamId);
  const awayTeam = teamById.get(match.awayTeamId);
  return {
    id: match.id,
    kickoffAt: match.kickoffAt,
    stageLabel: stageLabel(match.stage),
    groupLabel: match.groupId ? `Alagrupp ${match.groupId}` : stageLabel(match.stage),
    homeTeam,
    awayTeam,
    publicStatus: publicState?.publicStatus ?? 'SCHEDULED',
    confirmedHomeScore: publicState?.confirmedHomeScore,
    confirmedAwayScore: publicState?.confirmedAwayScore,
    isConfirmed: publicState?.publicStatus === 'CONFIRMED_FINAL'
  };
}

function filterOperatorMatches(matches: OperatorMatch[], filter: MatchFilter): OperatorMatch[] {
  const sorted = [...matches].sort((left, right) => Date.parse(left.kickoffAt) - Date.parse(right.kickoffAt) || left.id - right.id);
  if (filter === 'all') return sorted;
  if (filter === 'confirmed') return sorted.filter((match) => match.isConfirmed);
  const now = Date.now();
  return sorted.filter((match) => Date.parse(match.kickoffAt) >= now - 1000 * 60 * 60 * 12).slice(0, 12);
}

function buildScorersPayload(rows: ScorerRow[], selectedMatch: OperatorMatch): ManualConfirmPayload['scorers'] | undefined {
  const payload = rows.flatMap((row) => {
    const playerName = row.playerName.trim();
    const teamCode = row.teamCode.trim();
    const goals = Number(row.goals);
    if (!playerName && !teamCode && !row.goals.trim()) return [];
    if (!playerName) throw new Error('Sisesta väravalööja nimi.');
    if (!teamCode) throw new Error('Vali võistkond.');
    if (!Number.isInteger(goals) || goals <= 0) throw new Error('Väravate arv peab olema positiivne täisarv.');
    const team = [selectedMatch.homeTeam, selectedMatch.awayTeam].find((candidate) => candidate?.code === teamCode);
    if (!team) throw new Error('Vali võistkond.');
    return [{
      playerName,
      teamName: team.nameEt ?? team.name,
      teamCode: team.code,
      goals
    }];
  });
  return payload.length > 0 ? payload : undefined;
}

function appendScorerRow(rows: ScorerRow[]): ScorerRow[] {
  return [...rows, { ...EMPTY_SCORER_ROW }];
}

function removeScorerRow(rows: ScorerRow[], index: number): ScorerRow[] {
  if (rows.length <= 1) return [{ ...EMPTY_SCORER_ROW }];
  return rows.filter((_, rowIndex) => rowIndex !== index);
}

function parseScore(value: string): number {
  const score = Number(value);
  if (!Number.isInteger(score) || score < 0) throw new Error('Kontrolli skoori ja proovi uuesti.');
  return score;
}

function classifyError(message: string): string {
  if (/does not exist|not found|Mängu ei leitud/i.test(message)) return 'Mängu ei leitud.';
  if (/score|värav|skoor/i.test(message)) return 'Kontrolli skoori ja proovi uuesti.';
  if (/secret|kod|operaator/i.test(message)) return 'Vale operaatori kood.';
  return 'Tulemust ei saanud salvestada.';
}

async function postManualConfirm(input: {
  secret: string;
  payload: ManualConfirmPayload;
  fetchImpl?: typeof fetch;
}): Promise<ManualConfirmResponse> {
  const fetchFn = input.fetchImpl ?? fetch;
  const response = await fetchFn('/api/results-agent/manual-confirm', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-results-agent-secret': input.secret
    },
    body: JSON.stringify(input.payload)
  });
  const body = await safeJson(response);
  if (response.status === 401 || response.status === 403) {
    return { ok: false, status: response.status, body: body as ManualConfirmResult | undefined, authFailed: true };
  }
  return { ok: response.ok, status: response.status, body: body as ManualConfirmResult | undefined, authFailed: false };
}

function safeJson(response: Response): Promise<Record<string, unknown> | undefined> {
  return response.json().then((data) => data as Record<string, unknown>).catch(() => undefined);
}

function readStoredSecret(): string {
  if (typeof window === 'undefined') return '';
  return window.localStorage.getItem(SECRET_STORAGE_KEY) ?? '';
}

function persistSecret(secret: string): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(SECRET_STORAGE_KEY, secret);
}

function clearStoredSecret(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(SECRET_STORAGE_KEY);
}

function updateScorer<K extends keyof ScorerRow>(index: number, key: K, value: string, setRows: Dispatch<SetStateAction<ScorerRow[]>>) {
  setRows((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, [key]: value } : row));
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

function stageLabel(stage: SeedMatch['stage']): string {
  return ({
    GROUP: 'Alagrupp',
    R32: '1/16-finaal',
    R16: '1/8-finaal',
    QF: 'Veerandfinaal',
    SF: 'Poolfinaal',
    THIRD_PLACE: '3. koha mäng',
    FINAL: 'Finaal'
  } as Record<SeedMatch['stage'], string>)[stage] ?? stage;
}

const REPAIR_ACTIONS: Array<{ action: RepairAction; label: string }> = [
  { action: 'catch-up', label: 'Run result-agent catch-up now' },
  { action: 'rebuild-public-dashboard', label: 'Rebuild public dashboard state now' },
  { action: 'rebuild-group-standings', label: 'Rebuild group standings now' },
  { action: 'rebuild-leaderboard', label: 'Rebuild leaderboard now' },
  { action: 'rebuild-top-scorers', label: 'Rebuild top scorer standings now' },
  { action: 'resync-scorers-from-confirmed-results', label: 'Re-sync scorers from confirmed provider results' }
];

function formatTimestamp(value?: string): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('et-EE', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'Europe/Tallinn'
  }).format(date);
}

function classifyOperatorStatus(
  diagnostics: PublicStateDiagnostics | undefined,
  repairStatus: 'idle' | 'running' | 'ok' | 'failed'
): 'OK' | 'Needs sync' | 'Running' | 'Failed' {
  if (repairStatus === 'running') return 'Running';
  return diagnostics?.operatorStatus ?? 'OK';
}

function statusToneForLabel(label: 'OK' | 'Needs sync' | 'Running' | 'Failed'): 'good' | 'blue' | 'gold' | 'danger' {
  if (label === 'OK') return 'good';
  if (label === 'Needs sync') return 'gold';
  if (label === 'Running') return 'blue';
  return 'danger';
}

const FILTER_OPTIONS: Array<{ value: MatchFilter; label: string }> = [
  { value: 'nearest', label: 'Lähimad mängud' },
  { value: 'all', label: 'Kõik mängud' },
  { value: 'confirmed', label: 'Kinnitatud' }
];

interface FeedbackState {
  tone: 'good' | 'danger' | 'gold';
  message: string;
}

export interface ManualConfirmPayload {
  matchId: number;
  homeScore: number;
  awayScore: number;
  decidedAfter: DecidedAfter;
  source: string;
  confirmedBy: string;
  notes?: string;
  scorers?: Array<{
    playerName: string;
    teamName?: string;
    teamCode?: string;
    goals: number;
  }>;
}

export {
  appendScorerRow,
  buildScorersPayload,
  clearStoredSecret,
  classifyError,
  filterOperatorMatches,
  parseScore,
  persistSecret,
  postManualConfirm,
  readStoredSecret,
  removeScorerRow,
  stageLabel
};
