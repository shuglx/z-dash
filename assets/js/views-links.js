/* ============================================================
   Z-DASH 常用链接 — 分组管理
   规则：分组删除前必须清空组内链接（移出或删除）
   ============================================================ */
const linksView = {
  state: { q: '' },

  // 按名称 / URL 过滤（不区分大小写）
  filtered() {
    const q = this.state.q.trim().toLowerCase();
    if (!q) return store.data.links.items;
    return store.data.links.items.filter(i =>
      (i.title + ' ' + i.url).toLowerCase().includes(q));
  },

  render() {
    const el = document.getElementById('view-links');
    const d = store.data.links;
    // 迁移历史未分组链接：自动归入「默认」分组（每个链接必须属于某个分组）
    const orphans = d.items.filter(i => !d.groups.some(g => g.id === i.groupId));
    if (orphans.length) {
      let def = d.groups.find(g => g.name === '默认');
      if (!def) { def = { id: ui.uid('g'), name: '默认', collapsed: false }; d.groups.push(def); }
      orphans.forEach(i => { i.groupId = def.id; });
      ui.toast(`已将 ${orphans.length} 条未分组链接归入「默认」`, 'warn');
      store.save('links');
    }
    el.innerHTML = `
      <div class="topbar">
        <div class="crumb"><span class="sys">SYS://</span><b>LINKS</b> &gt; BOOKMARKS · <span id="lkCount"></span> LINKS<span class="cur">/</span></div>
        <span class="sp"></span>
        <button class="btn warn" data-act="newgroup">+ NEW GROUP</button>
      </div>
      <input type="text" class="ipt lk-q" id="lkQ" placeholder="grep 关键词... (名称 / URL)" value="${ui.esc(this.state.q)}">
      <div id="grpBox"></div>`;
    el.querySelector('#lkQ').oninput = e => { this.state.q = e.target.value; this.updateGroups(); };
    this.bind(el);
    this.updateGroups();
  },

  // 局部刷新分组区（不重建搜索框, 输入不丢焦）
  updateGroups() {
    const d = store.data.links;
    const q = this.state.q.trim().toLowerCase();
    const items = this.filtered();
    let html = d.groups.map((g, gi) => {
      const its = items.filter(i => i.groupId === g.id);
      if (q && !its.length) return ''; // 搜索时隐藏无匹配分组
      return this.grpHTML(g, its, gi % 4);
    }).join('');
    if (q && !items.length) html = `<div class="lk-empty">[ 无匹配链接 ]</div>`;
    document.getElementById('grpBox').innerHTML = html;
    const cnt = document.getElementById('lkCount');
    if (cnt) cnt.textContent = q ? `${items.length}/${d.items.length}` : d.items.length;
    this.bindDnD();
  },

  grpHTML(g, items, ci = 0) {
    const searching = !!this.state.q.trim();
    const collapsed = searching ? false : g.collapsed; // 搜索时强制展开
    return `
      <div class="grp" data-gid="${g.id}">
        <div class="grp-h">
          <span class="arrow">${collapsed ? '[+]' : '[-]'}</span>
          <span class="gname">${ui.esc(g.name)}</span>
          <span class="cnt">// ${items.length} LINKS</span>
          <span class="gops">
            <span class="op" data-act="rename" title="重命名分组">[rename]</span>
            <span class="op danger" data-act="delgroup" title="删除分组（需先清空）">[del]</span>
          </span>
        </div>
        ${collapsed ? '' : `
        <div class="links">
          ${items.map(i => this.cardHTML(i, ci, !searching)).join('')}
          ${searching ? '' : `<div class="lk add" data-c="${ci}" data-act="newlink" data-gid="${g.id}"><span>+ NEW LINK</span></div>`}
        </div>`}
      </div>`;
  },

  cardHTML(i, ci = 0, drag = false) {
    return `
      <div class="lk" ${drag ? 'draggable="true"' : ''} data-c="${ci}" data-id="${i.id}" ${drag ? 'title="拖拽可换组 / 调序"' : ''}>
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

  /* ---------- 拖拽: 卡片拖到其他组或组内调序（搜索过滤时停用） ----------
     拖动过程中实时 DOM 移位 + FLIP 过渡 = 其余卡被"挤开"的动效;
     落点在某卡左/右半侧 → 插到其前/后; 组空白区 / 组头 → 挪到组末尾;
     松手后按最终 DOM 顺序回写 items(顺序 + groupId); ESC 取消则还原 */
  bindDnD() {
    if (this.state.q.trim()) return;   // 搜索过滤时卡片不可拖
    const box = document.getElementById('grpBox');
    if (!box) return;
    let draggedEl = null;
    let dropped = false;
    const clearMarks = () => box.querySelectorAll('.drop-in').forEach(el => el.classList.remove('drop-in'));

    /* FLIP: 记录旧位置 → DOM 移位 → 反向位移归零过渡, 其余卡平滑滑开 */
    const flipMove = insert => {
      const els = [...box.querySelectorAll('.lk')];
      const first = new Map(els.map(el => [el, el.getBoundingClientRect()]));
      insert();
      els.forEach(el => {
        const f = first.get(el);
        if (!f) return;
        const l = el.getBoundingClientRect();
        const dx = f.left - l.left, dy = f.top - l.top;
        if (dx || dy) {
          el.style.transition = 'none';
          el.style.transform = `translate(${dx}px,${dy}px)`;
        }
      });
      void box.offsetHeight;   // 回流一次, 让起始位移先生效
      els.forEach(el => {
        if (!el.style.transform) return;
        el.style.transition = 'transform .2s cubic-bezier(.2,.8,.3,1)';
        el.style.transform = '';
      });
    };

    // 挪到某卡前/后（跨组时连颜色标识一起换成目标组色）
    const moveToCard = (card, side) => flipMove(() => {
      card.parentNode.insertBefore(draggedEl, side === 'before' ? card : card.nextSibling);
      if (draggedEl.dataset.c !== card.dataset.c) draggedEl.dataset.c = card.dataset.c;
    });

    // 挪到某组末尾（+ NEW LINK 磁贴之前）
    const moveToEnd = grp => {
      const links = grp.querySelector('.links');
      if (!links) return;
      flipMove(() => {
        links.insertBefore(draggedEl, links.querySelector('.lk.add'));
        draggedEl.dataset.c = String([...box.querySelectorAll('.grp')].indexOf(grp) % 4);
      });
    };

    // 松手落定: 按当前 DOM 顺序回写 items（数组顺序 = 组序 + 组内序, 跨组同步 groupId）
    const commitDOM = async () => {
      if (!draggedEl) return;
      const d = store.data.links;
      const order = new Map([...box.querySelectorAll('.lk[data-id]')].map((el, i) => [el.dataset.id, i]));
      const gidOf = {};
      box.querySelectorAll('.grp').forEach(grp =>
        grp.querySelectorAll('.lk[data-id]').forEach(el => { gidOf[el.dataset.id] = grp.dataset.gid; }));
      d.items.sort((a, b) => order.get(a.id) - order.get(b.id));
      d.items.forEach(it => { if (gidOf[it.id]) it.groupId = gidOf[it.id]; });
      await store.save('links');
      this.updateGroups();
    };

    box.querySelectorAll('.lk[data-id]').forEach(card => {
      card.ondragstart = e => {
        draggedEl = card; dropped = false;
        e.dataTransfer.setData('text/plain', card.dataset.id);
        e.dataTransfer.effectAllowed = 'move';
        card.classList.add('dragging');
      };
      card.ondragend = () => {
        card.classList.remove('dragging');
        clearMarks();
        if (!dropped) this.updateGroups();   // ESC 取消 / 拖出界: 丢弃临时 DOM 移位, 还原
        draggedEl = null;
      };
      card.ondragover = e => {
        e.preventDefault(); e.stopPropagation();   // 卡片自身是落点, 不冒泡给组容器
        e.dataTransfer.dropEffect = 'move';
        if (!draggedEl || card === draggedEl) return;
        const r = card.getBoundingClientRect();
        const side = e.clientX < r.left + r.width / 2 ? 'before' : 'after';
        // 已停在该卡前/后 → 无需移动（防抖: 中线两侧各自稳定）
        if (draggedEl.parentNode === card.parentNode &&
            (side === 'before' ? card.previousElementSibling : card.nextElementSibling) === draggedEl) return;
        moveToCard(card, side);
      };
      card.ondrop = e => {
        e.preventDefault(); e.stopPropagation();
        dropped = true;
        commitDOM();
      };
    });

    // 组内空白区 / + NEW LINK 磁贴 → 挪到组末尾
    box.querySelectorAll('.links').forEach(lnk => {
      lnk.ondragover = e => {
        e.preventDefault(); e.dataTransfer.dropEffect = 'move';
        lnk.classList.add('drop-in');
        if (!draggedEl) return;
        const cards = lnk.querySelectorAll('.lk[data-id]');
        if (cards.length && cards[cards.length - 1] === draggedEl) return;   // 已在组尾
        moveToEnd(lnk.closest('.grp'));
      };
      lnk.ondragleave = e => { if (!lnk.contains(e.relatedTarget)) lnk.classList.remove('drop-in'); };
      lnk.ondrop = e => {
        e.preventDefault();
        lnk.classList.remove('drop-in');
        dropped = true;
        commitDOM();
      };
    });

    // 组头: 展开组 → 挪到组末尾; 折叠组(无 .links 容器) → 数据级追加
    box.querySelectorAll('.grp-h').forEach(h => {
      h.ondragover = e => {
        e.preventDefault(); e.dataTransfer.dropEffect = 'move';
        h.classList.add('drop-in');
        const grp = h.closest('.grp');
        if (draggedEl && grp.querySelector('.links')) moveToEnd(grp);
      };
      h.ondragleave = e => { if (!h.contains(e.relatedTarget)) h.classList.remove('drop-in'); };
      h.ondrop = e => {
        e.preventDefault();
        h.classList.remove('drop-in');
        const grp = h.closest('.grp');
        dropped = true;
        if (grp.querySelector('.links')) commitDOM();
        else if (draggedEl) this.dropAppend(draggedEl.dataset.id, grp.dataset.gid);
      };
    });
  },

  // 追加到某组末尾（折叠组组头落点用: 无 DOM 容器, 直接改数据重渲染）
  async dropAppend(id, gid) {
    const items = store.data.links.items;
    const it = items.find(x => x.id === id);
    if (!it || !store.data.links.groups.some(g => g.id === gid)) return;
    it.groupId = gid;
    items.splice(items.indexOf(it), 1);
    let idx = -1;
    items.forEach((x, i) => { if (x.groupId === gid) idx = i; });
    items.splice(idx + 1, 0, it);
    await store.save('links');
    this.updateGroups();
  },

  groupOptions(cur) {
    return store.data.links.groups.map(g => [g.id, g.name]);
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
          if (n > 0) return ui.toast(`组内还有 ${n} 个链接，先移至其他分组或删除`, 'warn');
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
      //    桌面端: shell.openExternal 走系统默认浏览器/文件管理器（smb:// 等协议才能正确触发）
      const card = e.target.closest('.lk');
      if (card && card.dataset.id && !card.classList.contains('add')) {
        const it = store.data.links.items.find(x => x.id === card.dataset.id);
        if (it) {
          if (window.zdDesktop) zdDesktop.openExternal(it.url);
          else window.open(it.url, '_blank', 'noopener');
        }
        return;
      }

      // 3) 点击组头空白处 → 折叠/展开
      const head = e.target.closest('.grp-h');
      if (head) {
        const gid = head.closest('.grp').dataset.gid;
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
    if (!store.data.links.groups.length) {
      ui.toast('请先创建一个分组', 'warn');
      return this.groupModal();
    }
    ui.formModal({
      title: it ? 'EDIT LINK' : 'NEW LINK',
      fields: [
        { name: 'title', label: '名称', required: true, value: it ? it.title : '', placeholder: 'GitHub' },
        { name: 'url', label: 'URL', required: true, value: it ? it.url : '', placeholder: 'https://...' },
        { name: 'groupId', label: '所属分组', type: 'select', required: true, value: it ? it.groupId : (gid || store.data.links.groups[0].id), options: this.groupOptions() }
      ],
      submit: 'COMMIT',
      onSubmit: async v => {
        if (!/^[a-z][a-z0-9+.-]*:/i.test(v.url)) {
          ui.toast('URL 需以协议开头（如 https://、smb://、ssh://、mailto:）', 'warn');
          return false;
        }
        if (it) {
          Object.assign(it, { title: v.title, url: v.url, groupId: v.groupId });
          ui.toast('LINK UPDATED');
        } else {
          store.data.links.items.unshift({
            id: ui.uid('l'), title: v.title, url: v.url,
            groupId: v.groupId, createdAt: ui.nowISO()
          });
          ui.toast('LINK CREATED');
        }
        await store.save('links');
        this.render();
      }
    });
  }
};
