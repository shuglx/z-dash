/* ============================================================
   Z-DASH 桌面版入口 (Electron 主进程)
   1) 以 Node 子进程(utilityProcess)方式运行现有 server.js, 后端零改动复用
   2) 数据目录: userData (Linux: ~/.config/z-dash), 与 web 版数据完全隔离
   3) 窗口加载 http://127.0.0.1:<port>/
   ============================================================ */
'use strict';

const { app, BrowserWindow, Menu, Tray, nativeImage, Notification, utilityProcess, ipcMain, shell } = require('electron');
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
let tray = null;
let uiState = { theme: 'dark', pet: true };   // 渲染进程同步来的主题/桌宠状态（托盘菜单勾选）

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

/* ---------- 置顶: 标题栏按钮 / 托盘菜单共用 ---------- */
function setTop(on) {
  if (!win) return;
  win.setAlwaysOnTop(on);
  win.webContents.send('zd:top-changed', on);
  refreshTray();
}

/* ---------- 托盘 ---------- */
function showWin() {
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}

function refreshTray() { if (tray) tray.setContextMenu(buildTrayMenu()); }

function buildTrayMenu() {
  // 开关项用 checkbox（开启打钩）/ 桌宠选择用 radio 子菜单（互斥选中）,
  // 点击 → 执行切换 → refreshTray() 按真实状态重建菜单; 退出为普通动作按钮
  const petOn = !!uiState.pet;
  return Menu.buildFromTemplate([
    { label: '显示窗口', type: 'checkbox', checked: !!win && win.isVisible() && !win.isMinimized(),
      click: () => { showWin(); refreshTray(); } },
    { label: '开启置顶', type: 'checkbox', checked: !!win && win.isAlwaysOnTop(),
      click: () => setTop(!win.isAlwaysOnTop()) },
    { label: '暗色模式', type: 'checkbox', checked: uiState.theme !== 'light',
      click: () => win && win.webContents.send('zd:tray-toggle', 'theme') },
    { label: '桌宠选择', submenu: [
      { label: '鲸鱼娘', type: 'radio', checked: petOn,
        click: () => { if (!petOn) win && win.webContents.send('zd:tray-toggle', 'pet'); } },
      { label: '关闭', type: 'radio', checked: !petOn,
        click: () => { if (petOn) win && win.webContents.send('zd:tray-toggle', 'pet'); } },
    ] },
    { type: 'separator' },
    { label: '退出', click: () => app.quit() }
  ]);
}

function createTray() {
  const img = nativeImage.createFromPath(path.join(APP_ROOT, 'icon.png')).resize({ width: 22, height: 22 });
  tray = new Tray(img);
  tray.setToolTip('Z-DASH');
  tray.setContextMenu(buildTrayMenu());
  tray.on('click', () => showWin());   // 左键单击唤起窗口（右键弹菜单, Linux 部分桌面也把左键映射到菜单）
}

/* ---------- 主流程 ---------- */
async function boot() {
  Menu.setApplicationMenu(null);
  if (process.platform === 'win32') app.setAppUserModelId('local.ryan.zdash');   // Windows 通知身份
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
    /* 窗口显隐变化 → 刷新托盘菜单「显示窗口」勾选态 */
    ['show', 'hide', 'minimize', 'restore'].forEach(ev => win.on(ev, () => refreshTray()));

    /* ---------- 置顶开关 IPC（标题栏按钮 / 托盘菜单共用 setTop） ---------- */
    ipcMain.on('zd:win-top', () => { if (win) setTop(!win.isAlwaysOnTop()); });
    ipcMain.handle('zd:win-is-top', () => !!win && win.isAlwaysOnTop());

    /* ---------- 链接用系统默认程序打开（浏览器/文件管理器, smb:// 等协议依赖此路径） ---------- */
    ipcMain.on('zd:open-external', (_e, url) => {
      if (typeof url === 'string' && /^[a-z][a-z0-9+.-]*:/i.test(url)) shell.openExternal(url);
    });

    /* ---------- 渲染进程回推主题/桌宠状态 → 刷新托盘菜单勾选 ---------- */
    ipcMain.on('zd:ui-state', (_e, s) => {
      if (!s || typeof s !== 'object') return;
      if (s.theme === 'light' || s.theme === 'dark') uiState.theme = s.theme;
      if (typeof s.pet === 'boolean') uiState.pet = s.pet;
      refreshTray();
    });

    /* ---------- 关闭 → 隐藏到托盘（常驻）; 真正退出走托盘菜单/quit ---------- */
    let trayNotified = false;
    win.on('close', e => {
      if (quitting) return;
      e.preventDefault();
      win.hide();
      if (!trayNotified && Notification.isSupported()) {
        trayNotified = true;   // 每次运行仅首次提示, 避免打扰
        new Notification({ title: 'Z-DASH', body: '已最小化到托盘，右键托盘图标可退出' }).show();
      }
    });
    await win.loadURL('http://127.0.0.1:' + port + '/');
    // Windows 下任务栏图标取自 exe 内嵌资源(开发模式即 electron.exe 官方图标),
    // 构造参数 icon 会被忽略, 需运行时 setIcon 覆盖; Linux 打包版由 desktop entry 提供图标
    if (process.platform === 'win32') {
      try { win.setIcon(path.join(APP_ROOT, 'icon.png')); } catch (e) { /* 图标缺失不致命 */ }
    }
    win.show();
    try { createTray(); } catch (e) { console.error('[desktop] 托盘创建失败:', e); }
  } catch (e) {
    console.error('[desktop] 启动失败:', e);
    const { dialog } = require('electron');
    dialog.showErrorBox('Z-DASH 启动失败', String(e && e.message || e));
    app.quit();
  }
}

/* 托盘常驻: 窗口全关也不退出（仅当托盘不可用时才回退为退出, 避免无入口僵死） */
app.on('window-all-closed', () => { if (!tray) app.quit(); });
app.on('before-quit', () => {
  quitting = true;
  if (tray) { tray.destroy(); tray = null; }
  if (serverProc) serverProc.kill();
});
