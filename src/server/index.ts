import { createReadStream, existsSync, statSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { createServer } from 'node:http';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getPublicState, healthCheck, seedTournamentData } from './db.js';
import { db } from './db.js';
import type { ManualResultConfirmationInput } from './results/manualResultCorrection.js';
import { getPublicResultsPayload, getPublicTournamentPayload, getPublicTournamentSnapshot } from './results/publicTournamentSnapshot.js';
import { confirmManualResultRuntime, getCurrentLeaderboard, getManualResultPermission, getResultsAgentRunPermission, getResultsAgentStatus, runResultsAgentCycle } from './results/resultAgentRuntime.js';

await seedTournamentData();

const serverDir = dirname(fileURLToPath(import.meta.url));
const clientDir = resolve(serverDir, '..', 'client');
const clientIndex = join(clientDir, 'index.html');

createServer(async (request, response) => {
  if (request.method === 'OPTIONS') return json(response, 204, {});
  try {
    const url = new URL(request.url ?? '/', `http://${request.headers.host}`);
    if (request.method === 'GET' && url.pathname === '/api/state') return json(response, 200, await getPublicState());
    if (request.method === 'GET' && (url.pathname === '/api/health' || url.pathname === '/api/health/db')) return json(response, 200, await healthCheck());
    if (request.method === 'GET' && url.pathname === '/api/leaderboard') return json(response, 200, await getCurrentLeaderboard());
    if (request.method === 'GET' && url.pathname === '/api/public-dashboard') return json(response, 200, await getPublicTournamentSnapshot(db));
    if (request.method === 'GET' && url.pathname === '/api/results') return json(response, 200, await getPublicResultsPayload(db));
    if (request.method === 'GET' && url.pathname === '/api/tournament') return json(response, 200, await getPublicTournamentPayload(db));
    if (request.method === 'GET' && url.pathname === '/api/results-agent/status') return json(response, 200, await getResultsAgentStatus());
    if (request.method === 'POST' && url.pathname === '/api/results-agent/run') {
      const permission = getResultsAgentRunPermission({
        dryRunRequested: url.searchParams.get('dryRun') === 'true',
        providedSecret: singleHeaderValue(request.headers['x-results-agent-secret'])
      });
      if (!permission.allowed) return json(response, permission.status, { error: permission.error });
      return json(response, 200, await runResultsAgentCycle(new Date(), { dryRun: permission.dryRun }));
    }
    if (request.method === 'POST' && url.pathname === '/api/results-agent/manual-confirm') {
      const permission = getManualResultPermission({
        providedSecret: singleHeaderValue(request.headers['x-results-agent-secret'])
      });
      if (!permission.allowed) return json(response, permission.status, { error: permission.error });
      return json(response, 200, await confirmManualResultRuntime(await readJsonBody(request) as unknown as ManualResultConfirmationInput));
    }
    if (url.pathname.startsWith('/api/')) return json(response, 404, { error: 'Not found' });
    if (request.method === 'GET' || request.method === 'HEAD') return serveFrontend(request, response, url.pathname);
    return json(response, 404, { error: 'Not found' });
  } catch (error) {
    return json(response, 400, { error: error instanceof Error ? error.message : 'Request failed' });
  }
}).listen(8787, () => console.log('MM 2026 public tracker listening on http://localhost:8787'));

function json(response: ServerResponse, status: number, payload: unknown) {
  response.writeHead(status, {
    'content-type': 'application/json',
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-allow-headers': 'content-type,x-results-agent-secret'
  });
  response.end(JSON.stringify(payload));
}

function singleHeaderValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function readJsonBody(request: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolveBody, reject) => {
    const chunks: Buffer[] = [];
    request.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    request.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8').trim();
        resolveBody(raw ? JSON.parse(raw) as Record<string, unknown> : {});
      } catch (error) {
        reject(error);
      }
    });
    request.on('error', reject);
  });
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
