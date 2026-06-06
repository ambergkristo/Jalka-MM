import http from 'node:http';
import https from 'node:https';

const targetUrl = process.env.RENDER_KEEPALIVE_URL || 'https://jalka-mm.onrender.com';
const timeoutMs = Number(process.env.RENDER_KEEPALIVE_TIMEOUT_MS || 30000);
const attempts = Number(process.env.RENDER_KEEPALIVE_ATTEMPTS || 3);
const retryDelayMs = Number(process.env.RENDER_KEEPALIVE_RETRY_DELAY_MS || 2000);
const strict = process.env.RENDER_KEEPALIVE_STRICT === 'true';

let reachedTarget = false;
let lastResult;

for (let attempt = 1; attempt <= attempts; attempt += 1) {
  try {
    const startedAt = Date.now();
    const response = await fetchWithTimeout(targetUrl, timeoutMs);
    const elapsedMs = Date.now() - startedAt;
    const body = await response.text();
    const bodyPreview = body.replace(/\s+/g, ' ').slice(0, 120);

    console.log(JSON.stringify({
      ok: response.ok,
      attempt,
      url: targetUrl,
      status: response.status,
      elapsedMs,
      checkedAt: new Date().toISOString(),
      bodyPreview
    }, null, 2));

    reachedTarget = true;
    lastResult = { status: response.status, ok: response.ok };
    if (response.ok) process.exit(0);
  } catch (error) {
    lastResult = { error: error instanceof Error ? error.message : String(error) };
    console.error(JSON.stringify({
      ok: false,
      attempt,
      url: targetUrl,
      checkedAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : String(error)
    }, null, 2));
  }

  if (attempt < attempts) await sleep(retryDelayMs);
}

if (!strict && reachedTarget) {
  console.warn(JSON.stringify({
    ok: true,
    url: targetUrl,
    checkedAt: new Date().toISOString(),
    keepaliveAccepted: true,
    message: 'Render was reached but did not return 2xx before retries ended. Treating keepalive as non-fatal.',
    lastResult
  }, null, 2));
  process.exit(0);
}

console.error(JSON.stringify({
  ok: false,
  url: targetUrl,
  checkedAt: new Date().toISOString(),
  keepaliveAccepted: false,
  strict,
  lastResult
}, null, 2));
process.exit(1);

async function fetchWithTimeout(url, timeout) {
  return requestWithRedirects(addCacheBuster(url), timeout, 0);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function addCacheBuster(url) {
  const parsedUrl = new URL(url);
  parsedUrl.searchParams.set('keepalive', String(Date.now()));
  return parsedUrl;
}

function requestWithRedirects(url, timeout, redirectCount) {
  return new Promise((resolve, reject) => {
    const client = url.protocol === 'http:' ? http : https;
    const request = client.request(url, {
      method: 'GET',
      timeout,
      headers: {
        'user-agent': 'Jalka-MM-render-keepalive/1.0',
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'cache-control': 'no-cache'
      }
    }, (response) => {
      const location = response.headers.location;
      if (location && response.statusCode && response.statusCode >= 300 && response.statusCode < 400) {
        response.resume();
        if (redirectCount >= 5) {
          reject(new Error('Too many redirects'));
          return;
        }
        resolve(requestWithRedirects(new URL(location, url), timeout, redirectCount + 1));
        return;
      }

      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => {
        if (body.length < 1000) body += chunk;
      });
      response.on('end', () => {
        resolve({
          ok: Boolean(response.statusCode && response.statusCode >= 200 && response.statusCode < 300),
          status: response.statusCode ?? 0,
          text: async () => body
        });
      });
    });

    request.on('timeout', () => {
      request.destroy(new Error(`Timed out after ${timeout}ms`));
    });
    request.on('error', reject);
    request.end();
  });
}
