/* ============================================================
   途迹 · drawer  详情抽屉（目的地 / 旅游区域 / 景点跳转 + 悬浮卡）
   ------------------------------------------------------------
   依赖：00-core 10-data 20-list 30-map。全局：openPlace openRegion openSpot closeDrawer SPOT_LIMIT 及悬浮卡引擎
   ============================================================ */
/* ============================================================
   顶部背景图 + 悬浮卡引擎
   ------------------------------------------------------------
   背景图：bgFor(kind, rec) 命中就贴图，加载失败静默回退到主题渐变。
   悬浮卡：行内只留名称，细节（位置/主题/季节/摘要/星级）放进全局 #tip。
          data-tip="t1" 只存键，正文留在 TIPS 里，避免长文本进 HTML 属性。
   ============================================================ */
function applyHero(rec, kind){
  const color = themeColor((rec.themes || [])[0]);
  const hero = $('#dwHero'), img = $('#dwPhoto');
  hero.classList.remove('has-photo');
  hero.style.background = `linear-gradient(135deg, ${color}, ${shade(color,-30)})`;
  img.onload = img.onerror = null;
  img.hidden = true;
  const url = bgFor(kind, rec);
  if (!url){ img.removeAttribute('src'); return; }
  img.onload  = () => { img.hidden = false; hero.classList.add('has-photo'); };
  img.onerror = () => { img.hidden = true;  hero.classList.remove('has-photo'); };
  img.src = url;                                       // 赋值即开始加载
}

const TIPS = new Map();
let tipSeq = 0;
const tipAttr = html => { const k = 't' + (++tipSeq); TIPS.set(k, html); return ` data-tip="${k}"`; };
function tipHide(){
  const t = $('#tip'); if (!t) return;
  t.classList.remove('show'); t.innerHTML = '';
}
function tipShow(node){
  const html = node && node.dataset ? TIPS.get(node.dataset.tip) : null;
  const t = $('#tip'); if (!html || !t) return;
  t.innerHTML = html;
  t.classList.add('show');                             // 先显示再量尺寸
  const r = node.getBoundingClientRect(), b = t.getBoundingClientRect();
  const gap = 12, m = 10;
  const vw = window.innerWidth || 1024, vh = window.innerHeight || 768;
  let x = r.left - b.width - gap;                      // 优先放左侧（抽屉在最右）
  if (x < m) x = (r.right + gap + b.width > vw - m) ? Math.max(m, vw - b.width - m) : r.right + gap;
  let y = r.top + r.height / 2 - b.height / 2;
  y = Math.max(m, Math.min(y, vh - b.height - m));
  t.style.left = Math.round(x) + 'px';
  t.style.top  = Math.round(y) + 'px';
}
/* 抽屉每次重绘都会换掉节点 → 事件委托到 document 最省事 */
document.addEventListener('mouseover', e => { const n = e.target && e.target.closest && e.target.closest('[data-tip]'); if (n) tipShow(n); });
document.addEventListener('mouseout',  e => { const n = e.target && e.target.closest && e.target.closest('[data-tip]'); if (n) tipHide(); });
document.addEventListener('focusin',   e => { const n = e.target && e.target.closest && e.target.closest('[data-tip]'); if (n) tipShow(n); });
document.addEventListener('focusout',  e => { const n = e.target && e.target.closest && e.target.closest('[data-tip]'); if (n) tipHide(); });
document.addEventListener('scroll', tipHide, true);    // 滚动时收起，避免卡片悬空
window.addEventListener('resize', tipHide);

/* ---------- 悬浮卡正文 ---------- */
function placeTipHTML(p){
  const regions = (p.regionIds || []).map(id => regionById[id] ? regionName(regionById[id]) : '').filter(Boolean);
  return `<b>${esc(p.name)}</b>
    <div class="tip-row"><span class="tip-k">位置：</span>${esc(provText(p.province))}${regions.length ? ' · ' + esc(regions.join(' / ')) : ''}</div>
    ${(p.themes || []).length ? `<div class="tip-row"><span class="tip-k">主题：</span>${esc((p.themes || []).map(themeName).join(' / '))}</div>` : ''}
    ${p.bestSeason ? `<div class="tip-row"><span class="tip-k">最佳季节：</span>${esc(seasonDisplay(p))}</div>` : ''}
    ${p.summary ? `<div class="tip-row">${txt(p.summary)}</div>` : ''}
    <div class="tip-hint">点击打开该目的地详情 →</div>`;
}
function regionTipHTML(r){
  return `<b>${esc(regionName(r))}</b>
    <div class="tip-row"><span class="tip-k">范围：</span>${esc(provText(r.province))} · ${r.places.length} 个目的地 · ${(r.spots || []).length} 个代表景点</div>
    ${r.bestSeason ? `<div class="tip-row"><span class="tip-k">最佳季节：</span>${esc(seasonDisplay(r))}</div>` : ''}
    ${r.summary ? `<div class="tip-row">${txt(r.summary)}</div>` : ''}
    <div class="tip-hint">点击打开该旅游区域 →</div>`;
}
/* s = { name, attraction|null }：区域「代表景点」在悬浮卡里补回所属目的地与星级 */
function spotTipHTML(s){
  const a = s.attraction;
  if (!a) return `<b>${esc(s.name)}</b><div class="tip-row dim">attractions.json 中暂无同名景点，本条尚未结构化。</div>`;
  const p = placeById[a.placeId];
  return `<b>${esc(a.name)}</b>
    ${p ? `<div class="tip-row"><span class="tip-k">所属目的地：</span>${esc(p.name)}</div>` : ''}
    ${a.grade ? `<div class="tip-row"><span class="tip-k">推荐度：</span>★ ${esc(a.grade)} / 5</div>` : ''}
    ${a.bestSeason ? `<div class="tip-row"><span class="tip-k">最佳季节：</span>${esc(seasonDisplay(a))}</div>` : ''}
    ${a.summary ? `<div class="tip-row">${txt(a.summary)}</div>` : ''}
    ${p ? `<div class="tip-hint">点击跳到「${esc(p.name)}」并高亮该景点 →</div>` : ''}`;
}

/* 抽屉里所有可点元素：鼠标 + 键盘（Enter/空格）都能触发 */
function bindDrawerLinks(){
  const body = $('#dwBody');
  const bind = (sel, make) => body.querySelectorAll(sel).forEach(n=>{
    n.onclick = make(n);
    n.onkeydown = e => { if (e.key === 'Enter' || e.key === ' '){ e.preventDefault(); if (n.onclick) n.onclick(); } };
  });
  bind('[data-region]', n => () => openRegion(n.dataset.region, true));
  bind('[data-spot]',   n => () => openSpot(n.dataset.spot));
  bind('[data-go]',     n => () => openPlace(n.dataset.go, true));
}

const SPOT_LIMIT = 18;                                  // 代表景点一次最多铺 18 个，其余折叠
const emptySum = t => t || '<span class="dim">暂无概览文字。</span>';

/* ============================================================
   目的地抽屉
   ============================================================ */
function openPlace(id, move){
  const p = placeById[id]; if(!p) return;
  state.current = { type:'place', id };
  const regions = (p.regionIds||[]).map(x=>regionById[x]).filter(Boolean);

  $('#dwKicker').textContent = '目的地';
  $('#dwName').textContent   = p.name;
  $('#dwRegion').textContent = [provText(p.province), macroRegion(provList(p.province)[0])].filter(Boolean).join(' · ');
  applyHero(p, 'place');

  /* 第三层：本目的地的景点（attractions.json 中 placeId === p.id 的记录）
     字段：id / name / placeId / summary / bestSeason / grade（1-5 数字）
     抽屉里只列名称，摘要 / 星级 / 季节进悬浮卡 */
  const list = p.attractions || [];
  TIPS.clear(); tipHide();
  const spotPill = a => `<span class="pill link" id="spot-${esc(a.id)}" data-spot="${esc(a.id)}" tabindex="0"${tipAttr(spotTipHTML({ name:a.name, attraction:a }))}>${esc(a.name)}</span>`;

  $('#dwBody').innerHTML = `
    <div class="dw-sec">
      <h5>什么时候去</h5>
      <div class="cal-wrap">
        ${calHTML(p._season)}
        <div class="cal-note">${esc(seasonDisplay(p) || '季节信息待补充（本条不参与时间筛选）')}</div>
      </div>
    </div>
    <div class="dw-sec">
      <h5>概览</h5>
      <div class="dw-sum">${emptySum(txt(p.summary))}</div>
    </div>
    ${regions.length ? `<div class="dw-sec">
      <h5>所属旅游区域</h5>
      <div class="pill-row">${regions.map(r=>
        `<span class="link-chip" data-region="${esc(r.id)}" tabindex="0"${tipAttr(regionTipHTML(r))}>${esc(regionName(r))} →</span>`).join('')}</div>
    </div>` : ''}
    <div class="dw-sec">
      <h5>主题</h5>
      <div class="pill-row">${(p.themes||[]).map(t=>
        `<span class="pill" style="background:${themeColor(t)}14;color:${themeColor(t)}">${themeName(t)}</span>`).join('')}</div>
    </div>
    ${p.transport ? `<div class="dw-sec"><h5>交通</h5><p>${txt(p.transport)}</p></div>` : ''}
    <div class="dw-sec" style="margin-bottom:0">
      <h5>关联景点${list.length ? '（' + list.length + '）' : ''}</h5>
      ${list.length
        ? `<div class="pill-row">${list.map(spotPill).join('')}</div>
           <div class="cal-note">共 ${list.length} 个景点：悬浮查看简介，点击定位并高亮该景点。</div>`
        : `<p class="dim">该目的地暂无结构化景点（attractions.json 中尚无 placeId 指向本目的地）。</p>`}
    </div>`;

  bindDrawerLinks();
  $('#drawer').classList.add('open');

  if (move && p.coord){ easeTo(p.coord, 6.5); hoverPlace(p); }
  if (state.focusSpot){                                  // 从区域/景点跳进来：定位并高亮该景点
    const node = document.getElementById('spot-' + state.focusSpot);
    state.focusSpot = null;
    if (node){
      node.classList.add('flash');
      node.scrollIntoView({ block:'center', behavior:'smooth' });
      setTimeout(()=> node.classList.remove('flash'), 1800);
    }
  } else $('#dwBody').scrollTop = 0;
  renderList(); renderMarkers();
}

/* ============================================================
   旅游区域抽屉
   ============================================================ */
function openRegion(id, zoom){
  const r = regionById[id]; if(!r) return;
  state.current = { type:'region', id };
  state.regionId = id;
  const name = regionName(r);

  const spots = r.spots || [];                // [{ name, attraction|null }]
  const linked = spots.filter(s => s.attraction).length;

  $('#dwKicker').textContent = '旅游区域';
  $('#dwName').textContent   = name;
  $('#dwRegion').textContent = provText(r.province) + ' · ' + r.places.length + ' 个目的地 · ' + spots.length + ' 个代表景点';
  applyHero(r, 'region');

  TIPS.clear(); tipHide();
  /* 关联目的地：只列名称，省份 / 主题 / 季节 / 摘要进悬浮卡 */
  const placeItem = p => `<span class="name-item" data-go="${esc(p.id)}" tabindex="0"${tipAttr(placeTipHTML(p))}>${esc(p.name)}</span>`;
  /* 关联景点：能在 attractions.json 里按 name 对上的可点（跳到所属目的地并高亮），其余标注未结构化 */
  const spotPill = s => s.attraction
    ? `<span class="pill link" id="spot-${esc(s.attraction.id)}" data-spot="${esc(s.attraction.id)}" tabindex="0"${tipAttr(spotTipHTML(s))}>${esc(s.name)}</span>`
    : `<span class="pill" tabindex="0"${tipAttr(spotTipHTML(s))}>${esc(s.name)}</span>`;

  $('#dwBody').innerHTML = `
    <div class="dw-sec">
      <h5>什么时候去</h5>
      <div class="cal-wrap">
        ${calHTML(r._season)}
        <div class="cal-note">${esc(seasonDisplay(r) || '季节信息待补充')}</div>
      </div>
    </div>
    <div class="dw-sec">
      <h5>概览</h5>
      <div class="dw-sum">${emptySum(txt(r.summary))}</div>
    </div>
    ${r.transport ? `<div class="dw-sec"><h5>交通</h5><p>${txt(r.transport)}</p></div>` : ''}
    ${r.places.length ? `<div class="dw-sec">
      <h5>关联目的地（${r.places.length}）</h5>
      <div class="name-row">${r.places.map(placeItem).join('')}</div>
      <div class="cal-note">悬浮看省份与季节，点击打开该目的地。</div>
    </div>` : ''}
    ${spots.length ? `<div class="dw-sec" style="margin-bottom:0">
      <h5>关联景点（${spots.length}${linked ? ' · 已结构化 ' + linked : ''}）</h5>
      <div class="pill-row" id="spotPills">
        ${spots.slice(0,SPOT_LIMIT).map(spotPill).join('')}
        ${spots.length>SPOT_LIMIT ? `<span class="pill more" id="spotMore" tabindex="0">展开其余 ${spots.length-SPOT_LIMIT} 个</span>` : ''}
      </div>
      <div class="cal-note">${linked ? '蓝色条目可跳到所属目的地并高亮该景点；' : ''}悬浮查看简介。</div>
    </div>` : ''}`;

  bindDrawerLinks();
  const more = $('#spotMore');
  if (more){
    more.onclick = ()=>{ $('#spotPills').innerHTML = spots.map(spotPill).join(''); bindDrawerLinks(); };
    more.onkeydown = e => { if (e.key === 'Enter' || e.key === ' '){ e.preventDefault(); more.onclick(); } };
  }
  $('#drawer').classList.add('open');

  if (zoom && r.centroid) easeTo(r.centroid, 5.5);
  renderTabs(); renderList(); renderMarkers();
}

/* 区域「代表景点」→ 打开所属目的地抽屉，并高亮该景点 */
function openSpot(attractionId){
  const a = attractionById[attractionId]; if (!a) return;
  const p = placeById[a.placeId];         if (!p) return;
  state.focusSpot = attractionId;
  openPlace(p.id, true);
}

function closeDrawer(){
  tipHide();
  $('#drawer').classList.remove('open');
  state.current = null;
  state.regionId = null;
  if (infoWin) infoWin.close();
  renderTabs(); renderList(); renderMarkers();
}