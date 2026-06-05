export interface PublicState {
  status: string;
  tournamentDataStatus: string;
  generatedAt: string;
}

const api = async <T>(path: string): Promise<T> => {
  const response = await fetch(`/api${path}`, { headers: { accept: 'application/json' } });
  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(body.error ?? 'Request failed');
  }
  return response.json();
};

export const loadPublicState = () => api<PublicState>('/state');
