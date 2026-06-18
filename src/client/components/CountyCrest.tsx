import { resolveCountyVisual } from '../lib/countyVisuals.js';

export function CountyCrest({ county }: { county: string }) {
  const visual = resolveCountyVisual(county);
  return (
    <span className={`county-crest tone-${visual.tone}`} aria-hidden="true">
      {visual.crestUrl ? <img src={visual.crestUrl} alt="" loading="lazy" decoding="async" /> : visual.initials}
    </span>
  );
}
