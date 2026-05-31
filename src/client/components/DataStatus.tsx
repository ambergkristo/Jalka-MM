export function UserDataStatus({ status }: { status: any }) {
  const metadata = status?.metadata;
  if (!metadata) return null;
  const warning = metadata.verificationStatus === 'official' ? '' : 'Turniiriandmed ei ole veel täielikult ametlikult lõplikud.';
  return (
    <div className={`data-status ${metadata.verificationStatus === 'official' ? 'official' : 'warning'}`} title={warning}>
      Turniiriandmed: <strong>{statusLabel(metadata.verificationStatus)}</strong>
      {metadata.sourceRetrievedAt ? ` · uuendatud ${new Date(metadata.sourceRetrievedAt).toLocaleDateString('et-EE')}` : ''}
      {warning && <span> · {warning}</span>}
    </div>
  );
}

export function AdminDataStatus({ status }: { status: any }) {
  const metadata = status?.metadata;
  const validation = status?.validation;
  if (!metadata || !validation) return <div className="empty">Turniiriandmete staatust ei ole saadaval.</div>;
  return (
    <article className="panel data-panel">
      <h2>Turniiriandmete staatus</h2>
      <div className={`status-pill ${metadata.verificationStatus === 'official' ? 'official' : 'warning'}`}>{statusLabel(metadata.verificationStatus)}</div>
      <dl className="status-grid">
        <dt>Allikas</dt><dd>{metadata.sourceName}</dd>
        <dt>Viide</dt><dd>{metadata.sourceReference}</dd>
        <dt>Kontrollitud</dt><dd>{metadata.sourceRetrievedAt}</dd>
        <dt>Riike</dt><dd>{validation.counts.teams}</dd>
        <dt>Alagruppe</dt><dd>{validation.counts.groups}</dd>
        <dt>Mänge</dt><dd>{validation.counts.matches}</dd>
        <dt>Lahendamata slotid</dt><dd>{validation.unresolved?.teamSlots ?? status.unresolved?.teamSlots ?? 0}</dd>
        <dt>Puuduvad kuupäevad</dt><dd>{validation.unresolved?.fixtureDates ?? status.unresolved?.fixtureDates ?? 0}</dd>
        <dt>Puuduvad avalöögid</dt><dd>{validation.unresolved?.kickoffTimes ?? status.unresolved?.kickoffTimes ?? 0}</dd>
        <dt>Avalöögi mängud</dt><dd>{formatIds(validation.unresolved?.groupStageKickoffMatchIds ?? status.unresolved?.groupStageKickoffMatchIds ?? [])}</dd>
        <dt>Riskitase</dt><dd>{riskLabel(validation.riskLevel ?? status.riskLevel)}</dd>
        <dt>Andmebaas</dt><dd>{status.storage?.database ?? 'teadmata'} · {status.storage?.mode ?? 'local'}</dd>
        <dt>Valideerimine</dt><dd>{validation.valid ? 'korras' : 'vigane'}</dd>
      </dl>
      {validation.warnings.length > 0 && <div className="warning-box">{validation.warnings.join(' ')}</div>}
      {status.storage?.warning && <div className="warning-box">{status.storage.warning}</div>}
      {validation.errors.length > 0 && <div className="error">{validation.errors.join(' ')}</div>}
    </article>
  );
}

function formatIds(ids: number[]): string {
  if (!ids.length) return 'puuduvad';
  const shown = ids.slice(0, 16).join(', ');
  return ids.length > 16 ? `${shown}, +${ids.length - 16} veel` : shown;
}

export function statusLabel(status: string): string {
  return ({
    official: 'Ametlikud andmed',
    partial_official: 'Osaliselt kinnitatud turniiriandmed',
    seeded: 'Näidisandmed',
    manual: 'Käsitsi andmed',
    unknown: 'Teadmata andmed'
  } as Record<string, string>)[status] ?? 'Teadmata andmed';
}

function riskLabel(risk: string): string {
  return ({ low: 'madal', medium: 'keskmine', high: 'kõrge' } as Record<string, string>)[risk] ?? risk;
}
