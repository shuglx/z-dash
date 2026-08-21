/* ============================================================
   Z-DASH 数据统计 — KPI / 完成热力图 / 项目分布 / 周趋势
   数据源: archive(按 doneAt) + todos, 纯前端计算不落盘
   ============================================================ */
const statsView = {
  render() {
    const el = document.getElementById('view-stats');
    const arcs = store.data.archive.items;
    const todos = store.data.todos.items;

    // ---------- KPI ----------
    const mon = this.curMonday();
    const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
    const weekStart = this.dstr(mon), weekEnd = this.dstr(sun);
    const doneThisWeek = arcs.filter(a => {
      const d = (a.doneAt || '').slice(0, 10);
      return d >= weekStart && d <= weekEnd;
    }).length;
    const active = todos.filter(t => t.status !== 'done').length;
    const projects = new Set([...arcs, ...todos]
      .map(x => (x.project || '').trim()).filter(Boolean)).size;

    el.innerHTML = `
      <div class="topbar">
        <div class="crumb"><span class="sys">SYS://</span><b>STATS</b> &gt; ANALYTICS · ${arcs.length} RECORDS<span class="cur">/</span></div>
      </div>
      <div class="kpi-grid">
        <div class="kpi"><div class="v">${arcs.length}</div><div class="l">累计归档 / ARCHIVED</div></div>
        <div class="kpi"><div class="v">${doneThisWeek}</div><div class="l">本周完成 / THIS WEEK</div></div>
        <div class="kpi"><div class="v">${active}</div><div class="l">进行中 / ACTIVE</div></div>
        <div class="kpi"><div class="v">${projects}</div><div class="l">项目数 / PROJECTS</div></div>
      </div>
      <div class="panel">
        <div class="panel-h">CONTRIBUTIONS<span class="tag">完成热力图 · 近 53 周（按归档 doneAt）</span></div>
        <div class="panel-b">
          <div class="hm-scroll">${this.heatmap(arcs)}</div>
          <div class="hm-legend"><span>LESS</span><i></i><i class="l1"></i><i class="l2"></i><i class="l3"></i><i class="l4"></i><span>MORE</span></div>
        </div>
      </div>
      <div class="stat-grid">
        <div class="panel">
          <div class="panel-h">PROJECTS<span class="tag">项目任务分布 · 归档+待办 Top 8</span></div>
          <div class="panel-b dist">${this.dist(arcs, todos)}</div>
        </div>
        <div class="panel">
          <div class="panel-h">TREND<span class="tag">近 12 周完成趋势</span></div>
          <div class="panel-b">${this.trend(arcs)}</div>
        </div>
      </div>
      <div class="tip" id="hmTip" hidden></div>`;
    this.bindTip(el);
  },

  /* 自定义 tooltip：hover [data-tip] 元素时跟随显示（热力图/趋势图共用, 终端风格） */
  bindTip(el) {
    const tip = el.querySelector('#hmTip');
    const move = e => {
      const cell = e.target instanceof Element && e.target.closest('[data-tip]');
      if (!cell || !cell.closest('.view')) { tip.hidden = true; return; }
      tip.textContent = cell.dataset.tip;
      tip.hidden = false;
      // 跟随定位：优先在目标上方, 超出视口顶部则翻到下方
      const r = cell.getBoundingClientRect();
      let x = r.left + r.width / 2 - tip.offsetWidth / 2;
      x = Math.max(8, Math.min(x, innerWidth - tip.offsetWidth - 8));
      const y = r.top - tip.offsetHeight - 8 >= 0 ? r.top - tip.offsetHeight - 8 : r.bottom + 8;
      tip.style.left = x + 'px';
      tip.style.top = y + 'px';
    };
    el.addEventListener('mousemove', move);
    el.addEventListener('mouseleave', () => { tip.hidden = true; });
  },

  dstr(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  },
  // 本周周一（本地时区）
  curMonday() {
    const t = new Date();
    const mon = new Date(t.getFullYear(), t.getMonth(), t.getDate());
    mon.setDate(mon.getDate() - (mon.getDay() + 6) % 7);
    return mon;
  },

  /* ---------- GitHub 风格热力图：列=周, 行=周一..周日 ---------- */
  heatmap(arcs) {
    const counts = {};
    arcs.forEach(a => {
      const d = (a.doneAt || '').slice(0, 10);
      if (d) counts[d] = (counts[d] || 0) + 1;
    });
    const today = ui.today();
    const cur = this.curMonday();
    const start = new Date(cur); start.setDate(cur.getDate() - 52 * 7);
    const lvl = n => n >= 4 ? 'l4' : n === 3 ? 'l3' : n === 2 ? 'l2' : n === 1 ? 'l1' : '';

    let html = '<div class="hm">';
    let prevMonth = -1;
    for (let w = 0; w < 53; w++) {
      const mon = new Date(start); mon.setDate(start.getDate() + w * 7);
      // 首行：月份变化处显示标签
      html += `<i class="hm-m">${mon.getMonth() !== prevMonth ? (mon.getMonth() + 1) + '月' : ''}</i>`;
      prevMonth = mon.getMonth();
      for (let i = 0; i < 7; i++) {
        const d = new Date(mon); d.setDate(mon.getDate() + i);
        const ds = this.dstr(d);
        if (ds > today) { html += '<i class="off"></i>'; continue; }
        const n = counts[ds] || 0;
        const week = ['一', '二', '三', '四', '五', '六', '日'][i];
        html += `<i class="${lvl(n)}" data-tip="${ds} 周${week} · ${n} 条完成"></i>`;
      }
    }
    return html + '</div>';
  },

  /* ---------- 项目分布：归档+待办合并计数, Top 8 ---------- */
  dist(arcs, todos) {
    const map = new Map();
    [...arcs, ...todos].forEach(x => {
      const k = (x.project || '').trim();
      if (k) map.set(k, (map.get(k) || 0) + 1);
    });
    const rows = [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
    if (!rows.length) return '<div class="lk-empty">[ 暂无项目数据 ]</div>';
    const max = rows[0][1];
    const total = [...map.values()].reduce((s, n) => s + n, 0);
    const colors = ['var(--p0)', 'var(--p1)', 'var(--p2)', '#2fe08c'];
    return rows.map(([k, n], i) => `
      <div class="row">
        <span class="name" title="${ui.esc(k)}">${ui.esc(k)}</span>
        <span class="track"><i style="width:${Math.max(3, Math.round(n / max * 100))}%;background:${colors[i % 4]}"></i></span>
        <span class="num">${n} · ${Math.round(n / total * 100)}%</span>
      </div>`).join('');
  },

  /* ---------- 近 12 周完成趋势 ---------- */
  trend(arcs) {
    const cur = this.curMonday();
    const weeks = [];
    for (let i = 11; i >= 0; i--) {
      const mon = new Date(cur); mon.setDate(cur.getDate() - i * 7);
      const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
      const from = this.dstr(mon), to = this.dstr(sun);
      const n = arcs.filter(a => {
        const d = (a.doneAt || '').slice(0, 10);
        return d >= from && d <= to;
      }).length;
      weeks.push({ ago: i, n });
    }
    const max = Math.max(1, ...weeks.map(x => x.n));
    return `<div class="trend">${weeks.map(x => `
      <div class="bar${x.ago === 0 ? ' now' : ''}" data-tip="${x.ago === 0 ? '本周' : '近 ' + x.ago + ' 周'} · ${x.n} 条完成">
        <span class="n">${x.n || ''}</span>
        <div class="fill"><i style="height:${x.n ? Math.max(4, Math.round(x.n / max * 100)) : 0}%"></i></div>
        <b>W${String(this.isoWeekNo(x.ago)).padStart(2, '0')}</b>
      </div>`).join('')}</div>`;
  },

  // weeksAgo 周前的 ISO 周号（周四定年）
  isoWeekNo(weeksAgo) {
    const mon = this.curMonday();
    mon.setDate(mon.getDate() - weeksAgo * 7);
    const thu = new Date(mon); thu.setDate(mon.getDate() + 3);
    const jan4 = new Date(thu.getFullYear(), 0, 4);
    const off = (jan4.getDay() + 6) % 7;
    const w1mon = new Date(jan4.getFullYear(), 0, 4 - off);
    return Math.round((mon - w1mon) / 604800000) + 1;
  }
};
