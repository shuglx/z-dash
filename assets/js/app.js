/* ============================================================
   Z-DASH app — 路由 / 导航 / 主题 / 后端状态 / 快捷键
   ============================================================ */
const VIEWS = { todo: todoView, archive: archiveView, weekly: weeklyView, links: linksView };
const TABS = ['todo', 'archive', 'weekly', 'links'];

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

  // 快捷键：N 新建任务（待办页 & 无弹层 & 非输入状态）
  document.addEventListener('keydown', e => {
    if (e.key !== 'n' && e.key !== 'N') return;
    const tag = document.activeElement && document.activeElement.tagName;
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
    if (!document.getElementById('modalMask').hidden) return;
    const h = location.hash.replace(/^#\/?/, '');
    if ((TABS.includes(h) ? h : 'todo') === 'todo') todoView.editModal(null);
  });

  // 启动：先载数据（含 config）再应用配置并渲染
  store.init().then(() => {
    updateFsStatus();
    applyConfig();
    route();
  });
})();
