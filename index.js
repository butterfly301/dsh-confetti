import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const localRequire = createRequire(import.meta.url);
const hostRoot = process.env.DSH_INSTALL_DIR
  ?? (process.resourcesPath && join(process.resourcesPath, 'app.asar', 'dsh', 'node_modules', '@deepseek-ai', 'dsh'));
function loadSchemastery() {
  try {
    return hostRoot
      ? createRequire(join(hostRoot, 'package.json'))('@deepseek-ai/schemastery')
      : localRequire('@deepseek-ai/schemastery');
  } catch (err) {
    if (err?.code !== 'MODULE_NOT_FOUND' || !String(err.message).includes('@deepseek-ai/schemastery')) {
      throw err;
    }
    const chain = () => ({ default: chain, min: chain, max: chain, pattern: chain, volatile: chain });
    return { object: chain, string: chain, number: chain, boolean: chain, array: chain, dict: chain, union: chain, const: chain };
  }
}
const schemastery = loadSchemastery();
const z = schemastery.default ?? schemastery;

const ROUTE = '/confetti/vendor/confetti.browser.js';
const VENDOR_PATH = resolve(fileURLToPath(new URL('./vendor/confetti.browser.js', import.meta.url)));

const pack = z.object({
  colors: z.array(z.string()).default(['#f5c542', '#ffd966', '#ff6b6b', '#4ecdc4', '#ffffff']),
  particleCount: z.number().min(10).max(400).default(85),
  spread: z.number().min(10).max(180).default(72),
  originY: z.number().min(0).max(1).default(0.65),
});

export const Config = z.object({
  pack: z.union([z.const(false), pack]).default(false).volatile(),
});

export function apply(ctx) {
  ctx.inject(['settings'], (scope) => scope.effect(
    () => scope.settings.configure({ auto: false }, ctx.fiber),
  ));

  ctx.inject(['webServer'], (scope) => scope.effect(() => {
    let cached = null;
    return scope.webServer.register({
      kind: 'prefix',
      path: ROUTE,
      handler: async (req, res) => {
        if (req.method !== 'GET' && req.method !== 'HEAD') {
          res.writeHead(405, { 'x-content-type-options': 'nosniff' });
          res.end();
          return;
        }
        let url;
        try {
          url = new URL(req.url ?? ROUTE, 'http://dsh.local');
        } catch {
          res.writeHead(400, { 'x-content-type-options': 'nosniff' });
          res.end();
          return;
        }
        if (url.pathname !== ROUTE) {
          res.writeHead(404, { 'x-content-type-options': 'nosniff' });
          res.end();
          return;
        }
        if (!cached) {
          try {
            cached = await readFile(VENDOR_PATH);
          } catch {
            res.writeHead(500, { 'x-content-type-options': 'nosniff' });
            res.end();
            return;
          }
        }
        res.writeHead(200, {
          'x-content-type-options': 'nosniff',
          'cache-control': 'public, max-age=3600',
          'content-length': String(cached.byteLength),
          'content-type': 'text/javascript; charset=utf-8',
        });
        res.end(req.method === 'HEAD' ? undefined : cached);
      },
    });
  }, 'dsh-confetti: vendor script'));
}
