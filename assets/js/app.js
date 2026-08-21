/* ============================================================
   Z-DASH app — 路由 / 导航 / 主题 / 后端状态 / 快捷键
   ============================================================ */
const VIEWS = { stats: statsView, todo: todoView, archive: archiveView, weekly: weeklyView, tools: toolsView, links: linksView };
const TABS = ['stats', 'todo', 'archive', 'weekly', 'tools', 'links'];

function route() {
  let h = location.hash.replace(/^#\/?/, '');
  if (!TABS.includes(h)) h = 'todo';
  TABS.forEach(t => {
    const el = document.getElementById('view-' + t);
    if (el) el.hidden = t !== h;
  });
  document.querySelectorAll('.nav-item, .mi').forEach(el =>
    el.classList.toggle('on', el.dataset.tab === h));
  VIEWS[h].render();
  window.scrollTo(0, 0);
}

function updateFsStatus() {
  const txt = document.getElementById('fsStatusTxt');
  const led = document.getElementById('fsLed');
  if (!txt) return;
  if (store.mode === 'server') {
    txt.textContent = 'LIVE · 实时读写 data/';
  } else {
    txt.textContent = 'SEED · 只读种子数据';
  }
  led.style.background = 'var(--cp-red)';
}

function toggleTheme() {
  const next = document.documentElement.dataset.zdTheme === 'light' ? 'dark' : 'light';
  document.documentElement.dataset.zdTheme = next;
  try { localStorage.setItem('zd-theme', next); } catch (e) {}
  store.data.config.theme = next;
  store.save('config');
}

/* 从 config 应用主题 / 桌宠（config 来自 data/config.json, 暗色默认） */
function syncPetBtn() {
  const txt = pet.on ? '桌宠 ON' : '桌宠 OFF';
  const b1 = document.getElementById('petBtn'), b2 = document.getElementById('petBtnM');
  if (b1) b1.textContent = txt;
  if (b2) b2.textContent = pet.on ? '桌宠' : '桌宠×';
  b1 && b1.classList.toggle('ghost', !pet.on);
}

function applyConfig() {
  const cfg = store.data.config;
  let t = cfg.theme === 'light' ? 'light' : 'dark';
  // 本机主题记忆优先：预览窗口/代理缓存住旧 config 响应时也能保持上次主题
  try {
    const saved = localStorage.getItem('zd-theme');
    if (saved === 'light' || saved === 'dark') t = saved;
  } catch (e) {}
  // data-zd-theme：自定义属性, 避免被内嵌浏览器强制注入的 data-theme 覆盖
  document.documentElement.dataset.zdTheme = t;
  try { localStorage.setItem('zd-theme', t); } catch (e) {}
  if (cfg.pet !== false) pet.mount();
  syncPetBtn();
}

(function init() {
  // 主题：CSS :root 即暗色（无标记时天然暗色渲染）, 数据就绪后由 config 校正
  // 导航
  document.querySelectorAll('.nav-item, .mi').forEach(el => {
    el.onclick = () => { location.hash = '/' + el.dataset.tab; };
  });
  window.addEventListener('hashchange', route);

  // 侧边栏 / 移动端顶栏按钮
  document.getElementById('themeBtn').onclick = toggleTheme;
  document.getElementById('themeBtnM').onclick = toggleTheme;

  // 帮助按钮：快捷键与用法说明
  const helpBtn = document.getElementById('helpBtn');
  if (helpBtn) helpBtn.onclick = () => ui.view('HELP · 快捷键与用法', [
    { k: '快捷键', v: '' },
    { k: '  1 - 9', v: '切换页面（统计/待办/归档/周报/工具/链接）' },
    { k: '  N', v: '新建任务 / 条目' },
    { k: '  E', v: '编辑或查看鼠标 hover 的项' },
    { k: '  Esc', v: '关闭当前弹层' },
    { k: '待办事项', v: '' },
    { k: '  拖拽', v: '卡片拖到其他列切换状态' },
    { k: '  ← →', v: '卡片上的箭头按钮快捷切换状态' },
    { k: '  ARCHIVE', v: '已完成 TASK 归档进历史，联动 XP 升级和声望系统' },
    { k: '其他', v: '' },
    { k: '  桌宠', v: '点击有回应，可拖动；侧边栏「桌宠 开/关」切换' },
    { k: '  主题', v: '侧边栏「亮/暗切换」按钮' }
  ]);

  // 桌宠开关按钮（状态读写 config, applyConfig 里统一初始化）
  ['petBtn', 'petBtnM'].forEach(id => {
    const b = document.getElementById(id);
    if (b) b.onclick = () => {
      pet.toggle();
      store.data.config.pet = pet.on;
      store.save('config');
      syncPetBtn();
    };
  });

  // 快捷键：数字 1-9 切页 · E 编辑/查看鼠标 hover 项 · N 新建任务
  // （均要求：无弹层 & 焦点不在输入控件上 & 无修饰键）
  let hovEl = null;   // 最近 hover 的可操作项（任务卡/归档行/链接卡/周块）
  document.addEventListener('mouseover', e => {
    const t = e.target instanceof Element ? e.target : null;
    hovEl = t ? t.closest('.task, .arc-item, .lk[data-id], .wk-cell') : null;
  });
  const curTab = () => {
    const h = location.hash.replace(/^#\/?/, '');
    return TABS.includes(h) ? h : 'todo';
  };
  const editHovered = () => {
    // hover 元素可能已随视图切换失效（隐藏视图中的旧元素）
    if (!hovEl || !hovEl.isConnected || hovEl.closest('[hidden]')) return;
    const tab = curTab();
    if (tab === 'todo') {
      const t = store.data.todos.items.find(x => x.id === hovEl.dataset.id);
      if (t) todoView.editModal(t);
    } else if (tab === 'archive') {
      const it = store.data.archive.items.find(x => x.id === hovEl.dataset.id);
      if (it) archiveView.showDetail(it);
    } else if (tab === 'weekly') {
      if (hovEl.classList.contains('future')) { ui.toast('未来周不可填写', 'warn'); return; }
      weeklyView.openModal(weeklyView.state.year, Number(hovEl.dataset.w));
    } else if (tab === 'links') {
      const it = store.data.links.items.find(x => x.id === hovEl.dataset.id);
      if (it) linksView.linkModal(it);
    }
  };
  document.addEventListener('keydown', e => {
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    if (!document.getElementById('modalMask').hidden) return;
    const tag = document.activeElement && document.activeElement.tagName;
    const typing = tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA';
    if (typing) return;
    // 数字 1-9 → 切页
    if (e.key >= '1' && e.key <= '9') {
      const t = TABS[Number(e.key) - 1];
      if (t) location.hash = '/' + t;
      return;
    }
    // E → 编辑/查看当前 hover 项
    if (e.key === 'e' || e.key === 'E') return editHovered();
    // N → 新建任务（仅待办页）
    if (e.key === 'n' || e.key === 'N') {
      if (curTab() === 'todo') todoView.editModal(null);
    }
  });

  // 系统监控：3s 轮询 /api/sys 更新侧边栏 LED 条
  const setSm = (id, pct) => {
    const row = document.getElementById(id);
    if (!row) return;
    const v = row.querySelector('.v');
    const cells = row.querySelectorAll('.bar i');
    if (pct == null || isNaN(pct)) {
      row.className = 'sm-row alert';
      v.textContent = 'N/A';
      cells.forEach(c => c.className = '');
      return;
    }
    const on = Math.round(pct / 10);
    cells.forEach((c, i) => c.className = i < on ? 'on' : '');
    row.className = 'sm-row' + (pct >= 85 ? ' alert' : pct >= 60 ? ' warn' : '');
    v.textContent = pct + '%';
  };
  const pollSys = () => {
    fetch('api/sys').then(r => r.ok ? r.json() : null).then(d => {
      if (!d) throw new Error('no data');
      setSm('smCpu', d.cpu);
      setSm('smMem', d.mem ? d.mem.pct : null);
      setSm('smDisk', d.disk ? d.disk.pct : null);
    }).catch(() => {
      setSm('smCpu', null); setSm('smMem', null); setSm('smDisk', null);
    });
  };
  pollSys();
  setInterval(pollSys, 3000);

  // 启动：先载数据（含 config）再应用配置并渲染
  store.init().then(() => {
    updateFsStatus();
    applyConfig();
    xp.init();   // 街区声望: 写入零点锚点 + 渲染侧栏挂件
    route();
  });
})();
