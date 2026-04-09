const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
};

function safeFileUnderRoot(root, pathname) {
  const rootAbs = path.resolve(root);
  const rel = pathname.replace(/^\/+/, '');
  const joined = path.resolve(rootAbs, rel);
  const relCheck = path.relative(rootAbs, joined);
  if (relCheck.startsWith('..') || path.isAbsolute(relCheck)) {
    return null;
  }
  return joined;
}

/**
 * Serves the Vite `www/` folder over loopback HTTP so the renderer has a
 * proper origin (secure context, WebSocket/CSP behave like a normal site).
 * `file://` breaks noVNC / modules in many Electron setups.
 */
function createWwwServer(wwwRoot) {
  const root = path.resolve(wwwRoot);

  const server = http.createServer((req, res) => {
    try {
      const u = new URL(req.url || '/', 'http://127.0.0.1');
      let pathname = u.pathname;
      if (pathname === '/') pathname = '/index.html';

      const candidate = safeFileUnderRoot(root, pathname);
      if (!candidate) {
        res.writeHead(403);
        res.end();
        return;
      }

      const sendFile = (filePath) => {
        const ext = path.extname(filePath);
        res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
        fs.createReadStream(filePath).pipe(res);
      };

      fs.stat(candidate, (err, st) => {
        if (!err && st.isFile()) {
          sendFile(candidate);
          return;
        }
        if (!err && st.isDirectory()) {
          const idx = path.join(candidate, 'index.html');
          fs.stat(idx, (e2, st2) => {
            if (!e2 && st2.isFile()) {
              sendFile(idx);
            } else if (pathname.startsWith('/assets/')) {
              res.writeHead(404);
              res.end();
            } else {
              const fb = path.join(root, 'index.html');
              sendFile(fb);
            }
          });
          return;
        }
        if (pathname.startsWith('/assets/')) {
          res.writeHead(404);
          res.end();
          return;
        }
        const fb = path.join(root, 'index.html');
        fs.stat(fb, (e3, st3) => {
          if (!e3 && st3.isFile()) {
            sendFile(fb);
          } else {
            res.writeHead(404);
            res.end();
          }
        });
      });
    } catch {
      res.writeHead(500);
      res.end();
    }
  });

  return new Promise((resolve, reject) => {
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      resolve({ server, url: `http://127.0.0.1:${port}/` });
    });
    server.on('error', reject);
  });
}

module.exports = { createWwwServer };
