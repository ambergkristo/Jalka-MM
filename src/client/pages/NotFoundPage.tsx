import { Card } from '../components/Card.js';
import { PageHeader } from '../components/PageHeader.js';

export function NotFoundPage() {
  return (
    <>
      <PageHeader eyebrow="404" title="Page Not Found" description="This public tracker route does not exist." />
      <Card>
        <a className="button-link" href="/">Return to dashboard</a>
      </Card>
    </>
  );
}
