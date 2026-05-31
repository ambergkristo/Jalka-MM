import { useEffect, useState } from 'react';
import { formatCountdown, getDeadlineState } from '../lib/deadline.js';

export function DeadlineBanner({ deadline, locked }: { deadline: unknown; locked: boolean }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  const state = getDeadlineState(deadline, locked, now);
  if (state.status === 'open') {
    return (
      <div className="deadline-banner">
        <strong>Ennustuste esitamise tähtajani: {formatCountdown(state.remainingMs)}</strong>
        <span>Tähtaeg: {state.deadlineLabel}</span>
      </div>
    );
  }
  if (state.status === 'missing') return <div className="deadline-banner warning">Ennustuste tähtaeg on määramata.</div>;
  return (
    <div className="deadline-banner locked">
      <strong>Ennustamine on lõppenud</strong>
      <span>Tähtaeg: {state.deadlineLabel}</span>
    </div>
  );
}
