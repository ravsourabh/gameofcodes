import http from 'node:http';
import { createSessionService } from './sessions.mjs';

export async function startSessionServer({ root = process.cwd(), port = 4176 } = {}) {
  const service = createSessionService({ root });
  const server = http.createServer((req, res) => {
    let url;
    try { url = new URL(req.url, 'http://localhost'); } catch { res.writeHead(400).end(); return; }
    void service.handle(req, res, url);
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
  return { port: server.address().port, close: () => new Promise((resolve, reject) => { server.close(error => error ? reject(error) : resolve()); server.closeIdleConnections(); }) };
}
