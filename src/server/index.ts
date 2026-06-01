import { createReadStream, existsSync, statSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { createServer } from 'node:http';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { authenticateAdmin, authenticatePlayer, breakdownFor, clearResult, createSession, deletePlayer, deleteSession, getState, healthCheck, recalculateScores, registerPlayer, saveBonusPrediction, saveBonusResults, savePredictions, saveResult, seedTournamentData, sessionFromToken, setDeadline, setLock, submitFinalPredictions, updatePlayerStatus } from './db.js';
import { getRuntimeConfig } from './config.js';

await seedTournamentData();

const serverDir = dirname(fileURLToPath(import.meta.url));
const clientDir = resolve(serverDir, '..', 'client');
const clientIndex = join(clientDir, 'index.html');

createServer(async (request, response) => {
  if (request.method === 'OPTIONS') return json(response, 204, {});
  try {
    const url = new URL(request.url ?? '/', `http://${request.headers.host}`);
    const session = await sessionFromToken(readCookie(request, 'wc_session'));
    if (request.method === 'POST' && url.pathname === '/api/register') {
      const body = await readJson(request);
      const player = await registerPlayer({ firstName: String(body.firstName ?? ''), lastName: String(body.lastName ?? ''), contact: String(body.contact ?? ''), inviteCode: String(body.inviteCode ?? ''), password: String(body.password ?? '') });
      const createdSession = await createSession(player);
      setSessionCookie(response, createdSession.token, createdSession.expiresAt);
      return json(response, 200, player);
    }
    if (request.method === 'POST' && url.pathname === '/api/login') {
      const body = await readJson(request);
      const player = await authenticatePlayer(String(body.firstName ?? ''), String(body.lastName ?? ''), String(body.password ?? ''));
      const createdSession = await createSession(player);
      setSessionCookie(response, createdSession.token, createdSession.expiresAt);
      return json(response, 200, player);
    }
    if (request.method === 'POST' && url.pathname === '/api/admin/login') {
      const body = await readJson(request);
      const admin = await authenticateAdmin(String(body.username ?? ''), String(body.password ?? ''));
      const createdSession = await createSession(admin);
      setSessionCookie(response, createdSession.token, createdSession.expiresAt);
      return json(response, 200, admin);
    }
    if (request.method === 'POST' && url.pathname === '/api/logout') {
      await deleteSession(readCookie(request, 'wc_session'));
      clearSessionCookie(response);
      return json(response, 200, { ok: true });
    }
    if (request.method === 'GET' && url.pathname === '/api/session') return json(response, 200, session);
    if (request.method === 'GET' && url.pathname === '/api/state') return json(response, 200, await getState(session?.role === 'player' ? session.id : undefined, session?.role === 'admin'));
    if (request.method === 'GET' && (url.pathname === '/api/health' || url.pathname === '/api/health/db')) return json(response, 200, await healthCheck());
    if (request.method === 'POST' && url.pathname === '/api/predictions') {
      const player = requirePlayer(session);
      const body = await readJson(request);
      await savePredictions(player.id, body.predictions ?? []);
      return json(response, 200, await getState(player.id));
    }
    if (request.method === 'POST' && url.pathname === '/api/bonus-predictions') {
      const player = requirePlayer(session);
      const body = await readJson(request);
      await saveBonusPrediction(player.id, body.groups ?? [], body.knockout);
      return json(response, 200, await getState(player.id));
    }
    if (request.method === 'POST' && url.pathname === '/api/final-submit') {
      const player = requirePlayer(session);
      await submitFinalPredictions(player.id);
      return json(response, 200, await getState(player.id));
    }
    if (request.method === 'POST' && url.pathname === '/api/admin/results') {
      const admin = requireAdmin(session);
      const body = await readJson(request);
      await saveResult(admin.name, body.result);
      return json(response, 200, await getState(undefined, true));
    }
    if (request.method === 'POST' && url.pathname === '/api/admin/clear-result') {
      const admin = requireAdmin(session);
      const body = await readJson(request);
      await clearResult(admin.name, Number(body.matchId));
      return json(response, 200, await getState(undefined, true));
    }
    if (request.method === 'POST' && url.pathname === '/api/admin/lock') {
      const admin = requireAdmin(session);
      const body = await readJson(request);
      await setLock(admin.name, Boolean(body.locked));
      return json(response, 200, await getState(undefined, true));
    }
    if (request.method === 'POST' && url.pathname === '/api/admin/deadline') {
      const admin = requireAdmin(session);
      const body = await readJson(request);
      await setDeadline(admin.name, String(body.deadline));
      return json(response, 200, await getState(undefined, true));
    }
    if (request.method === 'POST' && url.pathname === '/api/admin/bonus-results') {
      const admin = requireAdmin(session);
      const body = await readJson(request);
      await saveBonusResults(admin.name, body.groups ?? [], body.knockout);
      return json(response, 200, await getState(undefined, true));
    }
    if (request.method === 'POST' && url.pathname === '/api/admin/player-status') {
      const admin = requireAdmin(session);
      const body = await readJson(request);
      return json(response, 200, await updatePlayerStatus(admin.name, String(body.playerId ?? ''), String(body.status ?? ''), String(body.note ?? '')));
    }
    if (request.method === 'POST' && url.pathname === '/api/admin/delete-player') {
      const admin = requireAdmin(session);
      const body = await readJson(request);
      return json(response, 200, await deletePlayer(admin.name, String(body.playerId ?? ''), String(body.confirmationName ?? '')));
    }
    if (request.method === 'POST' && url.pathname === '/api/admin/recalculate') {
      requireAdmin(session);
      return json(response, 200, { leaderboard: await recalculateScores() });
    }
    if (request.method === 'GET' && url.pathname === '/api/breakdown') {
      if (!session) throw new Error('Authentication required');
      const playerId = String(url.searchParams.get('playerId') ?? '');
      if (session.role !== 'admin' && session.id !== playerId) throw new Error('Access denied');
      return json(response, 200, await breakdownFor(playerId));
    }
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

function readCookie(request: IncomingMessage, name: string): string | undefined {
  const header = request.headers.cookie ?? '';
  for (const part of header.split(';')) {
    const [key, ...value] = part.trim().split('=');
    if (key === name) return decodeURIComponent(value.join('='));
  }
  return undefined;
}

function setSessionCookie(response: ServerResponse, token: string, expiresAt: string) {
  const config = getRuntimeConfig();
  const secure = config.appEnv === 'production' ? '; Secure' : '';
  response.setHeader('set-cookie', `wc_session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax${secure}; Expires=${new Date(expiresAt).toUTCString()}`);
}

function clearSessionCookie(response: ServerResponse) {
  const config = getRuntimeConfig();
  const secure = config.appEnv === 'production' ? '; Secure' : '';
  response.setHeader('set-cookie', `wc_session=; Path=/; HttpOnly; SameSite=Lax${secure}; Max-Age=0`);
}

function requirePlayer(session: any): { id: string; name: string; role: string } {
  if (!session || session.role !== 'player') throw new Error('Authentication required');
  return session;
}

function requireAdmin(session: any): { id: string; name: string; role: string } {
  if (!session || session.role !== 'admin') throw new Error('Admin access required');
  return session;
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
