export function PositionChange({ value }: { value: number }) {
  const label = value > 0 ? `▲${value}` : value < 0 ? `▼${Math.abs(value)}` : '—';
  const className = value > 0 ? 'up' : value < 0 ? 'down' : 'same';
  return <span className={`position-change ${className}`}>{label}</span>;
}
