/* ============================================================
   途迹 · data    数据层 / 关联 / 状态 / 筛选搜索
   ------------------------------------------------------------
   依赖：00-core。全局：GENERAL PLACES REGIONS ATTRACTIONS BG? index 表、linkRegions()、state、filteredPlaces()/filteredRegions()/coversRange()、hay 函数
   ============================================================ */
/* ============================================================
   数据层
   ------------------------------------------------------------
   general.json        → 主题/省份/大区 等元数据
   provinceRegions.json→ 第一层：旅游区域（34）
   places.json         → 第二层：目的地（147）
   attractions.json    → 第三层：景点（352）
   ============================================================ */
let GENERAL = {}, REGIONS = [], PLACES = [], ATTRACTIONS = [];
let regionById = {}, placeById = {}, placeByName = {};
let attractionById = {}, attractionByName = {};

function provText(p){ return Array.isArray(p) ? p.join(' / ') : (p || ''); }
function provList(p){ return Array.isArray(p) ? p : (p ? [p] : []); }
const regionName = r => String((r && r.name) || '').replace(/[）)]+$/,'');   // 「三江源/可可西里」等名称保持原样

/* 省份全称 → general.json 里的简称
   四川省→四川 ／ 新疆维吾尔自治区→新疆 ／ 广西壮族自治区→广西 ／ 内蒙古自治区→内蒙古 ／ 香港特别行政区→香港 */
function normProv(x){
  return String(x == null ? '' : x)
    .replace(/特别行政区$/, '')
    .replace(/(壮族|维吾尔|回族|藏族)?自治区$/, '')
    .replace(/[省市]$/, '');
}
/* 目的地所属「大区」（general.json：provinces[].region → regions[].name） */
let macroOfProvince = {};
function macroRegion(name){
  const id = macroOfProvince[normProv(name)];
  const r = (GENERAL.regions || []).find(x => x.id === id);
  return r ? r.name : '';
}

/* ---------- 关联：全部按 data 里显式写死的字段挂接，不做名称猜测 ----------
   ① provinceRegions[].places[]        → places[].name        （可多对多）
   ② attractions[].placeId             → places[].id
   ③ provinceRegions[].attractionSpots[] → attractions[].name  （允许尚未结构化）
   ---------------------------------------------------------------------- */
function linkRegions(){
  PLACES.forEach(p => { p.regionIds = []; p.attractions = []; });
  REGIONS.forEach(r => { r.placeNames = r.places || []; r.places = []; });

  REGIONS.forEach(r=>{
    r.placeNames.forEach(n=>{
      const p = placeByName[n];
      if (!p){ console.warn('[link] 区域引用了不存在的目的地：' + r.id + ' → ' + n); return; }
      r.places.push(p);                                              // 保留 data 里的顺序
      if (p.regionIds.indexOf(r.id) < 0) p.regionIds.push(r.id);      // 同一目的地可挂多个区域
    });
    const withCoord = r.places.filter(p => p.coord);
    r.centroid = withCoord.length ? {
      lat: withCoord.reduce((s,p)=>s+p.coord.lat,0)/withCoord.length,
      lng: withCoord.reduce((s,p)=>s+p.coord.lng,0)/withCoord.length
    } : null;
  });

  /* 第三层：景点挂到所属目的地 */
  ATTRACTIONS.forEach(a => { const p = placeById[a.placeId]; if (p) p.attractions.push(a); });
  const orphan = ATTRACTIONS.filter(a => !placeById[a.placeId]);
  if (orphan.length) console.warn('[link] ' + orphan.length + ' 条景点的 placeId 未匹配到目的地（按 data 约定暂时忽略）：'
    + orphan.map(a => a.id).join(', '));

  /* 区域「代表景点」：能对上 attractions.name 的标记出来，供抽屉里做跳转 */
  REGIONS.forEach(r=>{
    r.spots = (r.attractionSpots || []).map(name=>{
      const hit = attractionByName[name];
      const a = Array.isArray(hit)
        ? (hit.find(x => { const p = placeById[x.placeId]; return p && p.regionIds.indexOf(r.id) >= 0; }) || hit[0])
        : hit;
      return { name, attraction: a || null };
    });
  });
}

/* ============================================================
   状态（仅浏览态，不含任何用户数据）
   ============================================================ */
const state = {
  tab: 'places',           // places | regions
  range: null,             // [起旬, 止旬] 0-35 含端点 | null = 不限
  themes: new Set(),
  q: '',
  regionId: null,          // 限定区域
  current: null,           // { type:'place'|'region', id }
  focusSpot: null          // 从区域/景点跳转过来时要高亮的景点 id
};

/* ============================================================
   筛选
   ============================================================ */
function placeHay(p){
  return [p.name, provText(p.province), macroRegion(provList(p.province)[0]),
          p.summary, p.bestSeason,
          (p.themes||[]).map(themeName).join(''),
          (p.regionIds||[]).map(id => regionById[id] ? regionName(regionById[id]) : '').join(''),
          (p.attractions||[]).map(a=>a.name).join('')].join(' ').toLowerCase();
}
function regionHay(r){
  return [r.name, provText(r.province), r.summary, r.bestSeason, r.transport,
          (r.themes||[]).map(themeName).join(''),
          (r.placeNames||[]).join(''), (r.attractionSpots||[]).join('')].join(' ').toLowerCase();
}
function filteredPlaces(){
  const q = state.q.toLowerCase();
  const out = [];
  PLACES.forEach(p=>{
    if (state.regionId && (p.regionIds||[]).indexOf(state.regionId) < 0) return;
    if (state.range && !coversRange(p._season, state.range[0], state.range[1])) return;
    if (state.themes.size && !(p.themes||[]).some(t=>state.themes.has(t))) return;
    if (q && !placeHay(p).includes(q)) return;
    out.push(p);
  });
  return out;
}
function filteredRegions(){
  const q = state.q.toLowerCase();
  return REGIONS.filter(r=>{
    if (state.range && !coversRange(r._season, state.range[0], state.range[1])) return;
    if (state.themes.size && !(r.themes||[]).some(t=>state.themes.has(t))) return;
    if (q && !regionHay(r).includes(q)) return;
    return true;
  });
}

