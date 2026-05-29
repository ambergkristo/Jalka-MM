export function UserDataStatus({ status }: { status: any }) {
  const metadata = status?.metadata;
  if (!metadata) return null;
  const warning = metadata.verificationStatus === 'official' ? '' : 'Source is not fully official yet.';
  return (
    <div className={`data-status ${metadata.verificationStatus === 'official' ? 'official' : 'warning'}`} title={warning}>
      Tournament data: <strong>{statusLabel(metadata.verificationStatus)}</strong>
      {metadata.sourceRetrievedAt ? ` · updated ${new Date(metadata.sourceRetrievedAt).toLocaleDateString()}` : ''}
      {warning && <span> · {warning}</span>}
    </div>
  );
}

export function AdminDataStatus({ status }: { status: any }) {
  const metadata = status?.metadata;
  const validation = status?.validation;
  if (!metadata || !validation) return <div className="empty">Tournament data status is not available.</div>;
  return (
    <article className="panel data-panel">
      <h2>Tournament data status</h2>
      <div className={`status-pill ${metadata.verificationStatus === 'official' ? 'official' : 'warning'}`}>{statusLabel(metadata.verificationStatus)}</div>
      <dl className="status-grid">
        <dt>Source</dt><dd>{metadata.sourceName}</dd>
        <dt>Reference</dt><dd>{metadata.sourceReference}</dd>
        <dt>Retrieved</dt><dd>{metadata.sourceRetrievedAt}</dd>
        <dt>Teams</dt><dd>{validation.counts.teams}</dd>
        <dt>Groups</dt><dd>{validation.counts.groups}</dd>
        <dt>Matches</dt><dd>{validation.counts.matches}</dd>
        <dt>Unresolved slots</dt><dd>{validation.unresolved?.teamSlots ?? status.unresolved?.teamSlots ?? 0}</dd>
        <dt>Unresolved dates</dt><dd>{validation.unresolved?.fixtureDates ?? status.unresolved?.fixtureDates ?? 0}</dd>
        <dt>Kickoff times missing</dt><dd>{validation.unresolved?.kickoffTimes ?? status.unresolved?.kickoffTimes ?? 0}</dd>
        <dt>Kickoff match IDs</dt><dd>{formatIds(validation.unresolved?.groupStageKickoffMatchIds ?? status.unresolved?.groupStageKickoffMatchIds ?? [])}</dd>
        <dt>Risk level</dt><dd>{validation.riskLevel ?? status.riskLevel}</dd>
        <dt>Storage</dt><dd>{status.storage?.database ?? 'Unknown'} · {status.storage?.mode ?? 'local'}</dd>
        <dt>Validation</dt><dd>{validation.valid ? 'passes' : 'fails'}</dd>
      </dl>
      {validation.warnings.length > 0 && <div className="warning-box">{validation.warnings.join(' ')}</div>}
      {status.storage?.warning && <div className="warning-box">{status.storage.warning}</div>}
      {validation.errors.length > 0 && <div className="error">{validation.errors.join(' ')}</div>}
    </article>
  );
}

function formatIds(ids: number[]): string {
  if (!ids.length) return 'none';
  const shown = ids.slice(0, 16).join(', ');
  return ids.length > 16 ? `${shown}, +${ids.length - 16} more` : shown;
}

export function statusLabel(status: string): string {
  return ({
    official: 'Official data',
    partial_official: 'Partially official data',
    seeded: 'Seeded data',
    manual: 'Manual data',
    unknown: 'Unknown data'
  } as Record<string, string>)[status] ?? 'Unknown data';
}
