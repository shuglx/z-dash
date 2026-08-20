/* ============================================================
   Z-DASH 待办事项 — 三栏看板
   状态: todo(未启动) / doing(进行中) / done(已完成)
   交互: PC 拖拽切栏；移动端卡片箭头切状态；done 卡右上角 ARCHIVE 按钮归档
   分组: 列内按 project 自动归组, 未填项目归入 UNGROUPED
   箭头: todo 仅 → ; doing 有 ←→ ; done 仅 ←
   ============================================================ */
const todoView = {
  cols: [
    { k: 'todo', n: '未启动 / TODO', cls: 'c-todo' },
    { k: 'doing', n: '进行中 / PROGRESS', cls: 'c-doing' },
    { k: 'done', n: '已完成 / DONE', cls: 'c-done' }
  ],
  // 各状态可移动到的目标 (左 ← / 右 →)
  moves: { todo: { to: 'doing' }, doing: { back: 'todo', to: 'done' }, done: { back: 'todo' } },

  parseTag(t) {
    const m = /^\[([^\]]{1,10})\]\s*/.exec(t || '');
    return m ? { tag: m[1], title: t.slice(m[0].length) } : { tag: null, title: t || '' };
  },

  render() {
    const el = document.getElementById('view-todo');
    const items = store.data.todos.items;
    el.innerHTML = `
      <div class="topbar">
        <div class="crumb"><span class="sys">SYS://</span><b>TODO</b> &gt; BOARD · ${items.length} TASKS</div>
        <span class="sp"></span>
        <button class="btn gold" data-act="exportWeek" title="导出本周工作为 Markdown"><span class="ic">↓</span> WEEK REPORT</button>
        <button class="btn warn" data-act="new">+ NEW TASK</button>
      </div>
      <div class="cols">
        ${this.cols.map(c => {
          const list = items.filter(t => t.status === c.k);
          return `
          <div class="col ${c.cls}" data-col="${c.k}">
            <div class="col-h"><span class="n">${list.length}</span>${c.n}</div>
            <div class="col-b">
              ${list.length ? this.groupHTML(list) : '<div class="col-empty">[ EMPTY ]</div>'}
            </div>
          </div>`;
        }).join('')}
      </div>
      <p class="hint">// PC 端拖动卡片切状态 · 卡片 [→]/[←] 快捷切状态 · done 卡右上角 ARCHIVE 归档 · 快捷键 N 新建</p>`;
    this.bind(el);
  },

  /* 列内按 project 分组渲染 */
  groupHTML(list) {
    const groups = new Map();
    list.forEach(t => {
      const k = (t.project || '').trim();
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(t);
    });
    // 未分组放最后, 其余按名称排序
    const keys = [...groups.keys()].filter(k => k !== '');
    keys.sort((a, b) => a.localeCompare(b));
    const sorted = keys.concat(groups.has('') ? [''] : []);

    return sorted.map(k => {
      const arr = groups.get(k);
      const isUng = k === '';
      return `
        <div class="pg">
          <div class="pg-h">${isUng ? '<span class="pg-n un">UNGROUPED</span>' : `<span class="pg-n">${ui.esc(k)}</span>`}<span class="pg-c">// ${arr.length}</span></div>
          ${arr.map(t => this.card(t)).join('')}
        </div>`;
    }).join('');
  },

  card(t) {
    const { tag, title } = this.parseTag(t.title);
    const pri = { P0: 'hi', P1: 'mid', P2: 'low' }[t.priority] || 'low';
    const m = this.moves[t.status] || {};
    return `
      <div class="task ${t.status}" draggable="true" data-id="${t.id}">
        <div class="t-row">
          <div class="t">${tag ? `<span class="tagx">[${ui.esc(tag)}]</span>` : ''}${ui.esc(title)}</div>
          ${t.status === 'done' ? '<button class="btn arch" data-act="arch" title="归档进历史">ARCHIVE</button>' : ''}
        </div>
        ${t.desc ? `<div class="desc">${ui.esc(t.desc)}</div>` : ''}
        <div class="meta">
          <span class="pri ${pri}">${ui.esc(t.priority || 'P2')}</span>
          ${t.dueDate && t.status !== 'done' && t.dueDate <= ui.today() ? `<span class="date due" title="已到期/今日截止">${ui.fmtMD(t.dueDate)}</span>` : t.dueDate ? `<span class="date">${ui.fmtMD(t.dueDate)}</span>` : ''}
          ${t.project ? `<span class="proj">${ui.esc(t.project)}</span>` : ''}
          <span class="ops">
            ${m.back ? `<span class="mv op" data-mv="${m.back}" title="移到 ${m.back}">←</span>` : ''}
            ${m.to ? `<span class="mv op" data-mv="${m.to}" title="移到 ${m.to}">→</span>` : ''}
            <span class="op" data-act="edit" title="编辑">[edit]</span>
            <span class="op danger" data-act="del" title="删除">[del]</span>
          </span>
        </div>
      </div>`;
  },

  bind(el) {
    // 新任务
    el.querySelector('[data-act="new"]').onclick = () => this.editModal(null);
    // 导出本周
    const exBtn = el.querySelector('[data-act="exportWeek"]');
    if (exBtn) exBtn.onclick = () => this.exportWeek();

    // 卡片操作（事件委托）
    el.onclick = async e => {
      // done 卡右上角 ARCHIVE 按钮
      const archBtn = e.target.closest('button[data-act="arch"]');
      if (archBtn) {
        const t = store.data.todos.items.find(x => x.id === archBtn.closest('.task').dataset.id);
        if (t) this.archive(t);
        return;
      }
      const mvEl = e.target.closest('[data-mv]');
      const op = e.target.closest('.op');
      const card = (mvEl || op) && (mvEl || op).closest('.task');
      if (!card) return;
      const id = card.dataset.id;
      const t = store.data.todos.items.find(x => x.id === id);
      if (!t) return;

      if (mvEl) return this.setStatus(t, mvEl.dataset.mv);

      const act = op.dataset.act;
      if (act === 'edit') this.editModal(t);
      else if (act === 'del') {
        if (await ui.confirm('删除任务「' + t.title + '」？')) {
          store.data.todos.items = store.data.todos.items.filter(x => x.id !== id);
          await store.save('todos');
          ui.toast('TASK DELETED');
          this.render();
        }
      }
    };

    // 拖拽
    el.querySelectorAll('.task').forEach(card => {
      card.ondragstart = e => {
        e.dataTransfer.setData('text/plain', card.dataset.id);
        e.dataTransfer.effectAllowed = 'move';
        card.style.opacity = .35;
      };
      card.ondragend = () => { card.style.opacity = 1; };
    });
    el.querySelectorAll('.col').forEach(col => {
      col.ondragover = e => { e.preventDefault(); col.classList.add('drag-over'); };
      col.ondragleave = () => col.classList.remove('drag-over');
      col.ondrop = async e => {
        e.preventDefault();
        col.classList.remove('drag-over');
        const id = e.dataTransfer.getData('text/plain');
        const t = store.data.todos.items.find(x => x.id === id);
        if (t && t.status !== col.dataset.col) this.setStatus(t, col.dataset.col, true);
      };
    });
  },

  /* 导出本周工作为 Markdown：待办/进行中全部 + 已完成（完成时间在本周） */
  exportWeek() {
    const items = store.data.todos.items;
    const now = new Date();
    const mon = new Date(now);
    mon.setDate(now.getDate() - ((now.getDay() + 6) % 7)); // 本周一
    const from = mon.toISOString().slice(0, 10);
    const to = now.toISOString().slice(0, 10);

    const inWeek = t => {
      if (t.status !== 'done') return true;
      const d = (t.doneAt || '').slice(0, 10);
      return d >= from && d <= to;
    };
    const tasks = items.filter(inWeek);
    const esc = s => String(s || '').replace(/[|*]/g, m => '\\' + m).replace(/\n/g, ' ').trim();

    const renderGroup = list => {
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
          const { tag, title } = this.parseTag(t.title);
          const full = tag ? `[${tag}] ${title}` : title;
          const p = t.priority || 'P2';
          const due = t.dueDate ? `截止:${t.dueDate}` : '';
          const created = t.createdAt ? `创建:${String(t.createdAt).slice(0, 10)}` : '';
          const done = t.doneAt ? `完成:${String(t.doneAt).slice(0, 10)}` : '';
          const meta = [created, done, due, t.project ? '项目:' + esc(t.project) : ''].filter(Boolean).join(' · ');
          let line = `- [${t.status === 'done' ? 'x' : ' '}] **${esc(full)}** — \`${p}\``;
          if (meta) line += `\n  - ${meta}`;
          if (t.desc) line += `\n  - 详情: ${esc(t.desc)}`;
          return line;
        }).join('\n');
        return `### ${head}（${arr.length}）\n\n${lines}`;
      }).join('\n\n');
    };

    const cnt = s => tasks.filter(t => t.status === s).length;
    const md =
      `# 本周工作周报（${from} ~ ${to}）\n\n` +
      `> 生成时间：${ui.nowISO().slice(0, 16)}\n\n` +
      `## 未启动 · TODO（${cnt('todo')}）\n\n${renderGroup(tasks.filter(t => t.status === 'todo'))}\n\n` +
      `## 进行中 · PROGRESS（${cnt('doing')}）\n\n${renderGroup(tasks.filter(t => t.status === 'doing'))}\n\n` +
      `## 已完成 · DONE（本周）（${cnt('done')}）\n\n${renderGroup(tasks.filter(t => t.status === 'done'))}\n`;

    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `本周工作_${from}_${to}.md`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 500);
    ui.toast(`已导出本周工作 ${tasks.length} 条`);
  },

  async setStatus(t, status, silent) {
    t.status = status;
    // 完成日期 = 最后一次放入 DONE 栏的日期（移出则清空）
    t.doneAt = status === 'done' ? ui.nowISO() : null;
    await store.save('todos');
    if (!silent) ui.toast('STATUS → ' + status.toUpperCase());
    this.render();
  },

  /* 归档单条 done 任务进历史 */
  async archive(t) {
    store.data.todos.items = store.data.todos.items.filter(x => x.id !== t.id);
    store.data.archive.items.unshift({
      id: ui.uid('a'),
      title: t.title,
      project: t.project || '',
      priority: t.priority || 'P2',
      desc: t.desc || '',
      createdAt: t.createdAt || '',
      doneAt: (t.doneAt || ui.nowISO()).slice(0, 10), // 完成日期
      archivedAt: ui.nowISO()                        // 归档时间
    });
    await store.save('todos');
    await store.save('archive');
    ui.toast('TASK ARCHIVED →');
    this.render();
  },

  editModal(t) {
    const isNew = !t;
    ui.formModal({
      title: isNew ? 'NEW TASK' : 'EDIT TASK',
      fields: [
        { name: 'title', label: '标题（[TAG] 前缀会被高亮）', required: true, value: t ? t.title : '', placeholder: '例如 [BUG] 修复登录超时' },
        { name: 'status', label: '状态', type: 'select', value: t ? t.status : 'todo', options: [['todo', '未启动'], ['doing', '进行中'], ['done', '已完成']] },
        { name: 'priority', label: '优先级', type: 'select', value: t ? t.priority : 'P2', options: [['P0', 'P0 紧急'], ['P1', 'P1 重要'], ['P2', 'P2 普通']] },
        { name: 'project', label: '项目（可选）', value: t ? (t.project || '') : '', placeholder: 'infra / gateway / self ...' },
        { name: 'desc', label: '详情（可选）', type: 'textarea', rows: 6, value: t ? (t.desc || '') : '', placeholder: '补充说明 / 验收标准 / 备注 ...' },
        { name: 'dueDate', label: '截止日期（可选）', type: 'date', value: t ? (t.dueDate || '') : '' }
      ],
      submit: 'COMMIT',
      onSubmit: async v => {
        if (isNew) {
          store.data.todos.items.unshift({
            id: ui.uid('t'),
            title: v.title, status: v.status, priority: v.priority,
            project: v.project, desc: v.desc || null, dueDate: v.dueDate || null,
            createdAt: ui.nowISO(),
            doneAt: v.status === 'done' ? ui.nowISO() : null
          });
          ui.toast('TASK CREATED');
        } else {
          Object.assign(t, {
            title: v.title, status: v.status, priority: v.priority,
            project: v.project, desc: v.desc || null, dueDate: v.dueDate || null,
            doneAt: v.status === 'done' ? (t.doneAt || ui.nowISO()) : null
          });
          ui.toast('TASK UPDATED');
        }
        await store.save('todos');
        this.render();
      }
    });
  }
};
