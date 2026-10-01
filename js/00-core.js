/* ============================================================
   途迹 · core    基础工具 / 主题字典 / 双轨季节解析
   ------------------------------------------------------------
   依赖：无（最先加载）。全局：$  el  esc  txt  toast  shade  THEMES/themeName/themeColor/setThemes  XUN/xunLabel/parseSeasonDigit/parseSeasonText/seasonOf/seasonDisplay/seasonShort/calHTML
   ============================================================ */
/* ============================================================
   基础工具
   ============================================================ */
const $  = s => document.querySelector(s);
const el = (tag, cls, html) => { const n=document.createElement(tag); if(cls) n.className=cls; if(html!=null) n.innerHTML=html; return n; };
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const txt = s => esc(String(s ?? '').replace(/\*\*/g,''));           // 去掉数据里的 ** 强调符号
function toast(msg){
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(t._t); t._t = setTimeout(()=>t.classList.remove('show'), 1900);
}
function shade(hex, amt){
  const n = parseInt(hex.slice(1),16);
  const c = [n>>16, (n>>8)&255, n&255].map(v=> Math.max(0,Math.min(255,v+amt)));
  return '#' + c.map(v=>v.toString(16).padStart(2,'0')).join('');
}

/* ============================================================
   主题字典
   默认内置一份；boot() 载入 general.json 后会以 data 里的
   meta.themes（id / name / color）为准覆盖，保证单一数据源。
   ============================================================ */
let THEMES = {
  nature:  { name:'自然', color:'#3E8E5F' },
  culture: { name:'人文', color:'#B08A3E' },
  history: { name:'历史', color:'#9C5B43' },
  food:    { name:'美食', color:'#C7742F' },
  city:    { name:'城市', color:'#5B7A99' },
  coast:   { name:'海滨', color:'#3E8FA3' },
  snow:    { name:'冰雪', color:'#6E9FC8' },
  hiking:  { name:'徒步', color:'#7E6BA8' }
};
const themeName  = id => THEMES[id] ? THEMES[id].name : id;
const themeColor = id => THEMES[id] ? THEMES[id].color : '#0F6E5C';
function setThemes(list){                                       // general.json → themes
  if (!Array.isArray(list) || !list.length) return;
  const dict = {};
  list.forEach(t => { if (t && t.id) dict[t.id] = { name: t.name || t.id, color: t.color || '#0F6E5C' }; });
  if (Object.keys(dict).length) THEMES = dict;
}

/* ============================================================
   季节解析：以「旬」为单位（双轨）
   ------------------------------------------------------------
   旬号：0-35，0 = 1月上旬 … 35 = 12月下旬
        （上旬=0 / 中旬=1 / 下旬=2 → 旬号 = (月-1)*3 + 旬内序号）
   跨年段：结束旬 +36（>35）
        例「10月中旬-次年4月下旬」→ [28, 47]
   轨一 bestSeasonDigit（机器，优先）：
        [[28,47],[12,17]]   —— 忽略括号等一切文字，直接给旬号区间
   轨二 bestSeason（人类可读，回退）：
        "10月中旬-次年4月下旬；5月上旬-6月下旬"
        解析时忽略括号里的解释，例「5月上旬-6月下旬（草原美景）」
   ============================================================ */
const XUN      = { '上':0, '中':1, '下':2 };
const XUN_NAME = ['上','中','下'];
const ALL_SEASON = [[0,35]];                    // 「全年」= 1月上旬—12月下旬

function xunLabel(i){
  const n = ((i % 36) + 36) % 36;
  return (Math.floor(n/3)+1) + '月' + XUN_NAME[n%3] + '旬';
}

/* 轨一：旬号区间（跨年段的结束值 > 35）
   两端都先归一到 0-35，再按「结束 < 开始 → 跨年 +36」还原，
   因此 [28,47] 与 [28,11] 等价、[100,106] 等价于 [28,34]。 */
function parseSeasonDigit(d){
  if (!Array.isArray(d)) return null;
  const norm36 = v => (((+v) % 36) + 36) % 36;
  const segs = d
    .filter(s => Array.isArray(s) && s.length === 2 && isFinite(+s[0]) && isFinite(+s[1]))
    .map(s => {
      const a = norm36(s[0]);
      let   b = norm36(s[1]);
      if (b < a) b += 36;                       // 跨年段
      return [a, b];
    });
  return segs.length ? segs : null;
}

/* 轨二：单段文本 → 旬号区间
   可解析：11月 ／ 5月下旬 ／ 10月中旬-次年4月下旬 ／ 11月中旬-下旬 ／ 5月中下旬 ／ 全年 */
function parseSeasonSeg(raw){
  if (!raw) return null;
  if (raw.indexOf('全年') >= 0) return ALL_SEASON[0];
  const hasRange = raw.indexOf('-') >= 0;                                  // 「中下旬」在有区间时只取中旬
  let p = raw.replace(/(\d{1,2})月中下旬/g, (m,n) => hasRange ? n + '月中旬' : n + '月中旬-下旬');
  const first = p.match(/(\d{1,2})月/); if (!first) return null;
  p = p.replace(/[\s-]+(上|中|下)旬/g, '-' + first[1] + '月$1旬');          // 「11月中旬-下旬」省略的月号补回来
  const m = p.match(/^(\d{1,2})月(?:([上中下])旬)?\s*(?:-\s*(?:次年)?(\d{1,2})月(?:([上中下])旬)?)?$/);
  if (!m) return null;
  const aM = +m[1], aX = m[2] ? XUN[m[2]] : 0;                             // 只写「11月」按整月（上旬—下旬）
  const bM = m[3] ? +m[3] : aM;
  const bX = m[4] ? XUN[m[4]] : (m[2] ? XUN[m[2]] : 2);
  let a = (aM-1)*3 + aX, b = (bM-1)*3 + bX;
  if (p.indexOf('次年') >= 0 || b < a) b += 36;
  return [a,b];
}

/* 轨二：整串文本 → 旬号区间组（先剥括号解释，再按「；」分段） */
function parseSeasonText(str){
  if (str == null || str === '') return null;
  const s = String(str)
    .replace(/[（(][^）)]*[）)]/g, '')      // 「5月上旬-6月下旬（草原美景）」→ 括号内容整段忽略
    .replace(/[—–~～－]|\s*至\s*/g, '-')   // 各种连接号统一成 -
    .replace(/[；;]/g, ';');
  const segs = [];
  s.split(';').forEach(part => { const seg = parseSeasonSeg(part.trim()); if (seg) segs.push(seg); });
  return segs.length ? segs : null;
}

/* 双轨入口：bestSeasonDigit 优先，bestSeason 文本兜底
   返回 null = 季节信息缺失（不参与时间筛选） */
function seasonOf(rec){
  if (!rec) return null;
  return parseSeasonDigit(rec.bestSeasonDigit) || parseSeasonText(rec.bestSeason);
}

/* 展示用文本：优先 data 里的 bestSeason 原文；缺失时用工整的旬号文案兜底 */
function seasonDisplay(rec){
  if (!rec) return '';
  if (rec.bestSeason) return txt(rec.bestSeason);
  const segs = rec._season;
  if (!Array.isArray(segs)) return '';
  return segs.map(([a,b]) => (b - a >= 35) ? '全年'
                                    : xunLabel(a) + '—' + (b >= 36 ? '次年' : '') + xunLabel(b)).join('；');
}
/* 卡片上只展示第一段，避免多段季节把列表撑高 */
function seasonShort(rec){
  const t = seasonDisplay(rec);
  if (!t) return '';
  const parts = t.split(/[；;]/);
  return parts[0] + (parts.length > 1 ? ' …' : '');
}
/* 适宜时段是否与所选旬区间 [s,e]（含端点，0-35）有交集 */
function coversRange(segs, s, e){
  if (segs === 'all' || segs === null || segs === undefined) return true;   // 全年 / 季节缺失 → 不筛除
  return segs.some(([a,b]) => (a <= e && b >= s) || (a <= e+36 && b >= s+36));
}
function coversMonth(segs, m){ return coversRange(segs, (m-1)*3, (m-1)*3+2); }
function calHTML(segs){                                          // 区域抽屉里的 12 格月历
  let h = '<div class="cal">';
  for (let m=1; m<=12; m++) h += `<div class="m ${coversMonth(segs,m)?'good':''}">${m}月</div>`;
  return h + '</div>';
}

