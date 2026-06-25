import { Card } from './Card.js';

export function PublicDataNotice({ message }: { message: string }) {
  return (
    <Card className="public-data-notice">
      <p className="eyebrow">Andmed ei laadinud</p>
      <h2>Avalik seis pole ajakohane</h2>
      <p className="empty-state">{message}</p>
    </Card>
  );
}
