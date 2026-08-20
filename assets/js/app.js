/* ============================================================
   Z-DASH app — 路由 / 导航 / 主题 / 后端状态 / 快捷键
   ============================================================ */
const VIEWS = { todo: todoView, archive: archiveView, links: linksView };
const TABS = ['todo', 'archive', 'links'];

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
    led.style.background = 'var(--cyan)';
  } else {
    txt.textContent = 'SEED · 只读种子数据';
    led.style.background = 'var(--amber)';
  }
}

function toggleTheme() {
  const cur = document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
  const next = cur === 'light' ? 'dark' : 'light';
  document.documentElement.dataset.theme = next;
  localStorage.setItem('zdash:theme', next);
}

(function init() {
  // 主题（暗色默认）
  document.documentElement.dataset.theme = localStorage.getItem('zdash:theme') || 'dark';

  // 导航
  document.querySelectorAll('.nav-item, .mi').forEach(el => {
    el.onclick = () => { location.hash = '/' + el.dataset.tab; };
  });
  window.addEventListener('hashchange', route);

  // 侧边栏 / 移动端顶栏按钮
  document.getElementById('themeBtn').onclick = toggleTheme;
  document.getElementById('themeBtnM').onclick = toggleTheme;

  // 快捷键：N 新建任务（待办页 & 无弹层 & 非输入状态）
  document.addEventListener('keydown', e => {
    if (e.key !== 'n' && e.key !== 'N') return;
    const tag = document.activeElement && document.activeElement.tagName;
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
    if (!document.getElementById('modalMask').hidden) return;
    const h = location.hash.replace(/^#\/?/, '');
    if ((TABS.includes(h) ? h : 'todo') === 'todo') todoView.editModal(null);
  });

  // 启动：先载数据再渲染
  store.init().then(() => {
    updateFsStatus();
    route();
  });
})();
