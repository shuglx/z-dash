/* ============================================================
   Z-DASH store — 数据层
   后端模式: 由 server.js 承担 data/*.json 的实时读写
   - 读取: GET /api/<key>
   - 写入: PUT /api/<key>  (每次修改实时落盘)
   后端不可达时(如 file:// 直开)降级到内置种子数据(只读)
   ============================================================ */
const store = {
  KEYS: ['todos', 'archive', 'links'],
  mode: 'seed',         // 'server' | 'seed'
  data: {},

  async _get(key) {
    const r = await fetch('api/' + key, { cache: 'no-store' });
    if (!r.ok) throw new Error('http ' + r.status);
    return r.json();
  },
  async _put(key) {
    const r = await fetch('api/' + key, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(this.data[key], null, 2)
    });
    if (!r.ok) throw new Error('http ' + r.status);
  },

  /* ---------- 初始化: 并行拉取三个数据集 ---------- */
  async init() {
    const results = await Promise.all(this.KEYS.map(async k => {
      try { return { k, data: await this._get(k) }; }
      catch (e) { return { k, data: null }; }
    }));
    const anyOk = results.some(r => r.data);
    results.forEach(r => {
      this.data[r.k] = r.data ||
        JSON.parse(JSON.stringify(window.SEED[r.k] || { version: 1, items: [] }));
    });
    this.mode = anyOk ? 'server' : 'seed';
  },

  /* ---------- 写: 实时 PUT 到后端落盘 ---------- */
  async save(key) {
    if (this.mode !== 'server') return;   // 种子模式只读
    try {
      await this._put(key);
    } catch (e) {
      ui.toast('写入失败: ' + e.message, 'warn');
    }
  }
};
