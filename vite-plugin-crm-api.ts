import fs from 'fs';
import path from 'path';
import type { IncomingMessage, ServerResponse } from 'http';
import type { Plugin, ViteDevServer } from 'vite';
import { loadEnv } from 'vite';
import type { VercelRequest, VercelResponse } from '@vercel/node';

function resolveHandlerFile(urlPath: string, root: string): string | null {
  const subpath = urlPath.replace(/^\/api\/?/, '').split('?')[0];
  if (!subpath) return null;

  const candidate = path.join(root, 'api', ...subpath.split('/')) + '.ts';
  return fs.existsSync(candidate) ? candidate : null;
}

async function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    req.on('end', () => resolve(Buffer.concat(chunks).toString()));
    req.on('error', reject);
  });
}

function createVercelRequest(req: IncomingMessage): Promise<VercelRequest> {
  const host = req.headers.host ?? 'localhost';
  const url = new URL(req.url ?? '/', `http://${host}`);
  const query: Record<string, string | string[]> = {};

  for (const [key, value] of url.searchParams.entries()) {
    const existing = query[key];
    if (existing === undefined) {
      query[key] = value;
    } else if (Array.isArray(existing)) {
      existing.push(value);
    } else {
      query[key] = [existing, value];
    }
  }

  const base: VercelRequest = {
    method: req.method,
    headers: req.headers as VercelRequest['headers'],
    query,
    cookies: {},
    body: undefined,
  };

  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    return Promise.resolve(base);
  }

  return readBody(req).then((raw) => {
    if (!raw) return base;
    try {
      base.body = JSON.parse(raw);
    } catch {
      base.body = raw;
    }
    return base;
  });
}

function createVercelResponse(res: ServerResponse): VercelResponse {
  let statusCode = 200;
  const headers: Record<string, string | number | string[]> = {};

  const vercelRes = {
    status(code: number) {
      statusCode = code;
      return vercelRes;
    },
    setHeader(name: string, value: string | number | string[]) {
      headers[name.toLowerCase()] = value;
      return vercelRes;
    },
    getHeader(name: string) {
      return headers[name.toLowerCase()];
    },
    json(data: unknown) {
      if (!res.headersSent) {
        res.statusCode = statusCode;
        for (const [name, value] of Object.entries(headers)) {
          res.setHeader(name, value);
        }
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(data));
      }
    },
    send(data: unknown) {
      if (!res.headersSent) {
        res.statusCode = statusCode;
        for (const [name, value] of Object.entries(headers)) {
          res.setHeader(name, value);
        }
        if (typeof data === 'object' && data !== null) {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(data));
        } else {
          res.end(String(data ?? ''));
        }
      }
    },
    end(data?: string) {
      if (!res.headersSent) {
        res.statusCode = statusCode;
        for (const [name, value] of Object.entries(headers)) {
          res.setHeader(name, value);
        }
        res.end(data);
      }
    },
  } as VercelResponse;

  return vercelRes;
}

async function runApiHandler(
  server: ViteDevServer,
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  const urlPath = (req.url ?? '').split('?')[0];
  const handlerFile = resolveHandlerFile(urlPath, server.config.root);

  if (!handlerFile) {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'API route not found' }));
    return;
  }

  const modulePath = path.relative(server.config.root, handlerFile).replace(/\\/g, '/');
  const mod = await server.ssrLoadModule(`/${modulePath}`);
  const handler = mod.default as (req: VercelRequest, res: VercelResponse) => Promise<void>;

  if (typeof handler !== 'function') {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Invalid API handler' }));
    return;
  }

  const vercelReq = await createVercelRequest(req);
  const vercelRes = createVercelResponse(res);
  await handler(vercelReq, vercelRes);
}

/**
 * Run Vercel-style /api handlers inside Vite dev so `npm run dev` is enough locally.
 */
export function crmApiDevPlugin(): Plugin {
  return {
    name: 'crm-api-dev',
    configureServer(server) {
      const env = loadEnv(server.config.mode, server.config.envDir || server.config.root, '');
      for (const [key, value] of Object.entries(env)) {
        if (process.env[key] === undefined) {
          process.env[key] = value;
        }
      }

      server.middlewares.use((req, res, next) => {
        const urlPath = (req.url ?? '').split('?')[0];
        if (!urlPath.startsWith('/api/')) {
          return next();
        }

        void runApiHandler(server, req, res).catch((err) => {
          console.error('[crm-api-dev]', err);
          if (!res.headersSent) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(
              JSON.stringify({
                error: err instanceof Error ? err.message : 'Internal server error',
              })
            );
          }
        });
      });
    },
  };
}
