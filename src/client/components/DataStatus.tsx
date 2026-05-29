export function UserDataStatus({ status }: { status: any }) {
  const metadata = status?.metadata;
  if (!metadata) return null;
  return (
    <div className={`data-status ${metadata.verificationStatus === 'official' ? 'official' : 'warning'}`}>
      Tournament data: {metadata.verificationStatus}{metadata.sourceRetrievedAt ? ` · updated ${new Date(metadata.sourceRetrievedAt).toLocaleDateString()}` : ''}
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
      <div className={`status-pill ${metadata.verificationStatus === 'official' ? 'official' : 'warning'}`}>{metadata.verificationStatus}</div>
      <dl className="status-grid">
        <dt>Source</dt><dd>{metadata.sourceName}</dd>
        <dt>Reference</dt><dd>{metadata.sourceReference}</dd>
        <dt>Retrieved</dt><dd>{metadata.sourceRetrievedAt}</dd>
        <dt>Teams</dt><dd>{validation.counts.teams}</dd>
        <dt>Groups</dt><dd>{validation.counts.groups}</dd>
        <dt>Matches</dt><dd>{validation.counts.matches}</dd>
        <dt>Validation</dt><dd>{validation.valid ? 'passes' : 'fails'}</dd>
      </dl>
      {validation.warnings.length > 0 && <div className="warning-box">{validation.warnings.join(' ')}</div>}
      {validation.errors.length > 0 && <div className="error">{validation.errors.join(' ')}</div>}
    </article>
  );
}
