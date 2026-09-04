/* ============================================================
   Z-DASH 周报管理 — 年度周块网格 + 周报填写弹层
   - 按年展示全部 ISO 周（每周一个长方块，6 列网格，箭头切年）
   - 点击周块弹层填写周报（Markdown），COMMIT 持久化到 data/weekly.json
   - 弹层右上角 IMPORT TASK：完成类（待办 done / 历史归档）一律按完成时间
     doneAt 是否落在该周区间计入；本周额外全量列出未完成任务；
     直接填入输入框不下载 .md；已有内容时不生效；未来周禁点
   ============================================================ */
const weeklyView = {
  state: { year: null },

  /* ---------- ISO 周工具（本地时区） ---------- */
  dstr(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  },
  // 某年某 ISO 周的周一（1 月 4 日必在第 1 周）
  weekMonday(y, w) {
    const jan4 = new Date(y, 0, 4);
    const off = (jan4.getDay() + 6) % 7;   // 周一=0 .. 周日=6
    return new Date(y, 0, 4 - off + (w - 1) * 7);
  },
  weeksInYear(y) {
    return Math.round((this.weekMonday(y + 1, 1) - this.weekMonday(y, 1)) / 604800000);
  },
  // 今天所在的 ISO 年 / 周（周四所在年 = ISO 年）
  isoNow() {
    const t = new Date();
    const mon = new Date(t.getFullYear(), t.getMonth(), t.getDate());
    mon.setDate(mon.getDate() - (mon.getDay() + 6) % 7);
    const thu = new Date(mon); thu.setDate(mon.getDate() + 3);
    const iy = thu.getFullYear();
    return { y: iy, w: Math.round((mon - this.weekMonday(iy, 1)) / 604800000) + 1 };
  },
  rec(year, week) {
    return store.data.weekly.items.find(r => r.year === year && r.week === week);
  },

  render() {
    if (!this.state.year) this.state.year = this.isoNow().y;
    const el = document.getElementById('view-weekly');
    const y = this.state.year;
    const n = this.weeksInYear(y);
    const cur = this.isoNow();
    const reported = store.data.weekly.items.filter(r => r.year === y).length;

    el.innerHTML = `
      <div class="topbar">
        <div class="crumb"><span class="sys">SYS://</span><b>WEEKLY</b> &gt; REPORT · ${y} · ${reported}/${n} REPORTED<span class="cur">/</span></div>
      </div>
      <div class="wk-year">
        <span class="nav" data-nav="-1" title="上一年">&lt;</span>
        <span class="yl">${y}</span>
        <span class="nav" data-nav="1" title="下一年">&gt;</span>
      </div>
      <div class="wk-grid">
        ${Array.from({ length: n }, (_, i) => this.cellHTML(y, i + 1, cur)).join('')}
      </div>`;

    el.querySelector('.wk-year').onclick = e => {
      const nav = e.target.closest('[data-nav]');
      if (!nav) return;
      this.state.year += Number(nav.dataset.nav);
      this.render();
    };
    el.querySelector('.wk-grid').onclick = e => {
      const cell = e.target.closest('.wk-cell');
      if (!cell) return;
      if (cell.classList.contains('future')) { ui.toast('未来周不可填写', 'warn'); return; }
      this.openModal(y, Number(cell.dataset.w));
    };
  },

  cellHTML(y, w, cur) {
    const mon = this.weekMonday(y, w);
    const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
    const has = !!this.rec(y, w);
    const isNow = y === cur.y && w === cur.w;
    const future = !isNow && (y > cur.y || (y === cur.y && w > cur.w));
    const cls = ['wk-cell'];
    if (has) cls.push('has');
    if (isNow) cls.push('now');
    if (future) cls.push('future');
    const fmt = d => String(d.getMonth() + 1).padStart(2, '0') + '.' + String(d.getDate()).padStart(2, '0');
    const ww = String(w).padStart(2, '0');
    return `
      <div class="${cls.join(' ')}" data-w="${w}" title="${this.dstr(mon)} ~ ${this.dstr(sun)}">
        <div class="wk-top">
          <span class="wk-no">W${ww}</span>
          <span class="wk-flags">${has ? '<span class="f f-r">REPORTED</span>' : ''}${isNow ? '<span class="f f-n">NOW</span>' : ''}</span>
        </div>
        <div class="wk-cn">第${ww}周</div>
        <div class="wk-range">${fmt(mon)} ~ ${fmt(sun)}</div>
      </div>`;
  },

  /* ---------- 周报填写弹层 ---------- */
  openModal(year, week) {
    const mon = this.weekMonday(year, week);
    const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
    const rec = this.rec(year, week);
    const ww = String(week).padStart(2, '0');
    const cur = this.isoNow();
    const isNow = year === cur.y && week === cur.w;   // 未来周已在入口禁用，这里只有本周/往周
    const impTitle = isNow
      ? '从待办导入当周任务（TODO/PROGRESS/DONE）生成 Markdown'
      : '从历史归档导入该周完成记录生成 Markdown';
    ui._open(`
      <div class="m-h">
        <span>WEEKLY REPORT · ${year}-W${ww}</span>
        <button type="button" class="btn mini gold m-ops" id="wkImport" title="${impTitle}"><span class="ic">↓</span>IMPORT TASK</button>
      </div>
      <div class="m-b">
        <div class="fld">
          <label>周报内容 · MARKDOWN（${this.dstr(mon)} ~ ${this.dstr(sun)}）</label>
          <textarea class="ipt wk-ta" rows="16" placeholder="输入周报内容 ... 或点右上角 IMPORT TASK 导入草稿">${rec ? ui.esc(rec.content) : ''}</textarea>
        </div>
      </div>
      <div class="m-f">
        <button type="button" class="btn ghost" data-x>CANCEL</button>
        <button type="button" class="btn warn" data-ok>COMMIT</button>
      </div>`);
    ui._box.classList.add('xwide');
    const ta = ui._box.querySelector('.wk-ta');

    ui._box.querySelector('[data-x]').onclick = () => ui.close();
    ui._box.querySelector('#wkImport').onclick = () => {
      if (ta.value.trim()) { ui.toast('已有内容，IMPORT 不生效（清空后可导入）', 'warn'); return; }
      const from = this.dstr(mon), to = this.dstr(sun);
      ta.value = this.buildWeekMD(year, week, from, to);
      const n = this.doneOfWeek(from, to).length;
      if (isNow) ui.toast(n ? `TASKS IMPORTED → ${n} 条完成记录` : 'TASKS IMPORTED →');
      else ui.toast(n ? `IMPORTED · ${n} 条（DONE + 归档）` : '该周无完成记录');
    };
    ui._box.querySelector('[data-ok]').onclick = async () => {
      const v = ta.value;
      const r = this.rec(year, week);
      if (!v.trim()) {
        if (!r) return ui.close();   // 无内容且无记录：直接关闭
        store.data.weekly.items = store.data.weekly.items.filter(x => x !== r);
        ui.toast('REPORT CLEARED');
      } else if (r) {
        r.content = v; r.updatedAt = ui.nowISO();
        ui.toast('REPORT UPDATED');
      } else {
        store.data.weekly.items.unshift({
          id: ui.uid('w'), year, week, content: v,
          createdAt: ui.nowISO(), updatedAt: ui.nowISO()
        });
        ui.toast('REPORT SAVED');
      }
      await store.save('weekly');
      ui.close();
      this.render();
    };
    setTimeout(() => ta.focus(), 0);
  },

  /* 生成某周周报 Markdown（统一口径：完成类任务看 doneAt 是否落在该周 [from,to] 内）
     本周：待办 TODO/PROGRESS 未完成全量 + 该周完成记录；
     往周：仅该周完成记录——待办 done 与历史归档都按完成时间计入 */
  buildWeekMD(year, week, from, to) {
    const cur = this.isoNow();
    const isNow = year === cur.y && week === cur.w;
    const done = this.doneOfWeek(from, to);                       // 完成时间在该周的记录（DONE 待办 + 归档）
    const active = isNow
      ? store.data.todos.items.filter(t => t.status !== 'done')   // 本周：未完成任务全量
      : [];
    const esc = s => String(s || '').replace(/[|*]/g, m => '\\' + m).replace(/\n/g, ' ').trim();

    /* 按项目分组渲染列表（未完成 [ ] / 完成 [x]，元数据内联） */
    const renderList = list => {
      const groups = new Map();
      list.forEach(t => {
        const k = (t.project || '').trim();
        if (!groups.has(k)) groups.set(k, []);
        groups.get(k).push(t);
      });
      const keys = [...groups.keys()].filter(k => k !== '').sort((a, b) => a.localeCompare(b));
      const sorted = keys.concat(groups.has('') ? [''] : []);
      return sorted.map(k => {
        const arr = groups.get(k);
        const head = k === '' ? '**未分组**' : `**${esc(k)}**`;
        const lines = arr.map(t => {
          const { tag, title } = todoView.parseTag(t.title);
          const full = tag ? `[${tag}] ${title}` : title;
          const meta = [
            t.createdAt ? '创建:' + String(t.createdAt).slice(0, 10) : '',
            t.doneAt ? '完成:' + String(t.doneAt).slice(0, 10) : '',
            t.dueDate ? '截止:' + t.dueDate : '',
            t.project ? '项目:' + esc(t.project) : ''
          ].filter(Boolean).join(' · ');
          let line = `- [${t.status === 'done' ? 'x' : ' '}] **${esc(full)}** — \`${t.priority || 'P2'}\``;
          if (meta) line += `\n  - ${meta}`;
          if (t.desc) line += `\n  - 详情: ${esc(t.desc)}`;
          return line;
        }).join('\n');
        return `### ${head}（${arr.length}）\n\n${lines}`;
      }).join('\n\n');
    };
    const sec = (head, list) =>
      `## ${head}（${list.length}）\n\n${renderList(list) || '_（无记录）_'}`;

    const w = String(week).padStart(2, '0');
    const body = isNow
      ? [
          sec('未启动 · TODO', active.filter(t => t.status === 'todo')),
          sec('进行中 · PROGRESS', active.filter(t => t.status === 'doing')),
          sec('已完成 · DONE（该周，含归档）', done)
        ].join('\n\n')
      : sec('已完成 · DONE / ARCHIVE（该周）', done);
    return `# 周报 · ${year} 第${w}周（${from} ~ ${to}）\n\n` +
      `> 生成时间：${ui.nowISO().slice(0, 16)}` + (isNow ? '' : ' · 来源：完成时间落点（待办 DONE + 归档）') + '\n\n' +
      body + '\n';
  },

  /* 完成时间（doneAt）落在该周 [from,to] 的全部记录：历史归档 + 待办中 done，
     统一按 doneAt 排序，兼顾"本周已归档"与"往周未归档 done"两类遗漏 */
  doneOfWeek(from, to) {
    const day = it => String(it.doneAt || '').slice(0, 10);
    const arr = [];
    store.data.archive.items.forEach(it => {
      const d = day(it);
      if (d >= from && d <= to) arr.push({ ...it, status: 'done' });
    });
    store.data.todos.items.forEach(it => {
      if (it.status !== 'done') return;
      const d = day(it);
      if (d >= from && d <= to) arr.push({ ...it });
    });
    return arr.sort((a, b) => day(a).localeCompare(day(b)));
  }
};
