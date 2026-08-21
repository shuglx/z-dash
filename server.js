#!/usr/bin/env node
/* ============================================================
   Z-DASH 极简后端 (Node 18+, 零第三方依赖)
   1) 静态文件服务  ->  index.html / assets/...  (供页面访问)
   2) JSON 实时读写  ->  GET/PUT /api/<key>  <==>  data/<key>.json
        GET /api/todos   ->  返回 data/todos.json 内容
        PUT /api/todos   ->  请求体写入 data/todos.json
   用法:  node server.js [端口]   # 默认 8000
   ============================================================ */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const KEYS = new Set(['todos', 'archive', 'weekly', 'links', 'config']);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.webm': 'video/webm',
};

function parseApiKey(url) {
  const p = url.pathname;
  if (!p.startsWith('/api/')) return null;
  const key = p.slice('/api/'.length);
  return KEYS.has(key) ? key : null;
}

function send(res, code, type, body) {
  res.writeHead(code, {
    'Content-Type': type,
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function sendJson(res, code, obj) {
  send(res, code, 'application/json; charset=utf-8', JSON.stringify(obj));
}

/* ---------- 静态文件 ---------- */
function serveStatic(req, res, pathname) {
  let file = pathname === '/' ? '/index.html' : pathname;
  const fp = path.normalize(path.join(ROOT, file));
  // 防目录逃逸
  if (!fp.startsWith(ROOT)) return send(res, 403, 'text/plain', 'Forbidden');
  fs.stat(fp, (err, st) => {
    if (err) return send(res, 404, 'text/plain', 'Not Found');
    if (st.isDirectory()) {
      const idx = path.join(fp, 'index.html');
      return fs.stat(idx, (e2, st2) => {
        if (!e2 && st2.isFile()) return streamFile(res, idx);
        send(res, 403, 'text/plain', 'Directory listing not allowed');
      });
    }
    streamFile(res, fp);
  });
}

function streamFile(res, fp) {
  const ext = path.extname(fp).toLowerCase();
  res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
  fs.createReadStream(fp).pipe(res);
}

/* ---------- 请求体 ---------- */
function readBody(req, cb) {
  const chunks = [];
  let size = 0;
  req.on('data', c => { chunks.push(c); size += c.length; });
  req.on('end', () => cb(null, Buffer.concat(chunks, size).toString('utf8')));
  req.on('error', cb);
}

/* ---------- 服务器 ---------- */
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const key = parseApiKey(url);

  if (req.method === 'GET' && key) {
    const fp = path.join(DATA_DIR, key + '.json');
    return fs.readFile(fp, 'utf8', (err, data) => {
      if (err) return sendJson(res, 404, { error: key + '.json not found' });
      send(res, 200, 'application/json; charset=utf-8', data);
    });
  }

  if (req.method === 'PUT' && key) {
    return readBody(req, (err, body) => {
      if (err || !body) return sendJson(res, 400, { error: 'empty body' });
      try { JSON.parse(body); } catch (e) { return sendJson(res, 400, { error: 'invalid JSON' }); }
      const fp = path.join(DATA_DIR, key + '.json');
      const tmp = fp + '.tmp';
      fs.writeFile(tmp, body, err2 => {
        if (err2) return sendJson(res, 500, { error: 'write failed' });
        fs.rename(tmp, fp, err3 => {   // 原子替换
          if (err3) return sendJson(res, 500, { error: 'write failed' });
          sendJson(res, 200, { ok: true, key });
        });
      });
    });
  }

  if (req.method === 'GET' || req.method === 'HEAD') {
    return serveStatic(req, res, decodeURIComponent(url.pathname));
  }

  sendJson(res, 405, { error: 'method not allowed' });
});

const PORT = Number(process.argv[2]) || 8000;
server.listen(PORT, () => {
  console.log(`Z-DASH server  ->  http://localhost:${PORT}/`);
  console.log(`data dir       ->  ${DATA_DIR}`);
});
