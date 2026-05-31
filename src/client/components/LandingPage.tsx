import { DeadlineBanner } from './DeadlineBanner.js';
import { competitionStateLabel, landingPrimaryLabel, type CompetitionState } from '../lib/competitionState.js';

export function LandingPage({ state, player, competitionState, onPrimary, onRules }: { state: any; player: any; competitionState: CompetitionState; onPrimary: () => void; onRules: () => void }) {
  const locked = competitionState !== 'predictions_open';
  return (
    <main className="landing">
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">MM 2026 LIIGA</p>
          <h1>Sõprade jalgpalliennustus 2026</h1>
          <p className="hero-lead">Ennusta mängude tulemused, kogu punkte ja vaata, kes tunneb jalgpalli kõige paremini.</p>
          {state && <DeadlineBanner deadline={state.competition.prediction_deadline} locked={locked} />}
          {player && <p className="landing-status">{playerStateLine(state, player)}</p>}
          <div className="hero-actions">
            <button onClick={onPrimary}>{landingPrimaryLabel(competitionState, Boolean(player))}</button>
            <button className="ghost" onClick={onRules}>Reeglid</button>
          </div>
        </div>
        <div className="hero-visual" aria-hidden="true">
          <div className="pitch-card">
            <span>12 alagruppi</span>
            <strong>104 mängu</strong>
            <small>{competitionStateLabel(competitionState)}</small>
          </div>
        </div>
      </section>
    </main>
  );
}

function playerStateLine(state: any, player: any): string {
  const current = state?.currentPlayer;
  if (current?.status === 'pending') return 'Sinu osalus ootab korraldaja kinnitust.';
  if (current?.status === 'approved') return 'Osalus on kinnitatud. Ennustused ja punktid on seotud selle brauseriga.';
  if (current?.status === 'disabled') return 'Sinu osalus ei ole hetkel ametlikus arvestuses.';
  return `${player.name} on selles brauseris valitud osaleja.`;
}
