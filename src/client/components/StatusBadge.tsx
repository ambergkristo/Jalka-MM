export function StatusBadge({ value, tone = 'neutral' }: { value: string; tone?: 'neutral' | 'good' | 'danger' | 'gold' }) {
  return <span className={`status-badge ${tone}`}>{value}</span>;
}
