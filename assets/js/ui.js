/* ============================================================
   Z-DASH ui — 通用工具：转义 / id / 日期 / toast / 弹层表单 / 确认框
   ============================================================ */
const ui = {
  esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  },
  uid(p) {
    return p + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  },
  fmtMD(d) {
    if (!d) return '';
    return String(d).slice(5, 10);
  },
  today() {
    return new Date().toISOString().slice(0, 10);
  },
  nowISO() {
    return new Date().toISOString();
  },
  host(url) {
    try { return new URL(url).host; } catch (e) { return url; }
  },
  initials(title) {
    const w = String(title || '').replace(/[^\p{L}\p{N} ]/gu, '').trim().split(/\s+/).filter(Boolean);
    return (w.map(x => x[0]).join('') || 'L').slice(0, 2).toUpperCase();
  },

  /* ---------- Toast ---------- */
  _toastTimer: null,
  toast(msg, type) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.className = 'toast' + (type === 'warn' ? ' warn' : '');
    el.hidden = false;
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => { el.hidden = true; }, 2600);
  },

  /* ---------- 弹层基础 ---------- */
  _mask: null, _box: null,
  _open(html) {
    this._mask = document.getElementById('modalMask');
    this._box = document.getElementById('modalBox');
    this._box.innerHTML = html;
    this._mask.hidden = false;
  },
  close() {
    if (this._mask) this._mask.hidden = true;
    if (this._box) this._box.innerHTML = '';
  },

  /* ---------- 表单弹层 ----------
     fields: [{name,label,type('text'|'select'|'date'),options[[v,l]],value,required,placeholder}]
     onSubmit(values) 返回 false 则不关闭 */
  formModal({ title, fields, submit, onSubmit }) {
    const     fieldHTML = f => {
      if (f.type === 'select') {
        const opts = f.options.map(o =>
          `<option value="${this.esc(o[0])}" ${String(o[0]) === String(f.value) ? 'selected' : ''}>${this.esc(o[1])}</option>`).join('');
        return `<div class="fld"><label>${this.esc(f.label)}</label><select class="ipt" name="${f.name}">${opts}</select></div>`;
      }
      if (f.type === 'textarea') {
        return `<div class="fld"><label>${this.esc(f.label)}</label><textarea class="ipt" name="${f.name}" rows="${f.rows || 3}" placeholder="${this.esc(f.placeholder || '')}" ${f.required ? 'required' : ''}>${f.value ? this.esc(f.value) : ''}</textarea></div>`;
      }
      return `<div class="fld"><label>${this.esc(f.label)}</label><input class="ipt" name="${f.name}" type="${f.type || 'text'}" value="${f.value ? this.esc(f.value) : ''}" placeholder="${this.esc(f.placeholder || '')}" ${f.required ? 'required' : ''}></div>`;
    };
    this._open(`
      <div class="m-h">${this.esc(title)}</div>
      <form class="m-b">${fields.map(fieldHTML).join('')}</form>
      <div class="m-f">
        <button type="button" class="btn ghost" data-x>CANCEL</button>
        <button type="button" class="btn warn" data-ok>${this.esc(submit || 'COMMIT')}</button>
      </div>`);
    const form = this._box.querySelector('form');
    this._box.querySelector('[data-x]').onclick = () => this.close();
    this._mask.onclick = e => { if (e.target === this._mask) this.close(); };
    this._box.querySelector('[data-ok]').onclick = async () => {
      const v = {};
      new FormData(form).forEach((val, k) => { v[k] = String(val).trim(); });
      for (const f of fields) {
        if (f.required && !v[f.name]) { this.toast('必填项缺失: ' + f.label, 'warn'); return; }
      }
      const r = await onSubmit(v);
      if (r !== false) this.close();
    };
    const first = form.querySelector('input:not([type=date]),select');
    if (first) first.focus();
  },

  /* ---------- 确认框 ---------- */
  confirm(msg) {
    return new Promise(res => {
      this._open(`
        <div class="m-h">CONFIRM</div>
        <div class="m-b"><div class="msg">${this.esc(msg)}</div></div>
        <div class="m-f">
          <button type="button" class="btn ghost" data-x>CANCEL</button>
          <button type="button" class="btn warn" data-y>EXECUTE</button>
        </div>`);
      this._box.querySelector('[data-x]').onclick = () => { this.close(); res(false); };
      this._box.querySelector('[data-y]').onclick = () => { this.close(); res(true); };
      this._mask.onclick = e => { if (e.target === this._mask) { this.close(); res(false); } };
    });
  },

  /* ---------- 只读详情弹窗 ----------
     title: 标题; rows: [{k, v, raw?}] 键值行, v 为文本; v 可为空则不显示该行
     raw: 详情多行文本(保留换行) */
  view(title, rows) {
    const body = rows.filter(r => r.v).map(r =>
      `<div class="vrow"><span class="vk">${this.esc(r.k)}</span>` +
      (r.raw ? `<span class="vv raw">${this.esc(r.v)}</span>` : `<span class="vv">${this.esc(r.v)}</span>`)
      + `</div>`).join('');
    this._open(`
      <div class="m-h">${this.esc(title)}</div>
      <div class="m-b view">${body}</div>
      <div class="m-f"><button type="button" class="btn ghost" data-x>CLOSE</button></div>`);
    this._box.querySelector('[data-x]').onclick = () => this.close();
    this._mask.onclick = e => { if (e.target === this._mask) this.close(); };
  }
};
