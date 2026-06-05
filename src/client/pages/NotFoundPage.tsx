import { Card } from '../components/Card.js';
import { PageHeader } from '../components/PageHeader.js';

export function NotFoundPage() {
  return (
    <>
      <PageHeader eyebrow="404" title="Lehte ei leitud" description="Sellist avalikku vaadet ei ole." />
      <Card>
        <a className="button-link" href="/">Tagasi avalehele</a>
      </Card>
    </>
  );
}
