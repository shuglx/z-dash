/* ============================================================
   Z-DASH store — 数据层
   三级读写策略：
   ① FS Access（首选）：授权 data/ 目录后实时读写 JSON 文件
   ② localStorage 缓存：http 模式下的运行时读写 + 手动导出
   ③ 种子数据：file:// 直开且无缓存时的兜底
   ============================================================ */
const store = {
  KEYS: ['todos', 'archive', 'links'],
  PREFIX: 'zdash:',
  mode: 'cache',        // 'fs' | 'cache'
  dirHandle: null,
  data: {},

  /* ---------- IndexedDB（持久化目录句柄） ---------- */
  _idb() {
    return new Promise((res, rej) => {
      const r = indexedDB.open('zdash', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('kv');
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  },
  async _idbGet(k) {
    const db = await this._idb();
    return new Promise((res, rej) => {
      const t = db.transaction('kv').objectStore('kv').get(k);
      t.onsuccess = () => res(t.result);
      t.onerror = () => rej(t.error);
    });
  },
  async _idbSet(k, v) {
    const db = await this._idb();
    return new Promise((res, rej) => {
      const t = db.transaction('kv', 'readwrite').objectStore('kv').put(v, k);
      t.onsuccess = () => res();
      t.onerror = () => rej(t.error);
    });
  },

  /* ---------- 初始化 ---------- */
  async init() {
    // 尝试恢复上次授权的 data 目录
    if ('showDirectoryPicker' in window) {
      try {
        const h = await this._idbGet('dirHandle');
        if (h && (await this._perm(h)) === 'granted') {
          this.dirHandle = h;
          this.mode = 'fs';
        }
      } catch (e) { /* 忽略 */ }
    }
    await Promise.all(this.KEYS.map(k => this.load(k)));
  },
  async _perm(h) {
    try { return await h.queryPermission({ mode: 'readwrite' }); }
    catch (e) { return 'denied'; }
  },

  /* ---------- 连接 data 目录（需用户手势） ---------- */
  async connect() {
    if (!('showDirectoryPicker' in window)) {
      ui.toast('当前浏览器不支持 File System Access', 'warn');
      return false;
    }
    try {
      if (this.dirHandle) {
        // 已有句柄，先尝试补授权
        const p = await this.dirHandle.requestPermission({ mode: 'readwrite' });
        if (p !== 'granted') { ui.toast('目录授权被拒绝', 'warn'); return false; }
      } else {
        this.dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
        await this._idbSet('dirHandle', this.dirHandle);
      }
      this.mode = 'fs';
      await Promise.all(this.KEYS.map(k => this.load(k)));
      ui.toast('DATA 目录已连接 · 实时读写');
      return true;
    } catch (e) {
      if (e.name !== 'AbortError') ui.toast('连接失败: ' + e.message, 'warn');
      return false;
    }
  },

  /* ---------- 读 ---------- */
  async load(key) {
    if (this.mode === 'fs') {
      try {
        this.data[key] = await this._fsRead(key);
        this._cache(key);
        return;
      } catch (e) { /* 文件缺失，走兜底 */ }
    }
    // localStorage 缓存优先（保留运行期修改），其次 fetch 种子文件，最后内置种子
    let obj = this._getCache(key);
    if (!obj) {
      try {
        const r = await fetch('data/' + key + '.json', { cache: 'no-store' });
        if (r.ok) obj = await r.json();
      } catch (e) { /* file:// 或离线 */ }
    }
    if (!obj) obj = JSON.parse(JSON.stringify(window.SEED[key] || { version: 1, items: [] }));
    this.data[key] = obj;
    this._cache(key);
  },
  _getCache(key) {
    try {
      const s = localStorage.getItem(this.PREFIX + key);
      return s ? JSON.parse(s) : null;
    } catch (e) { return null; }
  },
  _cache(key) {
    try { localStorage.setItem(this.PREFIX + key, JSON.stringify(this.data[key])); } catch (e) {}
  },
  async _fsRead(key) {
    const fh = await this.dirHandle.getFileHandle(key + '.json');
    return JSON.parse(await (await fh.getFile()).text());
  },

  /* ---------- 写：localStorage 永远更新；fs 模式同步落盘 ---------- */
  async save(key) {
    this._cache(key);
    if (this.mode === 'fs') {
      try {
        const fh = await this.dirHandle.getFileHandle(key + '.json', { create: true });
        const w = await fh.createWritable();
        await w.write(JSON.stringify(this.data[key], null, 2));
        await w.close();
      } catch (e) {
        ui.toast('写入文件失败: ' + e.message, 'warn');
      }
    }
  },

  /* ---------- 导出（非 fs 模式手动落盘用） ---------- */
  exportAll() {
    this.KEYS.forEach(k => {
      const blob = new Blob([JSON.stringify(this.data[k], null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = k + '.json';
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 500);
    });
    ui.toast('已导出 todos/archive/links.json，覆盖到 data/ 即可');
  }
};
