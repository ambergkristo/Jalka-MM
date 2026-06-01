import type { GroupBonusPrediction, KnockoutBonusPrediction, MatchPrediction } from '../domain/types.js';

const api = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(`/api${path}`, { ...init, credentials: 'same-origin', headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) } });
  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(body.error ?? 'Request failed');
  }
  return response.json();
};

export const register = (firstName: string, lastName: string, contact: string, inviteCode: string, password: string) => api<{ id: string; name: string; role: string; status: string }>('/register', { method: 'POST', body: JSON.stringify({ firstName, lastName, contact, inviteCode, password }) });
export const login = (firstName: string, lastName: string, password: string) => api<{ id: string; name: string; role: string; status: string }>('/login', { method: 'POST', body: JSON.stringify({ firstName, lastName, password }) });
export const adminLogin = (username: string, password: string) => api<{ id: string; name: string; username: string; role: string }>('/admin/login', { method: 'POST', body: JSON.stringify({ username, password }) });
export const logoutSession = () => api<{ ok: boolean }>('/logout', { method: 'POST', body: JSON.stringify({}) });
export const currentSession = () => api<any>('/session');
export const loadState = () => api<any>('/state');
export const savePredictions = (predictions: MatchPrediction[]) => api<any>('/predictions', { method: 'POST', body: JSON.stringify({ predictions }) });
export const finalSubmitPredictions = () => api<any>('/final-submit', { method: 'POST', body: JSON.stringify({}) });
export const saveBonusPrediction = (groups: GroupBonusPrediction[], knockout: KnockoutBonusPrediction) => api<any>('/bonus-predictions', { method: 'POST', body: JSON.stringify({ groups, knockout }) });
export const saveResult = (result: MatchPrediction) => api<any>('/admin/results', { method: 'POST', body: JSON.stringify({ result }) });
export const clearResult = (matchId: number) => api<any>('/admin/clear-result', { method: 'POST', body: JSON.stringify({ matchId }) });
export const saveBonusResults = (groups: GroupBonusPrediction[], knockout: KnockoutBonusPrediction & { topScorers: string[] }) => api<any>('/admin/bonus-results', { method: 'POST', body: JSON.stringify({ groups, knockout }) });
export const setLock = (locked: boolean) => api<any>('/admin/lock', { method: 'POST', body: JSON.stringify({ locked }) });
export const setDeadline = (deadline: string) => api<any>('/admin/deadline', { method: 'POST', body: JSON.stringify({ deadline }) });
export const recalculate = () => api<any>('/admin/recalculate', { method: 'POST', body: JSON.stringify({}) });
export const loadBreakdown = (playerId: string) => api<any[]>(`/breakdown?playerId=${playerId}`);
export const updatePlayerStatus = (playerId: string, status: string, note = '') => api<any>('/admin/player-status', { method: 'POST', body: JSON.stringify({ playerId, status, note }) });
export const deletePlayer = (playerId: string, confirmationName: string) => api<any>('/admin/delete-player', { method: 'POST', body: JSON.stringify({ playerId, confirmationName }) });
