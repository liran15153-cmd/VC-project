#!/usr/bin/env node

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const PUBLIC_ROOT = path.join(ROOT, 'public');
const NODE_MODULES_ROOT = path.join(ROOT, 'node_modules');
const PORT = Number(process.argv[2] || 5179);

const MIME_TYPES = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.webp', 'image/webp'],
  ['.svg', 'image/svg+xml'],
  ['.glb', 'model/gltf-binary'],
  ['.gltf', 'model/gltf+json'],
  ['.fbx', 'application/octet-stream'],
  ['.obj', 'text/plain; charset=utf-8'],
  ['.mtl', 'text/plain; charset=utf-8']
]);

http.createServer((request, response) => {
  const url = new URL(request.url || '/', `http://127.0.0.1:${PORT}`);
  const decodedPath = decodeURIComponent(url.pathname);
  const root = decodedPath.startsWith('/node_modules/') ? ROOT : PUBLIC_ROOT;
  const relative = decodedPath.startsWith('/node_modules/')
    ? decodedPath.slice(1)
    : decodedPath.replace(/^\/+/, '') || 'index.html';
  const filePath = path.resolve(root, relative);

  if (!isInside(filePath, root)) {
    response.writeHead(403);
    response.end('Forbidden');
    return;
  }

  const target = fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()
    ? path.join(filePath, 'index.html')
    : filePath;

  fs.readFile(target, (error, body) => {
    if (error) {
      response.writeHead(404);
      response.end('Not found');
      return;
    }

    response.writeHead(200, {
      'Content-Type': MIME_TYPES.get(path.extname(target).toLowerCase()) || 'application/octet-stream',
      'Cache-Control': 'no-store'
    });
    response.end(body);
  });
}).listen(PORT, '127.0.0.1', () => {
  console.log(`Serving LOOMIER public assets at http://127.0.0.1:${PORT}`);
});

function isInside(filePath, root) {
  const relative = path.relative(root, filePath);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}
