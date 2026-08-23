/* ============================================================
   Z-DASH desktop — Electron 桌面版增强（web 版自动跳过）
   依赖 preload 注入的 window.zdDesktop 与 <html data-zd-desktop> 标记
   1) 自绘标题栏: 窗口控制(最小化/最大化/关闭) + 最大化状态同步 + 钉在最前
   2) 侧边栏折叠/展开（localStorage['zd-side'] 记忆）
   3) 全局搜索: 待办 + 归档（标题/描述/项目）, 点击跳转打开对应弹窗
   4) 托盘联动: 托盘菜单切换主题/桌宠 → 复用页面按钮; 状态回推刷新托盘勾选
   ============================================================ */
(function () {
  if (!window.zdDesktop) return;   // web 版: 无此对象, 全部功能不启用
  const html = document.documentElement;
  const $ = id => document.getElementById(id);

  /* ---------- 窗口控制 ---------- */
  const maxBtn = $('tbMaxBtn');
  const setMaxIcon = max => { maxBtn.textContent = max ? '▣' : '□'; };
  $('tbMinBtn').onclick = () => zdDesktop.minimize();
  maxBtn.onclick = () => zdDesktop.toggleMaximize();
  $('tbCloseBtn').onclick = () => zdDesktop.close();
  zdDesktop.isMaximized().then(setMaxIcon);
  zdDesktop.onMaximizeChanged(setMaxIcon);

  /* ---------- 钉在最前（标题栏按钮, 与托盘菜单双向同步） ---------- */
  const topBtn = $('tbTopBtn');
  const setTopIcon = on => { topBtn.classList.toggle('on', !!on); };
  topBtn.onclick = () => zdDesktop.toggleTop();
  zdDesktop.isAlwaysOnTop().then(setTopIcon);
  zdDesktop.onTopChanged(setTopIcon);

  /* ---------- 托盘菜单联动: 切换主题/桌宠 → 复用页面按钮逻辑（含状态落盘） ---------- */
  zdDesktop.onTrayToggle(kind => {
    const btn = $(kind === 'theme' ? 'themeBtn' : 'petBtn');
    if (btn) btn.click();
  });
  // app.js 在主题/桌宠初始化与每次切换后调用, 把最新状态推给主进程刷新托盘勾选
  window.__zdSyncTray = () => {
    zdDesktop.uiState({ theme: html.dataset.zdTheme === 'light' ? 'light' : 'dark', pet: !!pet.on });
  };

  /* ---------- 帮助按钮: 与 Q 键共用 app.js 的帮助弹窗 ---------- */
  $('tbHelpBtn').onclick = () => {
    if (window.__zdShowHelp) window.__zdShowHelp();
  };

  /* ---------- 侧边栏隐藏/显示 ---------- */
  const sideBtn = $('tbSideBtn');
  const applySide = fold => {
    if (fold) html.dataset.zdSide = 'fold';
    else delete html.dataset.zdSide;
    try { localStorage.setItem('zd-side', fold ? 'fold' : 'open'); } catch (e) {}
    sideBtn.title = fold ? '显示侧边栏' : '隐藏侧边栏';
    sideBtn.classList.toggle('folded', fold);   // 折叠态: 图标竖线靠右(内容区展开语义)
  };
  sideBtn.onclick = () => applySide(html.dataset.zdSide !== 'fold');
  applySide(localStorage.getItem('zd-side') === 'fold');

  /* ---------- 全局搜索: 待办 + 归档 ---------- */
  const hit = (it, q) => ['title', 'desc', 'project'].some(f =>
    String(it[f] || '').toLowerCase().includes(q));

  function renderResults(listEl, q) {
    q = q.trim().toLowerCase();
    if (!q) {
      listEl.innerHTML = '<div class="sch-empty">[ 输入关键词 · 搜索待办与归档 ]</div>';
      return;
    }
    const todos = store.data.todos.items.filter(t => hit(t, q)).slice(0, 8);
    const arcs = store.data.archive.items.filter(a => hit(a, q)).slice(0, 8);
    if (!todos.length && !arcs.length) {
      listEl.innerHTML = '<div class="sch-empty">[ 无匹配 ]</div>';
      return;
    }
    let h = '';
    if (todos.length) {
      h += '<div class="sch-group">TODO · 待办</div>' + todos.map(t =>
        `<div class="sch-row" data-kind="todo" data-id="${ui.esc(t.id)}">` +
        `<span class="m">${ui.esc(t.priority || '')}</span>` +
        `<span class="t">${ui.esc(t.title)}</span>` +
        `<span class="m">${ui.esc(ui.fmtMD(t.dueDate) || t.status || '')}</span></div>`).join('');
    }
    if (arcs.length) {
      h += '<div class="sch-group">ARCHIVE · 归档</div>' + arcs.map(a =>
        `<div class="sch-row" data-kind="arc" data-id="${ui.esc(a.id)}">` +
        `<span class="m">${ui.esc(a.priority || '')}</span>` +
        `<span class="t">${ui.esc(a.title)}</span>` +
        `<span class="m">${ui.esc(ui.fmtMD(a.doneAt))}</span></div>`).join('');
    }
    listEl.innerHTML = h;
  }

  /* 跳转: 切页 + 打开对应弹窗（待办→编辑弹窗, 归档→详情弹窗） */
  function jump(kind, id) {
    ui.close();
    if (kind === 'todo') {
      const t = store.data.todos.items.find(x => x.id === id);
      if (!t) return;
      location.hash = '/todo';
      route();                      // 立即渲染目标视图（hashchange 稍后触发再渲染一次, 无害）
      todoView.editModal(t);
    } else {
      const a = store.data.archive.items.find(x => x.id === id);
      if (!a) return;
      location.hash = '/archive';
      route();
      archiveView.showDetail(a);
    }
  }

  $('tbSearchBtn').onclick = () => {
    ui._open(`
      <div class="m-h">SEARCH · 待办 / 归档</div>
      <div class="m-b">
        <div class="sch-bar"><input class="ipt" id="schIpt" type="text" placeholder="标题 / 描述 / 项目 …" autocomplete="off"></div>
        <div class="sch-list" id="schList"></div>
      </div>
      <div class="m-f">
        <span class="sch-hint">ENTER 跳转首个 · ESC 关闭</span>
        <button type="button" class="btn ghost" data-x>CLOSE</button>
      </div>`);
    ui._box.querySelector('[data-x]').onclick = () => ui.close();
    const ipt = document.getElementById('schIpt');
    const listEl = document.getElementById('schList');
    renderResults(listEl, '');
    ipt.addEventListener('input', () => renderResults(listEl, ipt.value));
    ipt.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        const first = listEl.querySelector('.sch-row');
        if (first) jump(first.dataset.kind, first.dataset.id);
      }
    });
    listEl.addEventListener('click', e => {
      const row = e.target.closest('.sch-row');
      if (row) jump(row.dataset.kind, row.dataset.id);
    });
    setTimeout(() => ipt.focus(), 0);   // 项目惯例: 延迟聚焦, 避免吞字符
  };

  /* ---------- 桌面版专属快捷键: W 侧边栏 / S 搜索 ----------
     与 app.js 全局键约束一致: 无修饰键 & 焦点不在输入控件;
     弹层已开时 W/S 不抢键（S 在搜索弹层内继续输入） */
  document.addEventListener('keydown', e => {
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    if (!document.getElementById('modalMask').hidden) return;
    const tag = document.activeElement && document.activeElement.tagName;
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
    const k = e.key.toLowerCase();
    if (k === 'w') $('tbSideBtn').click();
    else if (k === 's') $('tbSearchBtn').click();
  });
})();
