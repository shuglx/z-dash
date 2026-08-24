/* ============================================================
   Z-DASH 桌面版 preload
   1) 往 <html> 打 data-zd-desktop 标记（+ 折叠状态记忆）:
      CSS/JS 据此启用桌面分支, web 版无标记一切照旧
   2) contextBridge 暴露最小窗口控制 API（保持 contextIsolation 安全默认）
   ============================================================ */
'use strict';
const { contextBridge, ipcRenderer } = require('electron');

const mark = () => {
  const de = document.documentElement;
  de.dataset.zdDesktop = '1';
  try { if (localStorage.getItem('zd-side') === 'fold') de.dataset.zdSide = 'fold'; } catch (e) {}
};
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mark);
else mark();

contextBridge.exposeInMainWorld('zdDesktop', {
  minimize: () => ipcRenderer.send('zd:win-min'),
  toggleMaximize: () => ipcRenderer.send('zd:win-max'),
  close: () => ipcRenderer.send('zd:win-close'),
  isMaximized: () => ipcRenderer.invoke('zd:win-is-max'),
  onMaximizeChanged: cb => {
    const h = (_e, v) => cb(v);
    ipcRenderer.on('zd:max-changed', h);
  },
  // 置顶开关（标题栏按钮 / 托盘菜单共用）
  toggleTop: () => ipcRenderer.send('zd:win-top'),
  isAlwaysOnTop: () => ipcRenderer.invoke('zd:win-is-top'),
  onTopChanged: cb => {
    const h = (_e, v) => cb(v);
    ipcRenderer.on('zd:top-changed', h);
  },
  // 链接 → 系统默认程序打开（浏览器/文件管理器）
  openExternal: url => ipcRenderer.send('zd:open-external', url),
  // 主题/桌宠状态回推（托盘菜单勾选）
  uiState: s => ipcRenderer.send('zd:ui-state', s),
  // 托盘菜单切换主题/桌宠 → 通知渲染进程（复用页面按钮逻辑）
  onTrayToggle: cb => {
    const h = (_e, kind) => cb(kind);
    ipcRenderer.on('zd:tray-toggle', h);
  }
});
