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
const os = require('os');
const zlib = require('zlib');

const ROOT = __dirname;
// 桌面版(Electron)通过环境变量 ZD_DATA_ROOT 把可写数据目录指向用户主目录; web 模式不受影响
const DATA_BASE = process.env.ZD_DATA_ROOT || ROOT;
const DATA_DIR = path.join(DATA_BASE, 'data');
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

/* ---------- 版本/构建信息: package.json + build-info.json（桌面打包版在根目录, web 版在 build/）, 注入 index.html ---------- */
function readAppInfo() {
  let ver = '', build = '';
  for (const p of [path.join(ROOT, 'package.json'), path.join(ROOT, 'build', 'package.json')]) {
    try { ver = 'v' + JSON.parse(fs.readFileSync(p, 'utf8')).version; break; } catch (e) {}
  }
  for (const p of [path.join(ROOT, 'build-info.json'), path.join(ROOT, 'build', 'build-info.json')]) {
    try { build = JSON.parse(fs.readFileSync(p, 'utf8')).date || ''; break; } catch (e) {}
  }
  return { ver, build };
}
const APP_INFO = readAppInfo();

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
  // index.html: 读入内存把 {{VER}}/{{BUILD}} 替换为当前版本/构建日期（侧栏角标 + 关于弹框）, 其余文件照常流式
  if (path.basename(fp) === 'index.html') {
    return fs.readFile(fp, 'utf8', (err, html) => {
      if (err) return send(res, 404, 'text/plain', 'Not Found');
      send(res, 200, 'text/html; charset=utf-8',
        html.replace(/\{\{VER\}\}/g, APP_INFO.ver).replace(/\{\{BUILD\}\}/g, APP_INFO.build));
    });
  }
  // no-store: 静态资源不缓存（含嵌入式预览窗/代理), 避免拿到旧版 JS/CSS
  res.writeHead(200, {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'Cache-Control': 'no-store',
  });
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

/* ---------- 系统监控：每秒采样 CPU 占用（跨平台, 供 /api/sys） ---------- */
let cpuPct = 0;
let cpuPrev = os.cpus().map(c => c.times);
setInterval(() => {
  const cur = os.cpus().map(c => c.times);
  let idle = 0, total = 0;
  cur.forEach((t, i) => {
    const p = cpuPrev[i] || t;
    const dIdle = t.idle - p.idle;
    const dTotal = (t.user - p.user) + (t.nice - p.nice) + (t.sys - p.sys) + (t.irq - p.irq) + dIdle;
    idle += dIdle; total += dTotal;
  });
  cpuPrev = cur;
  if (total > 0) cpuPct = Math.max(0, Math.min(100, Math.round((1 - idle / total) * 100)));
}, 1000);

/* ---------- 自动备份：每天 00:01 打包 data/ -> data_backup/*.tar.gz ----------
   程序运行中才触发（错过不补跑）; 保留数读 config.json 的 backupKeep（默认 7） */
const BACKUP_DIR = path.join(DATA_BASE, 'data_backup');
const pad2 = n => String(n).padStart(2, '0');
const stampStr = d => `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}-${pad2(d.getHours())}${pad2(d.getMinutes())}${pad2(d.getSeconds())}`;

// 极简 tar（仅普通文件）+ gzip, 零依赖
function tarGzip(files) {
  const header = (name, size, mtime) => {
    const h = Buffer.alloc(512);
    h.write(name.slice(0, 99), 0);
    h.write('0000644\0', 100);                                   // mode
    h.write('0000000\0', 108);                                   // uid
    h.write('0000000\0', 116);                                   // gid
    h.write(size.toString(8).padStart(11, '0') + '\0', 124);     // size
    h.write(Math.floor(mtime / 1000).toString(8).padStart(11, '0') + '\0', 136); // mtime
    h.write('        ', 148);                                    // chksum 先置空格
    h.write('0', 156);                                           // typeflag: 普通文件
    h.write('ustar\0', 257);                                     // magic
    h.write('00', 263);                                          // version
    let sum = 0;
    for (const b of h) sum += b;
    h.write(sum.toString(8).padStart(6, '0') + '\0 ', 148);      // 实际校验和
    return h;
  };
  const chunks = [];
  for (const f of files) {
    chunks.push(header(f.name, f.data.length, f.mtime));
    chunks.push(f.data);
    const pad = (512 - (f.data.length % 512)) % 512;
    if (pad) chunks.push(Buffer.alloc(pad));
  }
  chunks.push(Buffer.alloc(1024));   // 结尾两个空块
  return zlib.gzipSync(Buffer.concat(chunks));
}

function readBackupKeep() {
  try {
    const cfg = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'config.json'), 'utf8'));
    return Math.max(1, Number(cfg.backupKeep) || 7);
  } catch (e) { return 7; }
}

function runBackup() {
  try {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    const files = fs.readdirSync(DATA_DIR)
      .filter(f => f.endsWith('.json'))
      .map(f => {
        const fp = path.join(DATA_DIR, f);
        return { name: 'data/' + f, data: fs.readFileSync(fp), mtime: fs.statSync(fp).mtimeMs };
      });
    if (!files.length) return console.log('[backup] data/ 为空, 跳过');
    const gz = tarGzip(files);
    const file = path.join(BACKUP_DIR, `z-dash-backup-${stampStr(new Date())}.tar.gz`);
    fs.writeFileSync(file, gz);
    console.log(`[backup] 已备份 -> ${path.basename(file)} (${(gz.length / 1024).toFixed(1)} KB, ${files.length} 个文件)`);

    // 超出保留数时删最旧
    const keep = readBackupKeep();
    const olds = fs.readdirSync(BACKUP_DIR)
      .filter(f => /^z-dash-backup-.*\.tar\.gz$/.test(f))
      .sort();
    while (olds.length > keep) {
      const del = olds.shift();
      fs.unlinkSync(path.join(BACKUP_DIR, del));
      console.log(`[backup] 超出保留数 ${keep}, 删除最旧: ${del}`);
    }
  } catch (e) {
    console.error('[backup] 备份失败:', e.message);
  }
}

// 计算到下一次 00:01 的毫秒数并调度
function scheduleBackup() {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 1, 0, 0);
  setTimeout(() => { runBackup(); scheduleBackup(); }, next - now);
  console.log(`[backup] 下次备份: ${pad2(next.getMonth() + 1)}-${pad2(next.getDate())} 00:01`);
}

// 手动立即备份:  node server.js --backup-now
if (process.argv.includes('--backup-now')) {
  runBackup();
  process.exit(0);
}

/* ---------- 服务器 ---------- */
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const key = parseApiKey(url);

  // 系统监控（独立于 data/*.json）
  if (req.method === 'GET' && url.pathname === '/api/sys') {
    const memTotal = os.totalmem(), memFree = os.freemem();
    const body = {
      cpu: cpuPct,
      mem: { total: memTotal, free: memFree, pct: Math.round((1 - memFree / memTotal) * 100) },
      uptime: os.uptime(),
      disk: null
    };
    const done = () => sendJson(res, 200, body);
    if (typeof fs.statfs === 'function') {
      // 磁盘采样跟随数据目录(桌面版数据在用户主目录); web 模式与原行为一致
      fs.statfs(fs.existsSync(DATA_DIR) ? DATA_DIR : ROOT, (err, st) => {
        if (!err && st && st.blocks > 0) {
          const used = st.blocks - st.bfree;
          body.disk = {
            total: st.blocks * st.bsize,
            free: st.bfree * st.bsize,
            pct: Math.round(used / st.blocks * 100)
          };
        }
        done();
      });
    } else done();
    return;
  }

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
  fs.mkdirSync(DATA_DIR, { recursive: true });   // 桌面版: 数据目录可能尚不存在; web 模式为空操作
  console.log(`Z-DASH server  ->  http://localhost:${PORT}/`);
  console.log(`data dir       ->  ${DATA_DIR}`);
  scheduleBackup();
});
