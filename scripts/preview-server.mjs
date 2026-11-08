// Serves the web build of the app and proxies /v1 and /admin to the API, all on one port —
// handy for previews where the browser can't reach the API's own port.
// Usage: node scripts/preview-server.mjs [distDir=apps/mobile/dist] [port=8081] [api=http://127.0.0.1:8080]
// Build the app with: EXPO_PUBLIC_API_URL=same-origin npx expo export --platform web --output-dir dist
import { createServer, request } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(process.argv[2] ?? 'apps/mobile/dist');
const port = Number(process.argv[3] ?? 8081);
const api = new URL(process.argv[4] ?? 'http://127.0.0.1:8080');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json', '.ttf': 'font/ttf', '.svg': 'image/svg+xml' };

createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://x');
  if (url.pathname.startsWith('/v1/') || url.pathname.startsWith('/admin')) {
    const upstream = request({ hostname: api.hostname, port: api.port, path: req.url, method: req.method, headers: { ...req.headers, host: api.host } }, (r) => {
      res.writeHead(r.statusCode ?? 502, r.headers);
      r.pipe(res);
    });
    upstream.on('error', () => { res.writeHead(502); res.end('API unavailable'); });
    req.pipe(upstream);
    return;
  }
  let file = path.join(root, decodeURIComponent(url.pathname));
  if (!file.startsWith(root)) { res.writeHead(403); res.end(); return; }
  try {
    if ((await stat(file)).isDirectory()) file = path.join(file, 'index.html');
  } catch {
    file = path.join(root, 'index.html'); // SPA fallback for client-side routes
  }
  try {
    res.writeHead(200, { 'content-type': types[path.extname(file)] ?? 'application/octet-stream' });
    res.end(await readFile(file));
  } catch {
    res.writeHead(404);
    res.end();
  }
}).listen(port, '0.0.0.0', () => console.log(`preview on http://localhost:${port} (api → ${api.origin})`));
