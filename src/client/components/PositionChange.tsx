export function PositionChange({ value }: { value: number }) {
  const label = value > 0 ? `\u25B2${value}` : value < 0 ? `\u25BC${Math.abs(value)}` : '\u2014';
  const className = value > 0 ? 'up' : value < 0 ? 'down' : 'same';
  return <span className={`position-change ${className}`}>{label}</span>;
}
