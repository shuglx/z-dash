/* ============================================================
   Z-DASH 历史归档 — 搜索 + 时间范围 + 月历打点
   状态保存在视图对象内，列表/日历局部刷新避免输入丢焦
   ============================================================ */
const archiveView = {
  state: {
    q: '', range: '', customFrom: '', customTo: '',
    dateFilter: null, page: 1,
    calY: new Date().getFullYear(), calM: new Date().getMonth()
  },
  RANGES: { '': '全部', '1w': '本周', '1m': '近 1 月', '3m': '近 3 月' },
  QUICK: ['', '1w', '1m', '3m'],
  PER_PAGE: 10,

  // 范围 + 关键词过滤（不含日期点选）—— 供日历打点
  scoped() {
    const s = this.state;
    const from = this.rangeFrom();
    const to = this.rangeTo();
    return store.data.archive.items
      .filter(it => {
        const day = (it.doneAt || '').slice(0, 10);
        if (from && day < from) return false;
        if (to && day > to) return false;
        if (s.q) {
          const hay = (it.title + ' ' + (it.project || '') + ' ' + day).toLowerCase();
          if (!hay.includes(s.q.toLowerCase())) return false;
        }
        return true;
      })
      .sort((a, b) => (b.doneAt || '').localeCompare(a.doneAt || ''));
  },
  // 列表过滤 = 范围 + 关键词 + 日期点选
  filtered() {
    const s = this.state;
    return this.scoped().filter(it => {
      if (s.dateFilter && (it.doneAt || '').slice(0, 10) !== s.dateFilter) return false;
      return true;
    });
  },
  // 当前生效范围标签（用于标题角标）
  rangeLabel() {
    const s = this.state;
    if (s.customFrom || s.customTo) {
      const a = s.customFrom || '…', b = s.customTo || '…';
      return (a === b ? a : a + ' ~ ' + b);
    }
    return this.RANGES[s.range] || '全部';
  },
  // 自定义优先，其次快捷按钮
  rangeFrom() {
    const s = this.state;
    if (s.customFrom) return s.customFrom;
    if (s.range === '1w') { const d = new Date(); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.toISOString().slice(0, 10); }
    if (s.range === '1m') { const d = new Date(); d.setMonth(d.getMonth() - 1); return d.toISOString().slice(0, 10); }
    if (s.range === '3m') { const d = new Date(); d.setMonth(d.getMonth() - 3); return d.toISOString().slice(0, 10); }
    return null;
  },
  rangeTo() {
    const s = this.state;
    if (s.customTo) return s.customTo;
    if (s.range === '1w') return new Date().toISOString().slice(0, 10); // 本周 → 今天
    return null;
  },

  render() {
    const el = document.getElementById('view-archive');
    const s = this.state;
    s.page = 1; // 筛选变化重置到第一页
    el.innerHTML = `
      <div class="topbar">
        <div class="crumb">SYS://<b>ARCHIVE</b> &gt; QUERY · <span id="arcCount"></span></div>
        <span class="sp"></span>
        <button class="btn" data-act="exportReport" title="导出当前筛选结果为 Markdown"><span class="ic">↓</span> EXPORT REPORT</button>
      </div>
      <div class="arch-grid">
        <div class="panel">
          <div class="panel-h">ARCHIVED_TASKS<span class="tag" id="arcRangeTag"></span></div>
          <div class="panel-b">
            <div class="search-bar">
              <input type="text" class="ipt" id="arcQ" placeholder="grep 关键词... (标题 / 项目 / 日期)" value="${ui.esc(s.q)}">
            </div>
            <div class="range-bar">
              <div class="rb-row">
                ${this.QUICK.map(k => `<button class="btn mini rb${s.range === k && !s.customFrom && !s.customTo ? ' on' : ''}" data-range="${k}">${this.RANGES[k]}</button>`).join('')}
                ${s.dateFilter ? `<button class="btn mini" id="arcClearDate">清除 ${s.dateFilter}</button>` : ''}
              </div>
              <div class="rb-row">
                <span class="rb-l">自定义</span>
                <input type="date" class="ipt" id="arcFrom" value="${s.customFrom}" title="起始日期">
                <span class="rb-t">~</span>
                <input type="date" class="ipt" id="arcTo" value="${s.customTo}" title="结束日期">
              </div>
            </div>
            <div id="arcList"></div>
          </div>
        </div>
        <div class="cal">
          <div class="cal-h"><span class="nav" id="calPrev">&lt;</span><span id="calTitle"></span><span class="nav" id="calNext">&gt;</span></div>
          <div class="cal-w"><span>MO</span><span>TU</span><span>WE</span><span>TH</span><span>FR</span><span>SA</span><span>SU</span></div>
          <div class="cal-g" id="calGrid"></div>
          <div class="cal-legend"><span class="cnt">N</span>当天任务数（点日期过滤列表）</div>
        </div>
      </div>`;

    el.querySelector('#arcQ').oninput = e => { this.state.q = e.target.value; this.state.page = 1; this.updateList(); this.updateCal(); };
    // 导出当前筛选结果
    el.querySelector('[data-act="exportReport"]').onclick = () => this.exportReport();
    // 快捷范围按钮（委托）
    el.querySelector('.range-bar').onclick = e => {
      const rb = e.target.closest('[data-range]');
      if (!rb) return;
      const k = rb.dataset.range;
      this.state.range = this.state.range === k ? '' : k; // 再点取消 = 全部
      this.state.customFrom = ''; this.state.customTo = ''; // 切快捷时清空自定义
      this.render();
    };
    // 自定义范围：填了值就进入自定义
    el.querySelector('#arcFrom').onchange = e => { this.state.customFrom = e.target.value; this.state.range = ''; this.state.page = 1; this.updateList(); this.updateCal(); };
    el.querySelector('#arcTo').onchange = e => { this.state.customTo = e.target.value; this.state.range = ''; this.state.page = 1; this.updateList(); this.updateCal(); };
    const clearBtn = el.querySelector('#arcClearDate');
    if (clearBtn) clearBtn.onclick = () => { this.state.dateFilter = null; this.render(); };
    el.querySelector('#calPrev').onclick = () => this.shiftMonth(-1);
    el.querySelector('#calNext').onclick = () => this.shiftMonth(1);
    // 日历日期点击（委托）：只过滤列表，日历标记保留
    el.querySelector('#calGrid').onclick = e => {
      const cell = e.target.closest('.cell');
      if (!cell || !cell.dataset.day || cell.dataset.day === 'x') return;
      this.state.dateFilter = this.state.dateFilter === cell.dataset.day ? null : cell.dataset.day;
      this.render();
    };
    // 分页 / 列表查看 / 删除（委托）
    el.querySelector('#arcList').onclick = async e => {
      const pg = e.target.closest('[data-pg]');
      if (pg) {
        const pages = this.pageCount();
        if (pg.dataset.pg === 'prev') this.state.page = Math.max(1, this.state.page - 1);
        else if (pg.dataset.pg === 'next') this.state.page = Math.min(pages, this.state.page + 1);
        return this.updateList();
      }
      const op = e.target.closest('.op');
      if (!op) return;
      const it = store.data.archive.items.find(x => x.id === op.dataset.id);
      if (!it) return;
      if (op.dataset.act === 'view') return this.showDetail(it);
      if (await ui.confirm('删除归档记录「' + it.title + '」？')) {
        store.data.archive.items = store.data.archive.items.filter(x => x.id !== it.id);
        await store.save('archive');
        ui.toast('RECORD DELETED');
        this.state.page = Math.min(this.state.page, Math.max(1, this.pageCount()));
        this.updateList(); this.updateCal();
      }
    };

    this.updateList();
    this.updateCal();
  },

  shiftMonth(d) {
    let m = this.state.calM + d, y = this.state.calY;
    if (m < 0) { m = 11; y--; }
    if (m > 11) { m = 0; y++; }
    this.state.calY = y; this.state.calM = m;
    this.updateCal();
  },

  showDetail(it) {
    ui.view(it.title, [
      { k: 'PROJECT', v: it.project || '' },
      { k: 'PRIORITY', v: it.priority || '' },
      { k: 'CREATED', v: (it.createdAt || '').slice(0, 10) },
      { k: 'DONE', v: (it.doneAt || '').slice(0, 10) },
      { k: 'ARCHIVED', v: (it.archivedAt || '').slice(0, 10) },
      { k: 'DETAIL', v: it.desc || '', raw: true }
    ]);
  },

  /* 导出当前筛选结果为 Markdown */
  exportReport() {
    const list = this.filtered();
    const esc = s => String(s || '').replace(/[|*]/g, m => '\\' + m).replace(/\n/g, ' ').trim();

    // 当前筛选范围标签
    const range = this.rangeLabel() + (this.state.dateFilter ? ' · ' + this.state.dateFilter : '');

    const lines = list.map(it => {
      const full = it.title || ''; // 归档标题已含 [TAG] 前缀
      const meta = [
        it.project ? '项目:' + esc(it.project) : '',
        it.priority ? '优先级:' + it.priority : '',
        it.createdAt ? '创建:' + String(it.createdAt).slice(0, 10) : '',
        it.doneAt ? '完成:' + String(it.doneAt).slice(0, 10) : '',
        it.archivedAt ? '归档:' + String(it.archivedAt).slice(0, 10) : ''
      ].filter(Boolean).join(' · ');
      let line = `- **${esc(full)}**`;
      if (meta) line += `\n  - ${meta}`;
      if (it.desc) line += `\n  - 详情: ${esc(it.desc)}`;
      return line;
    });

    const md =
      `# 归档报告（${range}）\n\n` +
      `> 生成时间：${ui.nowISO().slice(0, 16)} · 共 ${list.length} 条\n\n` +
      (list.length ? lines.join('\n\n') : '_（当前筛选无结果）_') + '\n';

    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `归档报告_${ui.today()}.md`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 500);
    ui.toast(`已导出归档 ${list.length} 条`);
  },

  pageCount() {
    return Math.max(1, Math.ceil(this.filtered().length / this.PER_PAGE));
  },

  updateList() {
    const el = document.getElementById('view-archive');
    if (!el || el.hidden) return;
    const all = this.filtered();
    const cnt = el.querySelector('#arcCount');
    const tag = el.querySelector('#arcRangeTag');
    const box = el.querySelector('#arcList');
    if (cnt) cnt.textContent = all.length + ' RECORDS';
    if (tag) {
      tag.textContent = this.rangeLabel() + (this.state.dateFilter ? ' · ' + this.state.dateFilter : '');
    }
    if (!box) return;
    const pages = this.pageCount();
    this.state.page = Math.min(this.state.page, pages);
    const start = (this.state.page - 1) * this.PER_PAGE;
    const list = all.slice(start, start + this.PER_PAGE);
    box.innerHTML = (list.length ? list.map(it => `
      <div class="arc-item">
        <span class="d">${ui.fmtMD(it.doneAt)}</span>
        <span class="t"><s>${ui.esc(it.title)}</s></span>
        ${it.project ? `<span class="proj">${ui.esc(it.project)}</span>` : ''}
        <span class="ops">
          <span class="op" data-act="view" data-id="${it.id}" title="查看详情">[view]</span>
          <span class="op danger" data-id="${it.id}" title="删除">[del]</span>
        </span>
      </div>`).join('')
      : '<div class="arc-empty">[ NO MATCH ] 查询结果为空</div>') +
      (pages > 1 ? `
      <div class="pager">
        <span class="op" data-pg="prev" title="上一页">[prev]</span>
        <span class="pg-info">${this.state.page} / ${pages}</span>
        <span class="op" data-pg="next" title="下一页">[next]</span>
      </div>` : '');
  },

  updateCal() {
    const el = document.getElementById('view-archive');
    if (!el || el.hidden) return;
    const grid = el.querySelector('#calGrid');
    const title = el.querySelector('#calTitle');
    if (!grid) return;
    const { calY: y, calM: m } = this.state;
    title.textContent = y + '-' + String(m + 1).padStart(2, '0');

    // 打点：按范围+关键词统计（不含日期点选，避免点选时其他日期标记消失）
    const marks = {};
    this.scoped().forEach(it => {
      const d = (it.doneAt || '').slice(0, 10);
      if (d) marks[d] = (marks[d] || 0) + 1;
    });

    // 周一为首列，算偏移
    const first = new Date(y, m, 1);
    const offset = (first.getDay() + 6) % 7;
    const days = new Date(y, m + 1, 0).getDate();
    const todayStr = ui.today();

    let html = '';
    for (let i = 0; i < offset; i++) html += '<div class="cell off" data-day="x"></div>';
    for (let d = 1; d <= days; d++) {
      const ds = y + '-' + String(m + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
      const n = marks[ds] || 0;
      const cls = ['cell'];
      if (ds === todayStr) cls.push('today');
      if (ds === this.state.dateFilter) cls.push('sel');
      if (n) cls.push('has');
      html += `<div class="${cls.join(' ')}" data-day="${ds}">
        <span class="num">${d}</span>
        ${n ? `<span class="cnt${n > 1 ? ' more' : ''}">${n}</span>` : ''}
      </div>`;
    }
    // 末尾补齐 off 格子，保证每行满 7 格，竖线完整
    const rem = (offset + days) % 7;
    if (rem) for (let i = 0; i < 7 - rem; i++) html += '<div class="cell off" data-day="x"></div>';
    grid.innerHTML = html;
  }
};
