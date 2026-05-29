import type { IncomingMessage, ServerResponse } from 'node:http';
import { createServer } from 'node:http';
import { breakdownFor, createPlayer, getState, recalculateScores, saveBonusPrediction, saveBonusResults, savePredictions, saveResult, seedDemo, setDeadline, setLock } from './db.js';

seedDemo();

createServer(async (request, response) => {
  if (request.method === 'OPTIONS') return json(response, 204, {});
  try {
    const url = new URL(request.url ?? '/', `http://${request.headers.host}`);
    if (request.method === 'POST' && url.pathname === '/api/login') {
      const body = await readJson(request);
      return json(response, 200, createPlayer(String(body.name ?? 'Player'), String(body.inviteCode ?? 'FRIENDS2026'), body.inviteCode === 'ADMIN2026' ? 'admin' : 'player'));
    }
    if (request.method === 'GET' && url.pathname === '/api/state') return json(response, 200, getState(url.searchParams.get('playerId') ?? undefined));
    if (request.method === 'POST' && url.pathname === '/api/predictions') {
      const body = await readJson(request);
      savePredictions(String(body.playerId), body.predictions ?? []);
      return json(response, 200, getState(String(body.playerId)));
    }
    if (request.method === 'POST' && url.pathname === '/api/bonus-predictions') {
      const body = await readJson(request);
      saveBonusPrediction(String(body.playerId), body.groups ?? [], body.knockout);
      return json(response, 200, getState(String(body.playerId)));
    }
    if (request.method === 'POST' && url.pathname === '/api/admin/results') {
      const body = await readJson(request);
      saveResult(String(body.actor ?? 'admin'), body.result);
      return json(response, 200, getState());
    }
    if (request.method === 'POST' && url.pathname === '/api/admin/lock') {
      const body = await readJson(request);
      setLock(String(body.actor ?? 'admin'), Boolean(body.locked));
      return json(response, 200, getState());
    }
    if (request.method === 'POST' && url.pathname === '/api/admin/deadline') {
      const body = await readJson(request);
      setDeadline(String(body.actor ?? 'admin'), String(body.deadline));
      return json(response, 200, getState());
    }
    if (request.method === 'POST' && url.pathname === '/api/admin/bonus-results') {
      const body = await readJson(request);
      saveBonusResults(String(body.actor ?? 'admin'), body.groups ?? [], body.knockout);
      return json(response, 200, getState());
    }
    if (request.method === 'POST' && url.pathname === '/api/admin/recalculate') return json(response, 200, { leaderboard: recalculateScores() });
    if (request.method === 'GET' && url.pathname === '/api/breakdown') return json(response, 200, breakdownFor(String(url.searchParams.get('playerId') ?? '')));
    return json(response, 404, { error: 'Not found' });
  } catch (error) {
    return json(response, 400, { error: error instanceof Error ? error.message : 'Request failed' });
  }
}).listen(8787, () => console.log('World Cup predictor API listening on http://localhost:8787'));

function json(response: ServerResponse, status: number, payload: unknown) {
  response.writeHead(status, { 'content-type': 'application/json', 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET,POST,OPTIONS', 'access-control-allow-headers': 'content-type' });
  response.end(JSON.stringify(payload));
}

async function readJson(request: IncomingMessage): Promise<Record<string, any>> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {};
}
