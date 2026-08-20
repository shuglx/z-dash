/* ============================================================
   Z-DASH 历史归档 — 搜索 + 时间范围 + 月历打点
   状态保存在视图对象内，列表/日历局部刷新避免输入丢焦
   ============================================================ */
const archiveView = {
  state: {
    q: '', range: '1m', customFrom: '', customTo: '',
    dateFilter: null,
    calY: new Date().getFullYear(), calM: new Date().getMonth()
  },
  RANGES: [['1w', '近 1 周'], ['1m', '近 1 个月'], ['3m', '近 3 个月'], ['all', '全部'], ['custom', '自定义']],

  filtered() {
    const s = this.state;
    const from = this.rangeFrom();
    return store.data.archive.items
      .filter(it => {
        const day = (it.doneAt || '').slice(0, 10);
        if (from && day < from) return false;
        if (s.range === 'custom' && s.customTo && day > s.customTo) return false;
        if (s.dateFilter && day !== s.dateFilter) return false;
        if (s.q) {
          const hay = (it.title + ' ' + (it.project || '') + ' ' + day).toLowerCase();
          if (!hay.includes(s.q.toLowerCase())) return false;
        }
        return true;
      })
      .sort((a, b) => (b.doneAt || '').localeCompare(a.doneAt || ''));
  },
  rangeFrom() {
    const s = this.state;
    if (s.range === 'all') return null;
    if (s.range === 'custom') return s.customFrom || null;
    const d = new Date();
    if (s.range === '1w') d.setDate(d.getDate() - 7);
    if (s.range === '1m') d.setMonth(d.getMonth() - 1);
    if (s.range === '3m') d.setMonth(d.getMonth() - 3);
    return d.toISOString().slice(0, 10);
  },

  render() {
    const el = document.getElementById('view-archive');
    const s = this.state;
    el.innerHTML = `
      <div class="topbar">
        <div class="crumb">SYS://<b>ARCHIVE</b> &gt; QUERY · <span id="arcCount"></span></div>
      </div>
      <div class="arch-grid">
        <div class="panel">
          <div class="panel-h">ARCHIVED_TASKS<span class="tag" id="arcRangeTag"></span></div>
          <div class="panel-b">
            <div class="search-bar">
              <input type="text" class="ipt" id="arcQ" placeholder="grep 关键词... (标题 / 项目 / 日期)" value="${ui.esc(s.q)}">
              <select class="ipt" id="arcRange">
                ${this.RANGES.map(r => `<option value="${r[0]}" ${s.range === r[0] ? 'selected' : ''}>${r[1]}</option>`).join('')}
              </select>
              <span id="arcCustom" ${s.range === 'custom' ? '' : 'hidden'}>
                <input type="date" class="ipt" id="arcFrom" value="${s.customFrom}" title="起始日期">
                ~
                <input type="date" class="ipt" id="arcTo" value="${s.customTo}" title="结束日期">
              </span>
              ${s.dateFilter ? `<button class="btn mini" id="arcClearDate">清除日期 ${s.dateFilter}</button>` : ''}
            </div>
            <div id="arcList"></div>
          </div>
        </div>
        <div class="cal">
          <div class="cal-h"><span class="nav" id="calPrev">&lt;</span><span id="calTitle"></span><span class="nav" id="calNext">&gt;</span></div>
          <div class="cal-w"><span>MO</span><span>TU</span><span>WE</span><span>TH</span><span>FR</span><span>SA</span><span>SU</span></div>
          <div class="cal-g" id="calGrid"></div>
          <div class="cal-legend"><span class="dot"></span>当日完成记录（点日期过滤列表）</div>
        </div>
      </div>`;

    el.querySelector('#arcQ').oninput = e => { this.state.q = e.target.value; this.updateList(); };
    el.querySelector('#arcRange').onchange = e => {
      this.state.range = e.target.value;
      el.querySelector('#arcCustom').hidden = this.state.range !== 'custom';
      this.updateList(); this.updateCal();
    };
    el.querySelector('#arcFrom').onchange = e => { this.state.customFrom = e.target.value; this.updateList(); this.updateCal(); };
    el.querySelector('#arcTo').onchange = e => { this.state.customTo = e.target.value; this.updateList(); this.updateCal(); };
    const clearBtn = el.querySelector('#arcClearDate');
    if (clearBtn) clearBtn.onclick = () => { this.state.dateFilter = null; this.render(); };
    el.querySelector('#calPrev').onclick = () => this.shiftMonth(-1);
    el.querySelector('#calNext').onclick = () => this.shiftMonth(1);
    // 日历日期点击（委托）
    el.querySelector('#calGrid').onclick = e => {
      const cell = e.target.closest('.cell');
      if (!cell || !cell.dataset.day || cell.dataset.day === 'x') return;
      this.state.dateFilter = this.state.dateFilter === cell.dataset.day ? null : cell.dataset.day;
      this.render();
    };
    // 列表删除（委托）
    el.querySelector('#arcList').onclick = async e => {
      const op = e.target.closest('.op');
      if (!op) return;
      const it = store.data.archive.items.find(x => x.id === op.dataset.id);
      if (!it) return;
      if (await ui.confirm('删除归档记录「' + it.title + '」？')) {
        store.data.archive.items = store.data.archive.items.filter(x => x.id !== it.id);
        await store.save('archive');
        ui.toast('RECORD DELETED');
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

  updateList() {
    const el = document.getElementById('view-archive');
    if (!el || el.hidden) return;
    const list = this.filtered();
    const cnt = el.querySelector('#arcCount');
    const tag = el.querySelector('#arcRangeTag');
    const box = el.querySelector('#arcList');
    if (cnt) cnt.textContent = list.length + ' RECORDS';
    if (tag) {
      const r = this.RANGES.find(x => x[0] === this.state.range);
      tag.textContent = (r ? r[1] : '') + (this.state.dateFilter ? ' · ' + this.state.dateFilter : '');
    }
    if (!box) return;
    box.innerHTML = list.length ? list.map(it => `
      <div class="arc-item">
        <span class="d">${ui.fmtMD(it.doneAt)}</span>
        <span class="t"><s>${ui.esc(it.title)}</s></span>
        ${it.project ? `<span class="proj">${ui.esc(it.project)}</span>` : ''}
        <span class="ops"><span class="op danger" data-id="${it.id}" title="删除">del</span></span>
      </div>`).join('')
      : '<div class="arc-empty">[ NO MATCH ] 查询结果为空</div>';
  },

  updateCal() {
    const el = document.getElementById('view-archive');
    if (!el || el.hidden) return;
    const grid = el.querySelector('#calGrid');
    const title = el.querySelector('#calTitle');
    if (!grid) return;
    const { calY: y, calM: m } = this.state;
    title.textContent = y + '-' + String(m + 1).padStart(2, '0');

    // 打点：按当前搜索/范围结果统计
    const marks = {};
    this.filtered().forEach(it => {
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
        ${n ? `<span class="dot${n > 1 ? ' more' : ''}"></span>` : ''}
      </div>`;
    }
    grid.innerHTML = html;
  }
};
