import type { GroupBonusPrediction, KnockoutBonusPrediction, MatchPrediction } from '../domain/types.js';

const api = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(`/api${path}`, { ...init, headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) } });
  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(body.error ?? 'Request failed');
  }
  return response.json();
};

export const login = (name: string, inviteCode: string, contact = '') => api<{ id: string; name: string; role: string; status: string }>('/login', { method: 'POST', body: JSON.stringify({ name, inviteCode, contact }) });
export const loadState = (playerId?: string) => api<any>(`/state${playerId ? `?playerId=${playerId}` : ''}`);
export const savePredictions = (playerId: string, predictions: MatchPrediction[]) => api<any>('/predictions', { method: 'POST', body: JSON.stringify({ playerId, predictions }) });
export const saveBonusPrediction = (playerId: string, groups: GroupBonusPrediction[], knockout: KnockoutBonusPrediction) => api<any>('/bonus-predictions', { method: 'POST', body: JSON.stringify({ playerId, groups, knockout }) });
export const saveResult = (actorId: string, adminCode: string, result: MatchPrediction) => api<any>('/admin/results', { method: 'POST', body: JSON.stringify({ actorId, adminCode, result }) });
export const saveBonusResults = (actorId: string, adminCode: string, groups: GroupBonusPrediction[], knockout: KnockoutBonusPrediction & { topScorers: string[] }) => api<any>('/admin/bonus-results', { method: 'POST', body: JSON.stringify({ actorId, adminCode, groups, knockout }) });
export const setLock = (actorId: string, adminCode: string, locked: boolean) => api<any>('/admin/lock', { method: 'POST', body: JSON.stringify({ actorId, adminCode, locked }) });
export const setDeadline = (actorId: string, adminCode: string, deadline: string) => api<any>('/admin/deadline', { method: 'POST', body: JSON.stringify({ actorId, adminCode, deadline }) });
export const recalculate = (actorId: string, adminCode: string) => api<any>('/admin/recalculate', { method: 'POST', body: JSON.stringify({ actorId, adminCode }) });
export const loadBreakdown = (playerId: string) => api<any[]>(`/breakdown?playerId=${playerId}`);
export const updatePlayerStatus = (actorId: string, adminCode: string, playerId: string, status: string, note = '') => api<any>('/admin/player-status', { method: 'POST', body: JSON.stringify({ actorId, adminCode, playerId, status, note }) });
export const deletePlayer = (actorId: string, adminCode: string, playerId: string, confirmationName: string) => api<any>('/admin/delete-player', { method: 'POST', body: JSON.stringify({ actorId, adminCode, playerId, confirmationName }) });
