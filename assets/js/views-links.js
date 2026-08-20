/* ============================================================
   Z-DASH 常用链接 — 分组管理
   规则：分组删除前必须清空组内链接（移出或删除）
   ============================================================ */
const linksView = {
  render() {
    const el = document.getElementById('view-links');
    const d = store.data.links;
    el.innerHTML = `
      <div class="topbar">
        <div class="crumb">SYS://<b>LINKS</b> &gt; BOOKMARKS · ${d.items.length} LINKS</div>
        <span class="sp"></span>
        <button class="btn warn" data-act="newgroup">+ NEW GROUP</button>
      </div>
      <div id="grpBox">
        ${d.groups.map(g => this.grpHTML(g, d.items.filter(i => i.groupId === g.id))).join('')}
        ${this.grpHTML({ id: null, name: 'UNGROUPED', collapsed: false },
          d.items.filter(i => !i.groupId || !d.groups.some(g => g.id === i.groupId)))}
      </div>`;
    this.bind(el);
  },

  grpHTML(g, items) {
    const isUng = g.id === null;
    return `
      <div class="grp" data-gid="${g.id ?? ''}">
        <div class="grp-h">
          <span class="arrow">${g.collapsed ? '[+]' : '[-]'}</span>
          <span class="gname">${ui.esc(g.name)}</span>
          <span class="cnt">// ${items.length} LINKS</span>
          <span class="gops">
            ${!isUng ? '<span class="op" data-act="rename" title="重命名分组">[rename]</span>' : ''}
            ${!isUng ? `<span class="op danger" data-act="delgroup" title="删除分组（需先清空）">[del]</span>` : ''}
          </span>
        </div>
        ${g.collapsed ? '' : `
        <div class="links">
          ${items.map(i => this.cardHTML(i)).join('')}
          <div class="lk add" data-act="newlink" data-gid="${g.id ?? ''}"><span>+ NEW LINK</span></div>
        </div>`}
      </div>`;
  },

  cardHTML(i) {
    return `
      <div class="lk" data-id="${i.id}">
        <div class="ic">${ui.esc(ui.initials(i.title))}</div>
        <div class="txt">
          <div class="n">${ui.esc(i.title)}</div>
          <span class="u">${ui.esc(ui.host(i.url))}</span>
        </div>
        <div class="ops">
          <span class="op" data-act="edit" data-id="${i.id}" title="编辑">[edit]</span>
          <span class="op danger" data-act="del" data-id="${i.id}" title="删除">[del]</span>
        </div>
      </div>`;
  },

  groupOptions(cur) {
    const opts = store.data.links.groups.map(g => [g.id, g.name]);
    opts.push(['', 'UNGROUPED']);
    return opts;
  },

  bind(el) {
    el.onclick = async e => {
      // 1) 顶部/组内操作按钮
      const actEl = e.target.closest('[data-act]');
      if (actEl) {
        const act = actEl.dataset.act;
        if (act === 'newgroup') return this.groupModal();
        if (act === 'newlink') return this.linkModal(null, actEl.dataset.gid || null);
        if (act === 'rename') {
          const gid = actEl.closest('.grp').dataset.gid;
          const g = store.data.links.groups.find(x => x.id === gid);
          if (g) this.groupModal(g);
          return;
        }
        if (act === 'delgroup') {
          const gid = actEl.closest('.grp').dataset.gid;
          const g = store.data.links.groups.find(x => x.id === gid);
          if (!g) return;
          const n = store.data.links.items.filter(i => i.groupId === gid).length;
          if (n > 0) return ui.toast(`组内还有 ${n} 个链接，先移出或删除`, 'warn');
          if (await ui.confirm('删除分组「' + g.name + '」？')) {
            store.data.links.groups = store.data.links.groups.filter(x => x.id !== gid);
            await store.save('links');
            ui.toast('GROUP DELETED');
            this.render();
          }
          return;
        }
        if (act === 'edit' || act === 'del') {
          const it = store.data.links.items.find(x => x.id === actEl.dataset.id);
          if (!it) return;
          if (act === 'edit') return this.linkModal(it);
          if (await ui.confirm('删除链接「' + it.title + '」？')) {
            store.data.links.items = store.data.links.items.filter(x => x.id !== it.id);
            await store.save('links');
            ui.toast('LINK DELETED');
            this.render();
          }
          return;
        }
      }

      // 2) 点击卡片主体 → 跳转
      const card = e.target.closest('.lk');
      if (card && card.dataset.id && !card.classList.contains('add')) {
        const it = store.data.links.items.find(x => x.id === card.dataset.id);
        if (it) window.open(it.url, '_blank', 'noopener');
        return;
      }

      // 3) 点击组头空白处 → 折叠/展开
      const head = e.target.closest('.grp-h');
      if (head) {
        const gid = head.closest('.grp').dataset.gid;
        if (!gid) return; // UNGROUPED 不可折叠
        const g = store.data.links.groups.find(x => x.id === gid);
        if (g) {
          g.collapsed = !g.collapsed;
          await store.save('links');
          this.render();
        }
      }
    };
  },

  groupModal(g) {
    ui.formModal({
      title: g ? 'RENAME GROUP' : 'NEW GROUP',
      fields: [
        { name: 'name', label: '分组名称', required: true, value: g ? g.name : '', placeholder: 'DEV / OPS / READING ...' }
      ],
      submit: 'COMMIT',
      onSubmit: async v => {
        if (g) {
          g.name = v.name;
          ui.toast('GROUP RENAMED');
        } else {
          store.data.links.groups.push({ id: ui.uid('g'), name: v.name, collapsed: false });
          ui.toast('GROUP CREATED');
        }
        await store.save('links');
        this.render();
      }
    });
  },

  linkModal(it, gid) {
    ui.formModal({
      title: it ? 'EDIT LINK' : 'NEW LINK',
      fields: [
        { name: 'title', label: '名称', required: true, value: it ? it.title : '', placeholder: 'GitHub' },
        { name: 'url', label: 'URL', required: true, value: it ? it.url : '', placeholder: 'https://...' },
        { name: 'groupId', label: '所属分组', type: 'select', value: it ? (it.groupId || '') : (gid || ''), options: this.groupOptions() }
      ],
      submit: 'COMMIT',
      onSubmit: async v => {
        if (!/^https?:\/\//i.test(v.url) && !/^file:\/\//i.test(v.url)) {
          ui.toast('URL 需以 http(s):// 开头', 'warn');
          return false;
        }
        if (it) {
          Object.assign(it, { title: v.title, url: v.url, groupId: v.groupId || null });
          ui.toast('LINK UPDATED');
        } else {
          store.data.links.items.unshift({
            id: ui.uid('l'), title: v.title, url: v.url,
            groupId: v.groupId || null, createdAt: ui.nowISO()
          });
          ui.toast('LINK CREATED');
        }
        await store.save('links');
        this.render();
      }
    });
  }
};
