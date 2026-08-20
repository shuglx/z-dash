/* ============================================================
   Z-DASH 待办事项 — 三栏看板
   状态: todo(未启动) / doing(进行中) / done(已完成)
   交互: PC 拖拽切栏；移动端卡片 [→] 按钮切状态；done 卡可归档
   ============================================================ */
const todoView = {
  cols: [
    { k: 'todo', n: '未启动 / TODO', cls: 'c-todo' },
    { k: 'doing', n: '进行中 / WIP', cls: 'c-doing' },
    { k: 'done', n: '已完成 / DONE', cls: 'c-done' }
  ],
  next: { todo: 'doing', doing: 'done', done: 'todo' },

  parseTag(t) {
    const m = /^\[([^\]]{1,10})\]\s*/.exec(t || '');
    return m ? { tag: m[1], title: t.slice(m[0].length) } : { tag: null, title: t || '' };
  },

  render() {
    const el = document.getElementById('view-todo');
    const items = store.data.todos.items;
    el.innerHTML = `
      <div class="topbar">
        <div class="crumb">SYS://<b>TODO</b> &gt; BOARD · ${items.length} TASKS</div>
        <span class="sp"></span>
        <button class="btn warn" data-act="new">+ 新任务</button>
      </div>
      <div class="cols">
        ${this.cols.map(c => {
          const list = items.filter(t => t.status === c.k);
          return `
          <div class="col ${c.cls}" data-col="${c.k}">
            <div class="col-h"><span class="n">${list.length}</span>${c.n}</div>
            <div class="col-b">
              ${list.length ? list.map(t => this.card(t)).join('') : '<div class="col-empty">[ EMPTY ]</div>'}
            </div>
          </div>`;
        }).join('')}
      </div>
      <p class="hint">// PC 端拖动卡片切状态 · 卡片 [→] 快捷切状态 · DONE 栏 [arch] 归档进历史 · 快捷键 N 新建</p>`;
    this.bind(el);
  },

  card(t) {
    const { tag, title } = this.parseTag(t.title);
    const pri = { P0: 'hi', P1: 'mid', P2: 'low' }[t.priority] || 'low';
    return `
      <div class="task ${t.status}" draggable="true" data-id="${t.id}">
        <div class="t">${tag ? `<span class="tagx">[${ui.esc(tag)}]</span>` : ''}${ui.esc(title)}</div>
        <div class="meta">
          <span class="pri ${pri}">${ui.esc(t.priority || 'P2')}</span>
          ${t.dueDate ? `<span class="date">${ui.fmtMD(t.dueDate)}</span>` : ''}
          ${t.project ? `<span class="proj">${ui.esc(t.project)}</span>` : ''}
          <span class="ops">
            <span class="mv op" data-act="mv" title="切换状态">→</span>
            <span class="op" data-act="edit" title="编辑">edit</span>
            ${t.status === 'done' ? '<span class="op" data-act="arch" title="归档">arch</span>' : ''}
            <span class="op danger" data-act="del" title="删除">del</span>
          </span>
        </div>
      </div>`;
  },

  bind(el) {
    // 新任务
    el.querySelector('[data-act="new"]').onclick = () => this.editModal(null);

    // 卡片操作（事件委托）
    el.onclick = async e => {
      const op = e.target.closest('.op');
      if (!op) return;
      const card = op.closest('.task');
      if (!card) return;
      const id = card.dataset.id;
      const t = store.data.todos.items.find(x => x.id === id);
      if (!t) return;
      const act = op.dataset.act;
      if (act === 'edit') this.editModal(t);
      else if (act === 'mv') this.setStatus(t, this.next[t.status]);
      else if (act === 'arch') this.archive(t);
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

  async setStatus(t, status, silent) {
    t.status = status;
    t.doneAt = status === 'done' ? (t.doneAt || ui.nowISO()) : null;
    await store.save('todos');
    if (!silent) ui.toast('STATUS → ' + status.toUpperCase());
    this.render();
  },

  async archive(t) {
    store.data.todos.items = store.data.todos.items.filter(x => x.id !== t.id);
    store.data.archive.items.unshift({
      id: ui.uid('a'),
      title: t.title,
      project: t.project || '',
      priority: t.priority || 'P2',
      doneAt: (t.doneAt || ui.nowISO()).slice(0, 10),
      archivedAt: ui.nowISO()
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
        { name: 'dueDate', label: '截止日期（可选）', type: 'date', value: t ? (t.dueDate || '') : '' }
      ],
      submit: 'COMMIT',
      onSubmit: async v => {
        if (isNew) {
          store.data.todos.items.unshift({
            id: ui.uid('t'),
            title: v.title, status: v.status, priority: v.priority,
            project: v.project, dueDate: v.dueDate || null,
            createdAt: ui.nowISO(),
            doneAt: v.status === 'done' ? ui.nowISO() : null
          });
          ui.toast('TASK CREATED');
        } else {
          Object.assign(t, {
            title: v.title, status: v.status, priority: v.priority,
            project: v.project, dueDate: v.dueDate || null,
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
