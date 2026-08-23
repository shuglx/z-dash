/* ============================================================
   Z-DASH 桌面版入口 (Electron 主进程)
   1) 以 Node 子进程(utilityProcess)方式运行现有 server.js, 后端零改动复用
   2) 数据目录: userData (Linux: ~/.config/z-dash), 与 web 版数据完全隔离
   3) 窗口加载 http://127.0.0.1:<port>/
   ============================================================ */
'use strict';

const { app, BrowserWindow, Menu, utilityProcess, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const net = require('net');

const APP_ROOT = __dirname;                    // 打包后位于 app.asar 内(只读, 仅放静态资源)
const DATA_ROOT = app.getPath('userData');     // 可写数据根目录: data/ 与 data_backup/ 都在这里
const DATA_DIR = path.join(DATA_ROOT, 'data');
const BASE_PORT = 8390;                        // 固定起始端口: 保持 localStorage(主题等)跨启动稳定

let win = null;
let serverProc = null;
let quitting = false;

/* ---------- 单实例: 重复启动时唤起已有窗口 ---------- */
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (win) { if (win.isMinimized()) win.restore(); win.show(); win.focus(); }
  });
  app.whenReady().then(boot);
}

/* ---------- 从 BASE_PORT 起找一个可用端口(最多试 20 个) ---------- */
function findPort() {
  return new Promise((resolve, reject) => {
    let port = BASE_PORT;
    const tryOne = () => {
      const s = net.createServer();
      s.once('error', () => {
        if (++port - BASE_PORT >= 20) return reject(new Error('no free port'));
        tryOne();
      });
      s.listen(port, '127.0.0.1', () => s.close(() => resolve(port)));
    };
    tryOne();
  });
}

/* ---------- 首次启动: 写入空数据骨架 ----------
   前端 store.js 在所有 key 都 404 时会降级为只读种子模式(编辑不落盘),
   因此空白首启也必须先落盘空结构, 保证一打开就能正常增删改 */
function seedData() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const existing = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.json'));
  if (existing.length) return;
  const empty = {
    todos:   { version: 1, items: [] },
    archive: { version: 1, items: [] },
    weekly:  { version: 1, items: [] },
    links:   { version: 1, groups: [], items: [] },
    config:  { version: 1, theme: 'dark', pet: true },
  };
  for (const k of Object.keys(empty)) {
    fs.writeFileSync(path.join(DATA_DIR, k + '.json'), JSON.stringify(empty[k], null, 2));
  }
  console.log('[desktop] 首次启动, 已写入空数据 ->', DATA_DIR);
}

/* ---------- 启动内嵌 server.js (ZD_DATA_ROOT 指向用户数据目录) ---------- */
function startServer(port) {
  serverProc = utilityProcess.fork(path.join(APP_ROOT, 'server.js'), [String(port)], {
    env: Object.assign({}, process.env, { ZD_DATA_ROOT: DATA_ROOT }),
    stdio: 'pipe',
  });
  if (serverProc.stdout) serverProc.stdout.on('data', d => process.stdout.write('[server] ' + d));
  if (serverProc.stderr) serverProc.stderr.on('data', d => process.stderr.write('[server] ' + d));
  serverProc.on('exit', code => {
    serverProc = null;
    if (!quitting) console.error('[desktop] server 进程退出, code=' + code);
  });
}

/* ---------- 等待 server 就绪(端口可连) ---------- */
function waitServer(port, timeoutMs) {
  const deadline = Date.now() + (timeoutMs || 10000);
  return new Promise((resolve, reject) => {
    const tick = () => {
      const s = net.connect(port, '127.0.0.1');
      s.once('connect', () => { s.destroy(); resolve(); });
      s.once('error', () => {
        s.destroy();
        if (Date.now() > deadline) return reject(new Error('server 启动超时'));
        setTimeout(tick, 100);
      });
    };
    tick();
  });
}

/* ---------- 主流程 ---------- */
async function boot() {
  Menu.setApplicationMenu(null);
  try {
    seedData();
    const port = await findPort();
    startServer(port);
    await waitServer(port);
    win = new BrowserWindow({
      width: 1480,
      height: 1060,   // 初始高度加大 ~15%: 常见屏幕打开即全内容可见, 无垂直滚动条
      minWidth: 1024,
      minHeight: 640,
      backgroundColor: '#090c13',     // 与暗色主题背景一致, 防白闪
      title: 'Z-DASH',
      show: false,
      frame: false,                   // 无边框: 标题栏由前端自绘(拖拽区+窗口按钮)
      autoHideMenuBar: true,
      icon: path.join(APP_ROOT, 'icon.png'),   // 窗口/任务栏图标(Linux WM 需要)
      webPreferences: {
        preload: path.join(APP_ROOT, 'preload.js'),
      },
    });
    win.on('closed', () => { win = null; });

    /* ---------- 自绘标题栏的窗口控制 IPC ---------- */
    ipcMain.on('zd:win-min', () => { if (win) win.minimize(); });
    ipcMain.on('zd:win-max', () => { if (!win) return; win.isMaximized() ? win.unmaximize() : win.maximize(); });
    ipcMain.on('zd:win-close', () => { if (win) win.close(); });
    ipcMain.handle('zd:win-is-max', () => !!win && win.isMaximized());
    win.on('maximize', () => win.webContents.send('zd:max-changed', true));
    win.on('unmaximize', () => win.webContents.send('zd:max-changed', false));
    await win.loadURL('http://127.0.0.1:' + port + '/');
    // Windows 下任务栏图标取自 exe 内嵌资源(开发模式即 electron.exe 官方图标),
    // 构造参数 icon 会被忽略, 需运行时 setIcon 覆盖; Linux 打包版由 desktop entry 提供图标
    if (process.platform === 'win32') {
      try { win.setIcon(path.join(APP_ROOT, 'icon.png')); } catch (e) { /* 图标缺失不致命 */ }
    }
    win.show();
  } catch (e) {
    console.error('[desktop] 启动失败:', e);
    const { dialog } = require('electron');
    dialog.showErrorBox('Z-DASH 启动失败', String(e && e.message || e));
    app.quit();
  }
}

app.on('window-all-closed', () => app.quit());
app.on('before-quit', () => {
  quitting = true;
  if (serverProc) serverProc.kill();
});
