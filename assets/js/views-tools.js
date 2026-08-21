/* ============================================================
   Z-DASH 工具抽屉 — 开发者三件套
   1) 时间戳转换：unix(s/ms 自动识别) ⇄ 日期时间, 附 ISO/相对时间
   2) JSON：格式化 / 压缩 / 复制, 错误定位提示
   3) 正则测试：实时高亮匹配 + 命中列表（含捕获组）
   纯前端计算, 不落盘
   ============================================================ */
const toolsView = {
  render() {
    const el = document.getElementById('view-tools');
    el.innerHTML = `
      <div class="topbar">
        <div class="crumb"><span class="sys">SYS://</span><b>TOOLS</b> &gt; DRAWER · DEV KIT<span class="cur">/</span></div>
      </div>
      <div class="tool-grid">
        <div class="panel">
          <div class="panel-h">TIMESTAMP<span class="tag">时间戳 ⇄ 日期</span></div>
          <div class="panel-b">
            <div class="fld"><label>UNIX 时间戳（秒 / 毫秒自动识别）</label>
              <div class="ts-row">
                <input type="text" class="ipt" id="tsIn" placeholder="1755700000 / 1755700000000">
                <button type="button" class="btn mini c-amber" id="tsNow" title="填入当前时间戳">NOW</button>
              </div>
            </div>
            <div class="ts-out" id="tsOut"></div>
            <div class="fld"><label>日期时间 → 时间戳</label>
              <div class="dt-pick">
                <input type="text" class="ipt" id="dtIn" placeholder="点击选择日期 →" readonly>
                <button type="button" class="btn mini c-amber" id="dtToday">TODAY</button>
                <div class="tcal" id="tcal" hidden>
                  <div class="tcal-h">
                    <button type="button" class="tcal-nav" id="tcalPrev">◀</button>
                    <span id="tcalTitle"></span>
                    <button type="button" class="tcal-nav" id="tcalNext">▶</button>
                  </div>
                  <div class="tcal-wk"><span>日</span><span>一</span><span>二</span><span>三</span><span>四</span><span>五</span><span>六</span></div>
                  <div class="tcal-gd" id="tcalGrid"></div>
                  <div class="tcal-tm">
                    <input type="number" class="ipt tcal-t" id="tcalH" value="0"> :
                    <input type="number" class="ipt tcal-t" id="tcalM" value="0"> :
                    <input type="number" class="ipt tcal-t" id="tcalS" value="0">
                    <button type="button" class="btn mini tcal-ok" id="tcalOk">确定</button>
                  </div>
                </div>
              </div>
            </div>
            <div class="ts-out" id="dtOut"></div>
          </div>
        </div>
        <div class="panel">
          <div class="panel-h">JSON<span class="tag">格式化 / 压缩 / 复制</span></div>
          <div class="panel-b">
            <div class="fld"><label>JSON 文本</label>
              <textarea class="ipt" id="jsonIn" rows="8" placeholder='{"name":"z-dash","tags":["cyber","terminal"]}'></textarea>
            </div>
            <div class="ts-row tool-ops">
              <button type="button" class="btn mini" id="jsonFmt">FORMAT</button>
              <button type="button" class="btn mini" id="jsonMin">COMPRESS</button>
              <button type="button" class="btn mini" id="jsonCopy">COPY</button>
            </div>
            <pre class="ts-out json-out" id="jsonOut"></pre>
          </div>
        </div>
        <div class="panel">
          <div class="panel-h">REGEX<span class="tag">正则测试 · 实时高亮</span></div>
          <div class="panel-b">
            <div class="fld"><label>正则表达式</label>
              <div class="ts-row">
                <span class="re-slash">/</span>
                <input type="text" class="ipt" id="reIn" placeholder="\\w+@\\w+\\.\\w+">
                <span class="re-slash">/</span>
                <input type="text" class="ipt re-flags" id="reFlags" value="g" title="flags: g i m s u y">
              </div>
            </div>
            <div class="fld"><label>测试文本</label>
              <textarea class="ipt" id="reTxt" rows="4" placeholder="粘贴待匹配文本..."></textarea>
            </div>
            <div class="ts-out" id="reOut"></div>
          </div>
        </div>
        <div class="panel">
          <div class="panel-h">ENCODE<span class="tag">MD5 / Base64 / URL</span></div>
          <div class="panel-b">
            <div class="fld"><label>输入文本</label>
              <textarea class="ipt" id="encIn" rows="4" placeholder="输入要编码 / 计算哈希的文本..."></textarea>
            </div>
            <div class="ts-row tool-ops">
              <button type="button" class="btn mini c-orange" id="encMd5">MD5</button>
              <button type="button" class="btn mini c-purple" id="encB64e">B64 ENCODE</button>
              <button type="button" class="btn mini c-purple" id="encB64d">B64 DECODE</button>
              <button type="button" class="btn mini c-blue" id="encUrl">URL 编</button>
              <button type="button" class="btn mini c-blue" id="encUrlD">URL 解</button>
            </div>
            <div class="fld"><label>结果<span class="hint-inline">（点击结果可复制）</span></label>
              <pre class="ts-out enc-out" id="encOut"></pre>
            </div>
            <div class="ts-row tool-ops" style="margin-top:8px">
              <button type="button" class="btn mini" id="encUpper">大写</button>
              <button type="button" class="btn mini" id="encLower">小写</button>
              <button type="button" class="btn mini" id="encCopy">COPY</button>
            </div>
          </div>
        </div>
      </div>`;
    this.bindTs(el);
    this.bindJson(el);
    this.bindRe(el);
    this.bindEnc(el);
  },

  /* ---------- 时间戳 ---------- */
  bindTs(el) {
    const tsIn = el.querySelector('#tsIn'), tsOut = el.querySelector('#tsOut');
    const dtIn = el.querySelector('#dtIn'), dtOut = el.querySelector('#dtOut');

    const rel = d => {
      const s = Math.floor((Date.now() - d.getTime()) / 1000);
      const a = Math.abs(s);
      if (a < 60) return s >= 0 ? '刚刚' : Math.max(1, a) + ' 秒后';
      if (a < 3600) return Math.floor(a / 60) + (s >= 0 ? ' 分钟前' : ' 分钟后');
      if (a < 86400) return Math.floor(a / 3600) + (s >= 0 ? ' 小时前' : ' 小时后');
      return Math.floor(a / 86400) + (s >= 0 ? ' 天前' : ' 天后');
    };
    const fmtDT = d => {  // 转成 YYYY-MM-DD HH:MM:SS
      const p = n => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
    };
    const parseDT = s => {  // 宽松解析多种日期格式, 返回 Date 或 null
      s = s.trim();
      // 先试原生 Date（能处理 ISO、斜杠等）
      let d = new Date(s);
      if (!isNaN(d.getTime())) return d;
      // 手动匹配 YYYY-MM-DD [HH:MM[:SS]] 或 YYYY/M/D ...
      const m = s.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[ T](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
      if (m) return new Date(+m[1], +m[2] - 1, +m[3], +m[4] || 0, +m[5] || 0, +m[6] || 0);
      return null;
    };
    const conv = () => {
      const v = tsIn.value.trim();
      if (!v) { tsOut.innerHTML = ''; return; }
      if (!/^-?\d+$/.test(v)) { tsOut.innerHTML = '<span class="err">[ERR] 仅支持纯数字时间戳</span>'; return; }
      const n = Number(v);
      const ms = Math.abs(n) >= 1e12 ? n : n * 1000;   // 13 位及以上视为毫秒
      const d = new Date(ms);
      if (isNaN(d.getTime())) { tsOut.innerHTML = '<span class="err">[ERR] 时间戳超出范围</span>'; return; }
      tsOut.innerHTML =
        `<span class="k">本地 </span> ${d.toLocaleString('zh-CN', { hour12: false })}\n` +
        `<span class="k">ISO  </span> ${d.toISOString()}\n` +
        `<span class="k">相对 </span> ${rel(d)}`;
      // 回填日历状态（月份变化才重建格子, 避免点击中的节点被移除）
      const s = Math.floor(d.getTime() / 1000);
      const prevY = calY, prevM = calM;
      selDate = d;
      calY = d.getFullYear(); calM = d.getMonth();
      dtIn.value = fmtDT(d);
      dtOut.innerHTML = `<span class="k">秒  </span> ${s}\n<span class="k">毫秒</span> ${s * 1000}`;
      const cH = el.querySelector('#tcalH'), cMi = el.querySelector('#tcalM'), cS = el.querySelector('#tcalS');
      if (cH) cH.value = d.getHours();
      if (cMi) cMi.value = d.getMinutes();
      if (cS) cS.value = d.getSeconds();
      if (!cal.hidden) {
        if (prevY !== calY || prevM !== calM) renderCal();
        markSel();
      }
    };
    tsIn.oninput = conv;
    el.querySelector('#tsNow').onclick = () => { tsIn.value = Math.floor(Date.now() / 1000); conv(); };

    /* ---- 日历选择器 ---- */
    const cal = el.querySelector('#tcal');
    const _now = new Date();
    let calY = _now.getFullYear(), calM = _now.getMonth();  // 默认当天

    const renderCal = () => {
      el.querySelector('#tcalTitle').textContent = `${calY}年 ${calM + 1}月`;
      const first = new Date(calY, calM, 1);
      const startWd = first.getDay();
      const daysInM = new Date(calY, calM + 1, 0).getDate();
      const grid = el.querySelector('#tcalGrid');
      let cells = '';
      for (let i = 0; i < startWd; i++) cells += '<span class="tcal-d blank"></span>';
      for (let d = 1; d <= daysInM; d++) {
        const isToday = (calY === new Date().getFullYear() && calM === new Date().getMonth() && d === new Date().getDate());
        cells += `<span class="tcal-d${isToday ? ' today' : ''}" data-d="${d}">${d}</span>`;
      }
      grid.innerHTML = cells;
    };
    // 仅更新选中标记（不重建 DOM）
    const markSel = () => {
      el.querySelectorAll('.tcal-d.sel').forEach(x => x.classList.remove('sel'));
      if (selDate && selDate.getFullYear() === calY && selDate.getMonth() === calM) {
        const c = el.querySelector(`.tcal-d[data-d="${selDate.getDate()}"]`);
        if (c) c.classList.add('sel');
      }
    };

    const syncDtOut = () => {  // 根据 selDate 刷新输入框和输出
      if (!selDate) { dtIn.value = ''; dtOut.innerHTML = ''; return; }
      dtIn.value = fmtDT(selDate);
      const s = Math.floor(selDate.getTime() / 1000);
      dtOut.innerHTML = `<span class="k">秒  </span> ${s}\n<span class="k">毫秒</span> ${s * 1000}`;
      if (tsIn.value !== String(s)) tsIn.value = String(s), conv();
    };

    let selDate = null;
    const getHMS = () => [
      +el.querySelector('#tcalH').value || 0,
      +el.querySelector('#tcalM').value || 0,
      +el.querySelector('#tcalS').value || 0
    ];
    const applyHMS = () => {
      const [h, mi, se] = getHMS();
      selDate.setHours(h, mi, se);
    };
    const pickDay = (d) => {
      const [h, mi, se] = getHMS();
      selDate = new Date(calY, calM, d, h, mi, se);
      markSel(); syncDtOut();
    };

    dtIn.onclick = () => { cal.hidden = !cal.hidden; if (!cal.hidden) { renderCal(); markSel(); } };
    el.querySelector('#tcalPrev').onclick = () => { calM--; if (calM < 0) { calM = 11; calY--; } renderCal(); markSel(); };
    el.querySelector('#tcalNext').onclick = () => { calM++; if (calM > 11) { calM = 0; calY++; } renderCal(); markSel(); };
    el.querySelector('#tcalGrid').onclick = e => {
      const c = e.target.closest('.tcal-d:not(.blank)');
      if (c) pickDay(+c.dataset.d);
    };
    el.querySelector('#tcalOk').onclick = () => { cal.hidden = true; };
    el.querySelector('#dtToday').onclick = () => {
      const n = new Date();
      calY = n.getFullYear(); calM = n.getMonth();
      el.querySelector('#tcalH').value = n.getHours();
      el.querySelector('#tcalM').value = n.getMinutes();
      el.querySelector('#tcalS').value = n.getSeconds();
      selDate = n;
      renderCal(); markSel(); syncDtOut();
    };
    // 时分秒循环: 23→0, 0→23, 分秒 59→0, 0→59
    const maxMap = { tcalH: 23, tcalM: 59, tcalS: 59 };
    Object.entries(maxMap).forEach(([id, mx]) => {
      const inp = el.querySelector('#' + id);
      const wrap = () => {
        let v = parseInt(inp.value);
        if (isNaN(v)) v = 0;
        if (v < 0) v = mx;
        if (v > mx) v = 0;
        inp.value = v;
        if (selDate) { applyHMS(); syncDtOut(); }
      };
      inp.oninput = wrap;
      inp.onwheel = e => {
        e.preventDefault();
        let v = parseInt(inp.value) || 0;
        v += e.deltaY < 0 ? 1 : -1;
        if (v < 0) v = mx;
        if (v > mx) v = 0;
        inp.value = v;
        if (selDate) { applyHMS(); syncDtOut(); }
      };
    });
    // 点外部关闭日历（节点因重渲染脱离 DOM 时视为内部操作, 不关闭）
    document.addEventListener('click', e => {
      if (cal.hidden) return;
      if (!e.target.isConnected) return;
      if (e.target.closest('.dt-pick')) return;
      cal.hidden = true;
    });

    const convDt = () => { // 时间戳→日历回填时调用
      if (!selDate) { dtOut.innerHTML = ''; return; }
      syncDtOut();
    };
    dtIn.oninput = convDt;
  },

  /* ---------- JSON ---------- */
  bindJson(el) {
    const inp = el.querySelector('#jsonIn'), out = el.querySelector('#jsonOut');
    const run = space => {
      const v = inp.value.trim();
      if (!v) { out.innerHTML = ''; return; }
      try {
        out.textContent = JSON.stringify(JSON.parse(v), null, space);
      } catch (e) {
        out.innerHTML = `<span class="err">[ERR] ${ui.esc(e.message)}</span>`;
      }
    };
    el.querySelector('#jsonFmt').onclick = () => run(2);
    el.querySelector('#jsonMin').onclick = () => run(0);
    el.querySelector('#jsonCopy').onclick = async () => {
      const v = out.textContent;
      if (!v || out.querySelector('.err')) return ui.toast('没有可复制的结果', 'warn');
      try { await navigator.clipboard.writeText(v); ui.toast('COPIED →'); }
      catch (e) { ui.toast('复制失败（需 localhost 环境）', 'warn'); }
    };
  },

  /* ---------- 正则 ---------- */
  bindRe(el) {
    const reIn = el.querySelector('#reIn'), flIn = el.querySelector('#reFlags');
    const txt = el.querySelector('#reTxt'), out = el.querySelector('#reOut');

    const run = () => {
      const p = reIn.value, text = txt.value;
      if (!p) { out.innerHTML = text ? '<span class="k">输入正则后实时匹配</span>' : ''; return; }
      if (!text) { out.innerHTML = ''; return; }
      let re;
      try {
        const f = flIn.value.includes('g') ? flIn.value : flIn.value + 'g';  // matchAll 需 g
        re = new RegExp(p, f);
      } catch (e) {
        out.innerHTML = `<span class="err">[ERR] ${ui.esc(e.message)}</span>`;
        return;
      }
      const ms = [...text.matchAll(re)];
      // 高亮命中片段
      let html = '', last = 0;
      ms.forEach(m => {
        html += ui.esc(text.slice(last, m.index));
        html += '<mark>' + ui.esc(m[0]) + '</mark>';
        last = m.index + m[0].length;
      });
      html += ui.esc(text.slice(last));
      // 命中列表（前 20 条, 含捕获组）
      const list = ms.slice(0, 20).map((m, i) => {
        const gs = m.slice(1);
        const g = gs.length ? ' · 组: ' + gs.map(x => x == null ? '—' : x).join(' | ') : '';
        return `<div class="re-m">#${i + 1} @${m.index} ${ui.esc(m[0])}${g}</div>`;
      }).join('');
      out.innerHTML =
        `<div class="k" style="margin-bottom:6px">${ms.length} 处匹配${ms.length > 20 ? '（仅列前 20）' : ''}</div>` +
        `<div class="re-hl">${html}</div>` + list;
    };
    [reIn, flIn, txt].forEach(i => i.oninput = run);
  },

  /* ---------- 加解密 ---------- */
  bindEnc(el) {
    const inp = el.querySelector('#encIn'), out = el.querySelector('#encOut');
    let cur = '';  // 当前结果纯文本

    const show = (v, label) => {
      cur = v;
      out.innerHTML = `<span class="k">${label}  </span>${ui.esc(v)}`;
    };
    const err = m => { cur = ''; out.innerHTML = `<span class="err">[ERR] ${ui.esc(m)}</span>`; };

    el.querySelector('#encMd5').onclick = () => {
      const v = inp.value;
      if (!v) return err('请输入文本');
      show(md5(v), 'MD5');
    };
    el.querySelector('#encB64e').onclick = () => {
      const v = inp.value;
      if (!v) return err('请输入文本');
      try {
        // UTF-8 安全编码
        const b64 = btoa(String.fromCharCode(...new TextEncoder().encode(v)));
        show(b64, 'B64E');
      } catch (e) { err('编码失败: ' + e.message); }
    };
    el.querySelector('#encB64d').onclick = () => {
      const v = inp.value.trim();
      if (!v) return err('请输入 Base64 文本');
      try {
        const bin = atob(v);
        const bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
        show(new TextDecoder().decode(bytes), 'B64D');
      } catch (e) { err('无效的 Base64 字符串'); }
    };
    el.querySelector('#encUrl').onclick = () => {
      const v = inp.value;
      if (!v) return err('请输入文本');
      show(encodeURIComponent(v), 'URLE');
    };
    el.querySelector('#encUrlD').onclick = () => {
      const v = inp.value;
      if (!v) return err('请输入 URL 编码文本');
      try { show(decodeURIComponent(v), 'URLD'); }
      catch (e) { err('无效的 URL 编码'); }
    };
    el.querySelector('#encUpper').onclick = () => { if (cur) show(cur.toUpperCase(), 'UP'); };
    el.querySelector('#encLower').onclick = () => { if (cur) show(cur.toLowerCase(), 'LOW'); };
    const copy = async () => {
      if (!cur) return ui.toast('没有可复制的结果', 'warn');
      try { await navigator.clipboard.writeText(cur); ui.toast('COPIED →'); }
      catch (e) { ui.toast('复制失败（需 localhost 环境）', 'warn'); }
    };
    el.querySelector('#encCopy').onclick = copy;
    out.onclick = copy;  // 点击结果复制
  }
};

/* ============================================================
   MD5 纯 JS 实现（RFC 1321）
   ============================================================ */
function md5(str) {
  const rl = (v, s) => (v << s) | (v >>> (32 - s));
  const addu = (a, b) => (((a >> 16) + (b >> 16) + (((a & 0xffff) + (b & 0xffff)) >> 16)) << 16) | (((a & 0xffff) + (b & 0xffff)) & 0xffff);
  const cmn = (q, a, b, x, s, t) => addu(rl(addu(addu(a, q), addu(x, t)), s), b);
  const ff = (a, b, c, d, x, s, t) => cmn((b & c) | (~b & d), a, b, x, s, t);
  const gg = (a, b, c, d, x, s, t) => cmn((b & d) | (c & ~d), a, b, x, s, t);
  const hh = (a, b, c, d, x, s, t) => cmn(b ^ c ^ d, a, b, x, s, t);
  const ii = (a, b, c, d, x, s, t) => cmn(c ^ (b | ~d), a, b, x, s, t);

  // UTF-8 编码
  const bytes = new TextEncoder().encode(str);
  const nblk = ((bytes.length + 8) >> 6) + 1;
  const blks = new Array(nblk * 16).fill(0);
  for (let i = 0; i < bytes.length; i++) blks[i >> 2] |= bytes[i] << ((i % 4) * 8);
  blks[bytes.length >> 2] |= 0x80 << ((bytes.length % 4) * 8);
  blks[nblk * 16 - 2] = bytes.length * 8;

  let a = 1732584193, b = -271733879, c = -1732584194, d = 271733878;
  for (let i = 0; i < blks.length; i += 16) {
    const [oa, ob, oc, od] = [a, b, c, d];
    a=ff(a,b,c,d,blks[i+0],7,-680876936); d=ff(d,a,b,c,blks[i+1],12,-389564586);
    c=ff(c,d,a,b,blks[i+2],17,606105819); b=ff(b,c,d,a,blks[i+3],22,-1044525330);
    a=ff(a,b,c,d,blks[i+4],7,-176418897); d=ff(d,a,b,c,blks[i+5],12,1200080426);
    c=ff(c,d,a,b,blks[i+6],17,-1473231341); b=ff(b,c,d,a,blks[i+7],22,-45705983);
    a=ff(a,b,c,d,blks[i+8],7,1770035416); d=ff(d,a,b,c,blks[i+9],12,-1958414417);
    c=ff(c,d,a,b,blks[i+10],17,-42063); b=ff(b,c,d,a,blks[i+11],22,-1990404162);
    a=ff(a,b,c,d,blks[i+12],7,1804603682); d=ff(d,a,b,c,blks[i+13],12,-40341101);
    c=ff(c,d,a,b,blks[i+14],17,-1502002290); b=ff(b,c,d,a,blks[i+15],22,1236535329);
    a=gg(a,b,c,d,blks[i+1],5,-165796510); d=gg(d,a,b,c,blks[i+6],9,-1069501632);
    c=gg(c,d,a,b,blks[i+11],14,643717713); b=gg(b,c,d,a,blks[i+0],20,-373897302);
    a=gg(a,b,c,d,blks[i+5],5,-701558691); d=gg(d,a,b,c,blks[i+10],9,38016083);
    c=gg(c,d,a,b,blks[i+15],14,-660478335); b=gg(b,c,d,a,blks[i+4],20,-405537848);
    a=gg(a,b,c,d,blks[i+9],5,568446438); d=gg(d,a,b,c,blks[i+14],9,-1019803690);
    c=gg(c,d,a,b,blks[i+3],14,-187363961); b=gg(b,c,d,a,blks[i+8],20,1163531501);
    a=gg(a,b,c,d,blks[i+13],5,-1444681467); d=gg(d,a,b,c,blks[i+2],9,-51403784);
    c=gg(c,d,a,b,blks[i+7],14,1735328473); b=gg(b,c,d,a,blks[i+12],20,-1926607734);
    a=hh(a,b,c,d,blks[i+5],4,-378558); d=hh(d,a,b,c,blks[i+8],11,-2022574463);
    c=hh(c,d,a,b,blks[i+11],16,1839030562); b=hh(b,c,d,a,blks[i+14],23,-35309556);
    a=hh(a,b,c,d,blks[i+1],4,-1530992060); d=hh(d,a,b,c,blks[i+4],11,1272893353);
    c=hh(c,d,a,b,blks[i+7],16,-155497632); b=hh(b,c,d,a,blks[i+10],23,-1094730640);
    a=hh(a,b,c,d,blks[i+13],4,681279174); d=hh(d,a,b,c,blks[i+0],11,-358537222);
    c=hh(c,d,a,b,blks[i+3],16,-722521979); b=hh(b,c,d,a,blks[i+6],23,76029189);
    a=hh(a,b,c,d,blks[i+9],4,-640364487); d=hh(d,a,b,c,blks[i+12],11,-421815835);
    c=hh(c,d,a,b,blks[i+15],16,530742520); b=hh(b,c,d,a,blks[i+2],23,-995338651);
    a=ii(a,b,c,d,blks[i+0],6,-198630844); d=ii(d,a,b,c,blks[i+7],10,1126891415);
    c=ii(c,d,a,b,blks[i+14],15,-1416354905); b=ii(b,c,d,a,blks[i+5],21,-57434055);
    a=ii(a,b,c,d,blks[i+12],6,1700485571); d=ii(d,a,b,c,blks[i+3],10,-1894986606);
    c=ii(c,d,a,b,blks[i+10],15,-1051523); b=ii(b,c,d,a,blks[i+1],21,-2054922799);
    a=ii(a,b,c,d,blks[i+8],6,1873313359); d=ii(d,a,b,c,blks[i+15],10,-30611744);
    c=ii(c,d,a,b,blks[i+6],15,-1560198380); b=ii(b,c,d,a,blks[i+13],21,1309151649);
    a=ii(a,b,c,d,blks[i+4],6,-145523070); d=ii(d,a,b,c,blks[i+11],10,-1120210379);
    c=ii(c,d,a,b,blks[i+2],15,718787259); b=ii(b,c,d,a,blks[i+9],21,-343485551);
    a = addu(a, oa); b = addu(b, ob); c = addu(c, oc); d = addu(d, od);
  }
  const hx = n => {
    const s = '0123456789abcdef';
    let r = '';
    for (let i = 0; i < 4; i++) r += s.charAt((n >> (i * 8 + 4)) & 0x0f) + s.charAt((n >> (i * 8)) & 0x0f);
    return r;
  };
  return hx(a) + hx(b) + hx(c) + hx(d);
}
