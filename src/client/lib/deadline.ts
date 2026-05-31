import { formatDeadlineDateTime } from './date.js';

export type DeadlineState =
  | { status: 'open'; remainingMs: number; deadlineLabel: string }
  | { status: 'locked'; deadlineLabel: string }
  | { status: 'passed'; deadlineLabel: string }
  | { status: 'missing'; deadlineLabel: string };

export function getDeadlineState(deadline: unknown, locked: boolean, nowMs = Date.now()): DeadlineState {
  const deadlineLabel = formatDeadlineDateTime(deadline);
  if (locked) return { status: 'locked', deadlineLabel };
  if (typeof deadline !== 'string' || deadline.trim() === '') return { status: 'missing', deadlineLabel };
  const deadlineMs = new Date(deadline).getTime();
  if (Number.isNaN(deadlineMs)) return { status: 'missing', deadlineLabel };
  const remainingMs = deadlineMs - nowMs;
  if (remainingMs <= 0) return { status: 'passed', deadlineLabel };
  return { status: 'open', remainingMs, deadlineLabel };
}

export function formatCountdown(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${days} päeva ${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}
