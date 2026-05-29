import type { MatchPrediction } from '../domain/types.js';

const api = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(`/api${path}`, { ...init, headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) } });
  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(body.error ?? 'Request failed');
  }
  return response.json();
};

export const login = (name: string, inviteCode: string) => api<{ id: string; name: string; role: string }>('/login', { method: 'POST', body: JSON.stringify({ name, inviteCode }) });
export const loadState = (playerId?: string) => api<any>(`/state${playerId ? `?playerId=${playerId}` : ''}`);
export const savePredictions = (playerId: string, predictions: MatchPrediction[]) => api<any>('/predictions', { method: 'POST', body: JSON.stringify({ playerId, predictions }) });
export const saveResult = (actor: string, result: MatchPrediction) => api<any>('/admin/results', { method: 'POST', body: JSON.stringify({ actor, result }) });
export const setLock = (actor: string, locked: boolean) => api<any>('/admin/lock', { method: 'POST', body: JSON.stringify({ actor, locked }) });
export const recalculate = () => api<any>('/admin/recalculate', { method: 'POST', body: '{}' });
