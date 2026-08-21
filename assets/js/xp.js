/* ============================================================
   Z-DASH XP — 街区声望系统（机制 v1.1, 纯派生计算, 不新增数据文件）
   - 结算点 = 归档动作（todoView.archive）; 单条 XP = 优先级基础分 + STREAK 加成
   - streak 按工作日连续: 周六/日自动跳过不断签; 今日未归档不判死
   - 等级: Lv1-24 每级 50+25(L-1); Lv25-49 每级 710+85(L-25); 封顶 Lv50
   - 零点起算: config.xpSince 锚点（首次启动写入当天）, 仅 doneAt >= 锚点的归档计分
   ============================================================ */
const xp = {
  BASE: { P0: 30, P1: 20, P2: 10 },
  STREAK_BONUS: [[30, 60], [14, 30], [7, 15], [3, 5]],   // [连续工作日数, 加成XP] 自高向低
  MAX_LV: 50,
  TIERS: [
    { lv: 1,  glyph: '·', code: 'NOBODY',     name: '无名之辈',   cls: 't0' },
    { lv: 5,  glyph: '▸', code: 'ROOKIE',     name: '街区新人',   cls: 't1' },
    { lv: 10, glyph: '◆', code: 'STREET KID', name: '街头小子',   cls: 't2' },
    { lv: 15, glyph: '◈', code: 'FIXER',      name: '中间人',     cls: 't3' },
    { lv: 20, glyph: '✦', code: 'NETRUNNER',  name: '网络黑客',   cls: 't4' },
    { lv: 27, glyph: '❖', code: 'CORPO',      name: '企业寡头',   cls: 't5' },
    { lv: 35, glyph: '★', code: 'LEGEND',     name: '夜之城传奇', cls: 't6' },
    { lv: 45, glyph: 'Ω', code: 'ICON',       name: '活着的传说', cls: 't7' }
  ],

  /* ---------- 初始化: 写入零点锚点 + 渲染侧栏挂件 ---------- */
  init() {
    const cfg = store.data.config;
    if (!cfg.xpSince) {
      cfg.xpSince = ui.today();
      store.save('config');   // seed 只读模式内部自动跳过
    }
    // 已展示等级记忆（升级弹窗判据）: 首次访问静默对齐当前等级; 数据重置后向下同步, 不吞后续升级弹窗
    try {
      const cur = this.calc().level;
      const seen = Number(localStorage.getItem('zd-xp-lv')) || 0;
      if (!seen || seen > cur) localStorage.setItem('zd-xp-lv', String(cur));
    } catch (e) {}
    this.renderWidget();
  },
  since() { return store.data.config.xpSince || '0000-01-01'; },

  /* ---------- 数据派生 ---------- */
  // 计分记录: 完成日 >= 锚点的归档（更早的历史记录保留展示, 只是不计分）
  scored() {
    const since = this.since();
    return store.data.archive.items.filter(a => {
      const d = (a.doneAt || '').slice(0, 10);
      return d && d >= since;
    });
  },
  // 有归档的日期集合 { 'YYYY-MM-DD': 条数 }
  daySet() {
    const set = {};
    this.scored().forEach(a => {
      const d = (a.doneAt || '').slice(0, 10);
      if (d) set[d] = (set[d] || 0) + 1;
    });
    return set;
  },

  dstr(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  },
  isWorkday(ds) {
    const g = new Date(ds + 'T00:00:00').getDay();
    return g !== 0 && g !== 6;
  },
  // ds 之前最近的一个工作日
  prevWorkday(ds) {
    const d = new Date(ds + 'T00:00:00');
    do { d.setDate(d.getDate() - 1); } while (d.getDay() === 0 || d.getDay() === 6);
    return this.dstr(d);
  },
  // 结束于 ds 的连续工作日 streak（回溯时周末直接跳过; ds 为周末则自其前一工作日算起）
  streakOn(ds, set) {
    let n = 0, cur = ds;
    if (!this.isWorkday(cur)) cur = this.prevWorkday(cur);
    while (set[cur]) { n++; cur = this.prevWorkday(cur); }
    return n;
  },
  // 当前 streak: 周末 / 今日（工作日）尚未归档 均不判死, 按最近有归档的工作日回溯
  currentStreak(set) {
    set = set || this.daySet();
    const today = ui.today();
    if (this.isWorkday(today) && set[today]) return this.streakOn(today, set);
    const prev = this.prevWorkday(today);
    return set[prev] ? this.streakOn(prev, set) : 0;
  },
  bestStreak(set) {
    set = set || this.daySet();
    const days = Object.keys(set).filter(d => this.isWorkday(d)).sort();
    let best = 0, run = 0, prev = null;
    days.forEach(d => {
      run = prev && this.prevWorkday(d) === prev ? run + 1 : 1;
      if (run > best) best = run;
      prev = d;
    });
    return best;
  },
  streakBonus(s) {
    for (const [d, b] of this.STREAK_BONUS) if (s >= d) return b;
    return 0;
  },
  // 单条归档记录得分 = 优先级基础分 + 该完成日 streak 加成
  recordXP(a, set) {
    set = set || this.daySet();
    const base = this.BASE[a.priority] || this.BASE.P2;
    const d = (a.doneAt || '').slice(0, 10);
    const bonus = d ? this.streakBonus(this.streakOn(d, set)) : 0;
    return { base, bonus, xp: base + bonus };
  },

  /* ---------- 等级 ---------- */
  // Lv L → L+1 所需 XP（25 级起每级 +85 递增, 前段每级 +25）
  needXP(l) { return l < 25 ? 50 + 25 * (l - 1) : 710 + 85 * (l - 25); },
  levelOf(total) {
    let lv = 1, floor = 0;
    while (lv < this.MAX_LV && total >= floor + this.needXP(lv)) { floor += this.needXP(lv); lv++; }
    const need = lv < this.MAX_LV ? this.needXP(lv) : 0;
    const pct = need ? Math.min(100, Math.round((total - floor) / need * 100)) : 100;
    return { level: lv, floor, need, pct };
  },
  tierOf(lv) {
    let t = this.TIERS[0];
    this.TIERS.forEach(x => { if (lv >= x.lv) t = x; });
    return t;
  },
  nextTier(lv) { return this.TIERS.find(x => x.lv > lv) || null; },

  /* ---------- 汇总（挂件 / STATS 面板共用） ---------- */
  calc() {
    const set = this.daySet();
    let total = 0, baseSum = 0, bonusSum = 0;
    const byPri = { P0: 0, P1: 0, P2: 0 };
    this.scored().forEach(a => {
      const r = this.recordXP(a, set);
      total += r.xp; baseSum += r.base; bonusSum += r.bonus;
      byPri[a.priority] = (byPri[a.priority] || 0) + 1;
    });
    return Object.assign(this.levelOf(total), {
      total, baseSum, bonusSum, byPri,
      streak: this.currentStreak(set), best: this.bestStreak(set),
      scoredCount: this.scored().length
    });
  },
  fmt(n) { return n.toLocaleString('en-US'); },

  /* ---------- 侧边栏挂件 ---------- */
  widgetHTML(c) {
    const t = this.tierOf(c.level);
    const on = Math.round(c.pct / 10);
    return `
      <div class="t">STREET CRED</div>
      <div class="cred-head">
        <span class="badge" title="${t.code} · ${t.name}">${t.glyph}</span>
        <span class="lv">LV.${c.level}</span>
        <span class="code">${t.code}</span>
      </div>
      <div class="cred-xp">XP ${this.fmt(c.total)}${c.need ? ' / ' + this.fmt(c.floor + c.need) : ' · MAX'}</div>
      <div class="cred-bar">${Array.from({ length: 10 }, (_, i) => `<i${i < on ? ' class="on"' : ''}></i>`).join('')}</div>
      <div class="cred-streak"><span class="s">▲ STREAK ${c.streak}D</span><span class="b">BEST ${c.best}D</span></div>`;
  },
  renderWidget() {
    const el = document.getElementById('credWidget');
    if (!el) return;
    const c = this.calc();
    el.className = 'cred ' + this.tierOf(c.level).cls;
    el.innerHTML = this.widgetHTML(c);
  },

  /* ---------- 归档结算反馈（todoView.archive 保存后调用） ---------- */
  afterArchive(rec) {
    const r = this.recordXP(rec);
    const c = this.calc();
    ui.toast(`ARCHIVED → +${r.xp} XP (${rec.priority || 'P2'} ${r.base}${r.bonus ? ' + STREAK ' + r.bonus : ''})`);
    this.renderWidget();
    let seen = 0;
    try { seen = Number(localStorage.getItem('zd-xp-lv')) || 0; } catch (e) {}
    try { localStorage.setItem('zd-xp-lv', String(c.level)); } catch (e) {}
    if (c.level > seen) setTimeout(() => this.levelUpModal(c), 400);
  },

  /* ---------- LEVEL UP 弹窗 ---------- */
  levelUpHTML(c) {
    const t = this.tierOf(c.level);
    return `
      <div class="m-h lvl">▲ STREET CRED UP</div>
      <div class="m-b lvlup">
        <span class="badge big ${t.cls}">${t.glyph}</span>
        <div class="lv-n ${t.cls}">LV.${c.level}</div>
        <div class="lv-code ${t.cls}">${t.code} · ${t.name}</div>
        <div class="lv-xp">TOTAL ${this.fmt(c.total)} XP</div>
      </div>
      <div class="m-f"><button type="button" class="btn gold" data-x>CLOSE</button></div>`;
  },
  levelUpModal(c) {
    ui._open(this.levelUpHTML(c));
    ui._box.querySelector('[data-x]').onclick = () => ui.close();
  },

  /* ---------- STATS 页声望面板（views-stats 调用; withBtn 附加"阶位总览"入口） ---------- */
  panelHTML(c, withBtn) {
    c = c || this.calc();
    const t = this.tierOf(c.level);
    const nt = this.nextTier(c.level);
    const nextTxt = c.need
      ? `还差 ${this.fmt(c.floor + c.need - c.total)} XP 升级`
      : '已封顶';
    return `
      <div class="panel cred-panel ${t.cls}">
        <div class="panel-h">STREET CRED${withBtn ? '<button type="button" class="btn mini ghost cred-q" data-act="credTiers"><svg viewBox="0 0 16 16" width="11" height="11" aria-hidden="true"><path d="M1.5 8s2.5-4.5 6.5-4.5S14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8Z" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="8" cy="8" r="2" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>阶位</button><span class="tag adj">街区声望 · 归档即结算</span>' : '<span class="tag">街区声望 · 归档即结算</span>'}</div>
        <div class="panel-b">
          <div class="cp-main">
            <span class="badge big" title="${t.code} · ${t.name}">${t.glyph}</span>
            <div class="cp-lv">
              <div class="l1">LV.${c.level}<span class="code">${t.code} · ${t.name}</span></div>
              <div class="l2">XP ${this.fmt(c.total)}${c.need ? ' / ' + this.fmt(c.floor + c.need) : ' · MAX'} · ${nextTxt}</div>
              <div class="cp-bar"><i style="width:${c.pct}%"></i></div>
              <div class="l3">${nt ? `下一阶位 ${nt.glyph} ${nt.code} · ${nt.name} · LV.${nt.lv}` : '已抵达最高阶位 Ω ICON'}</div>
            </div>
            <div class="cp-streak">
              <div class="cell"><div class="s">▲ ${c.streak}D</div><div class="l">STREAK</div></div>
              <div class="cell"><div class="s">${c.best}D</div><div class="l">BEST</div></div>
            </div>
          </div>
          <div class="cp-sub">
            <span>基础 ${this.fmt(c.baseSum)} XP</span>
            <span>STREAK 加成 ${this.fmt(c.bonusSum)} XP</span>
            <span>P0 ×${c.byPri.P0} · P1 ×${c.byPri.P1} · P2 ×${c.byPri.P2}</span>
            <span>计分归档 ${c.scoredCount} 条</span>
          </div>
        </div>
      </div>`;
  },

  /* ---------- 阶位总览（STATS 预览弹层 / demo-cred 页共用） ---------- */
  // 累计到 LV.lv 所需总 XP
  totalForLV(lv) {
    let s = 0;
    for (let l = 1; l < lv; l++) s += this.needXP(l);
    return s;
  },
  // 各阶位代表档案（等级取阶位中段; XP 由真实曲线计算）
  GALLERY: [
    { lv: 3,  frac: .45, streak: 3,  best: 5,  p: [1, 2, 3] },
    { lv: 7,  frac: .45, streak: 7,  best: 10, p: [5, 8, 12] },
    { lv: 12, frac: .45, streak: 12, best: 16, p: [10, 16, 28] },
    { lv: 17, frac: .45, streak: 17, best: 21, p: [16, 28, 50] },
    { lv: 23, frac: .45, streak: 23, best: 27, p: [26, 45, 80] },
    { lv: 30, frac: .45, streak: 30, best: 34, p: [40, 68, 115] },
    { lv: 40, frac: .45, streak: 38, best: 43, p: [90, 150, 260] },
    { lv: 50, frac: 0,   streak: 47, best: 52, p: [140, 230, 400] }
  ],
  // 由代表档案构造 calc() 形状的结果（不读真实数据）
  galleryCalc(d) {
    const max = d.lv >= this.MAX_LV;
    const total = max ? this.totalForLV(this.MAX_LV) : this.totalForLV(d.lv) + Math.round(this.needXP(d.lv) * d.frac);
    const baseSum = d.p[0] * 30 + d.p[1] * 20 + d.p[2] * 10;
    return Object.assign(this.levelOf(total), {
      total, baseSum, bonusSum: Math.max(0, total - baseSum),
      byPri: { P0: d.p[0], P1: d.p[1], P2: d.p[2] },
      streak: d.streak, best: d.best,
      scoredCount: d.p[0] + d.p[1] + d.p[2]
    });
  },
  // LEVEL UP 弹窗预览（STREET KID / NETRUNNER / ICON 三个代表阶位）
  levelUpRowHTML() {
    return [2, 4, 7].map(i => {
      const t = this.TIERS[i];
      const d = Object.assign({}, this.GALLERY[i], { lv: t.lv, frac: 0 });
      return `<div class="modal">${this.levelUpHTML(this.galleryCalc(d))}</div>`;
    }).join('');
  },
  // 8 阶位区块：侧栏挂件 + STATS 面板
  tiersHTML() {
    return this.TIERS.map((t, i) => {
      const c = this.galleryCalc(this.GALLERY[i]);
      const end = i < this.TIERS.length - 1 ? this.TIERS[i + 1].lv - 1 : this.MAX_LV;
      const gate = t.lv <= 1 ? 'XP ≥ 0' : '累计 XP ≥ ' + this.fmt(this.totalForLV(t.lv));
      return `
        <div class="tier-sec ${t.cls}">
          <div class="sec-h">
            <span class="no">#0${i + 1}</span><span class="nm">${t.glyph} ${t.code} · ${t.name}</span>
            <span class="rng">LV.${t.lv} ~ ${end}</span>
            <span class="gate">${gate}</span>
          </div>
          <div class="sec-b">
            <div class="side-sim"><div class="cred ${t.cls}">${this.widgetHTML(c)}</div></div>
            ${this.panelHTML(c)}
          </div>
        </div>`;
    }).join('');
  },
  // 阶位总览弹层（STATS 页"▲ 阶位总览"按钮触发）
  tierModal() {
    ui._open(`
      <div class="m-h">▲ STREET CRED · 阶位总览</div>
      <div class="m-b view cred-gallery">
        <div class="g-sec-t">LEVEL UP 弹窗 · 三个代表阶位</div>
        <div class="lvup-row">${this.levelUpRowHTML()}</div>
        <div class="g-sec-t">各阶位 · 挂件 + STATS 面板</div>
        <div class="tier-grid">${this.tiersHTML()}</div>
      </div>
      <div class="m-f"><button type="button" class="btn ghost" data-x>CLOSE</button></div>`);
    ui._box.classList.add('wide');
    // 注意: 画廊内 LEVEL UP 预览卡也含 [data-x], 用 :scope > .m-f 只绑弹层真实底部按钮
    const closeBtn = ui._box.querySelector(':scope > .m-f [data-x]');
    if (closeBtn) closeBtn.onclick = () => ui.close();
  }
};
