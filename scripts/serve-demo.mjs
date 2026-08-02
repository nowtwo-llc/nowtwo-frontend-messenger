#!/usr/bin/env node
/**
 * Serves the repo root so the demo resolves ../dist/ exactly the way the
 * deployed GitHub Pages site does. Deliberately dependency-free.
 */
import { createServer } from 'node:http';
import { createReadStream, statSync } from 'node:fs';
import { join, extname, normalize } from 'node:path';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
// 5050 rather than 8080 (commonly taken by Docker) or 5000 (macOS AirPlay
// Receiver). Override with PORT=… if it clashes.
const PORT = Number(process.env.PORT) || 5050;

const CONTENT_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.cjs': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.map': 'application/json; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp'
};

createServer((req, res) => {
    const path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);

    // Redirect rather than serve the demo at "/", so the page's relative
    // ./main.js and ../dist/ URLs resolve from /example/ — matching how the
    // GitHub Pages redirect stub behaves.
    if (path === '/') {
        res.writeHead(302, { Location: '/example/' }).end();
        return;
    }

    // Keep traversal inside the repo root.
    const resolved = join(ROOT, normalize(path).replace(/^(\.\.[/\\])+/, ''));
    if (!resolved.startsWith(ROOT)) {
        res.writeHead(403).end('Forbidden');
        return;
    }

    try {
        if (statSync(resolved).isDirectory()) {
            res.writeHead(302, { Location: `${path.replace(/\/$/, '')}/index.html` }).end();
            return;
        }
    } catch {
        res.writeHead(404, { 'Content-Type': 'text/plain' }).end(`Not found: ${path}`);
        return;
    }

    res.writeHead(200, { 'Content-Type': CONTENT_TYPES[extname(resolved)] ?? 'application/octet-stream' });
    createReadStream(resolved).pipe(res);
}).listen(PORT, () => {
    console.log(`Frontend Messenger demo → http://localhost:${PORT}/`);
});
