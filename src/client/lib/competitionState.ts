export type CompetitionState = 'predictions_open' | 'predictions_locked_before_tournament' | 'tournament_live' | 'tournament_finished';
export type PlayerView = 'predict' | 'bonus' | 'results' | 'leaderboard' | 'details' | 'rules' | 'admin';

export function deriveCompetitionState(state: any, nowMs = Date.now()): CompetitionState {
  if (!state?.competition) return 'predictions_open';
  const matches = Array.isArray(state?.matches) ? state.matches : [];
  const results = Array.isArray(state?.results) ? state.results : [];
  const deadlineMs = new Date(state?.competition?.prediction_deadline ?? '').getTime();
  const locked = Number(state?.competition?.predictions_locked ?? 0) === 1 || Number.isNaN(deadlineMs) || nowMs > deadlineMs;
  if (matches.length > 0 && results.length >= matches.length) return 'tournament_finished';
  if (results.length > 0) return 'tournament_live';
  return locked ? 'predictions_locked_before_tournament' : 'predictions_open';
}

export function defaultPlayerView(competitionState: CompetitionState): PlayerView {
  return competitionState === 'predictions_open' ? 'predict' : 'results';
}

export function landingPrimaryLabel(competitionState: CompetitionState, hasPlayer: boolean): string {
  if (competitionState === 'predictions_open') return 'Mine ennustama';
  if (competitionState === 'predictions_locked_before_tournament') return hasPlayer ? 'Vaata oma ennustusi' : 'Vaata ülevaadet';
  if (competitionState === 'tournament_finished') return 'Vaata lõpptulemusi';
  return 'Vaata tulemusi';
}

export function competitionStateLabel(competitionState: CompetitionState): string {
  return {
    predictions_open: 'Ennustused on avatud',
    predictions_locked_before_tournament: 'Ennustused on lukus, turniir pole alanud',
    tournament_live: 'Turniir käib',
    tournament_finished: 'Turniir on lõppenud'
  }[competitionState];
}
