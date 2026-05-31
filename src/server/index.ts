import { createReadStream, existsSync, statSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { createServer } from 'node:http';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { breakdownFor, createPlayer, getState, healthCheck, recalculateScores, saveBonusPrediction, saveBonusResults, savePredictions, saveResult, seedTournamentData, setDeadline, setLock, updatePlayerStatus, verifyAdminAccess } from './db.js';
import { getRuntimeConfig } from './config.js';

await seedTournamentData();

const serverDir = dirname(fileURLToPath(import.meta.url));
const clientDir = resolve(serverDir, '..', 'client');
const clientIndex = join(clientDir, 'index.html');

createServer(async (request, response) => {
  if (request.method === 'OPTIONS') return json(response, 204, {});
  try {
    const url = new URL(request.url ?? '/', `http://${request.headers.host}`);
    if (request.method === 'POST' && url.pathname === '/api/login') {
      const body = await readJson(request);
      const config = getRuntimeConfig();
      return json(response, 200, await createPlayer(String(body.name ?? 'Player'), String(body.inviteCode ?? 'FRIENDS2026'), body.inviteCode === config.adminSecret ? 'admin' : 'player', String(body.contact ?? '')));
    }
    if (request.method === 'GET' && url.pathname === '/api/state') return json(response, 200, await getState(url.searchParams.get('playerId') ?? undefined));
    if (request.method === 'GET' && (url.pathname === '/api/health' || url.pathname === '/api/health/db')) return json(response, 200, await healthCheck());
    if (request.method === 'POST' && url.pathname === '/api/predictions') {
      const body = await readJson(request);
      await savePredictions(String(body.playerId), body.predictions ?? []);
      return json(response, 200, await getState(String(body.playerId)));
    }
    if (request.method === 'POST' && url.pathname === '/api/bonus-predictions') {
      const body = await readJson(request);
      await saveBonusPrediction(String(body.playerId), body.groups ?? [], body.knockout);
      return json(response, 200, await getState(String(body.playerId)));
    }
    if (request.method === 'POST' && url.pathname === '/api/admin/results') {
      const body = await readJson(request);
      await verifyAdminAccess(String(body.actorId ?? ''), String(body.adminCode ?? ''));
      await saveResult(String(body.actorId ?? 'admin'), body.result);
      return json(response, 200, await getState());
    }
    if (request.method === 'POST' && url.pathname === '/api/admin/lock') {
      const body = await readJson(request);
      await verifyAdminAccess(String(body.actorId ?? ''), String(body.adminCode ?? ''));
      await setLock(String(body.actorId ?? 'admin'), Boolean(body.locked));
      return json(response, 200, await getState());
    }
    if (request.method === 'POST' && url.pathname === '/api/admin/deadline') {
      const body = await readJson(request);
      await verifyAdminAccess(String(body.actorId ?? ''), String(body.adminCode ?? ''));
      await setDeadline(String(body.actorId ?? 'admin'), String(body.deadline));
      return json(response, 200, await getState());
    }
    if (request.method === 'POST' && url.pathname === '/api/admin/bonus-results') {
      const body = await readJson(request);
      await verifyAdminAccess(String(body.actorId ?? ''), String(body.adminCode ?? ''));
      await saveBonusResults(String(body.actorId ?? 'admin'), body.groups ?? [], body.knockout);
      return json(response, 200, await getState());
    }
    if (request.method === 'POST' && url.pathname === '/api/admin/player-status') {
      const body = await readJson(request);
      return json(response, 200, await updatePlayerStatus(String(body.actorId ?? ''), String(body.adminCode ?? ''), String(body.playerId ?? ''), String(body.status ?? ''), String(body.note ?? '')));
    }
    if (request.method === 'POST' && url.pathname === '/api/admin/recalculate') {
      const body = await readJson(request);
      await verifyAdminAccess(String(body.actorId ?? ''), String(body.adminCode ?? ''));
      return json(response, 200, { leaderboard: await recalculateScores() });
    }
    if (request.method === 'GET' && url.pathname === '/api/breakdown') return json(response, 200, await breakdownFor(String(url.searchParams.get('playerId') ?? '')));
    if (url.pathname.startsWith('/api/')) return json(response, 404, { error: 'Not found' });
    if (request.method === 'GET' || request.method === 'HEAD') return serveFrontend(request, response, url.pathname);
    return json(response, 404, { error: 'Not found' });
  } catch (error) {
    return json(response, 400, { error: error instanceof Error ? error.message : 'Request failed' });
  }
}).listen(8787, () => console.log('World Cup predictor API listening on http://localhost:8787'));

function json(response: ServerResponse, status: number, payload: unknown) {
  response.writeHead(status, { 'content-type': 'application/json', 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET,POST,OPTIONS', 'access-control-allow-headers': 'content-type' });
  response.end(JSON.stringify(payload));
}

function serveFrontend(request: IncomingMessage, response: ServerResponse, pathname: string) {
  if (!existsSync(clientIndex)) return json(response, 404, { error: 'Frontend build not found' });
  const decodedPath = decodeURIComponent(pathname);
  const requestedPath = decodedPath === '/' ? clientIndex : resolve(clientDir, `.${decodedPath}`);
  const safePath = normalize(requestedPath);
  const filePath = safePath.startsWith(clientDir) && existsSync(safePath) && statSync(safePath).isFile() ? safePath : clientIndex;
  response.writeHead(200, {
    'content-type': contentType(filePath),
    'cache-control': filePath.includes(`${join('client', 'assets')}`) ? 'public, max-age=31536000, immutable' : 'no-cache'
  });
  if (request.method === 'HEAD') return response.end();
  createReadStream(filePath).pipe(response);
}

function contentType(filePath: string) {
  return ({
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.webmanifest': 'application/manifest+json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
  } as Record<string, string>)[extname(filePath)] ?? 'application/octet-stream';
}

async function readJson(request: IncomingMessage): Promise<Record<string, any>> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {};
}
