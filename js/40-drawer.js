/* ============================================================
   途迹 · drawer  详情抽屉（目的地 / 旅游区域 / 景点跳转 + 悬浮卡）
   ------------------------------------------------------------
   依赖：00-core 10-data 20-list 30-map。全局：openPlace openRegion openSpot closeDrawer SPOT_LIMIT 及悬浮卡引擎
   ============================================================ */
/* ============================================================
   详情抽屉
   ============================================================ */
function openPlace(id, move){
  const p = placeById[id]; if(!p) return;
  state.current = { type:'place', id };
  const color = themeColor((p.themes||[])[0]);
  const regions = (p.regionIds||[]).map(x=>regionById[x]).filter(Boolean);

  $('#dwKicker').textContent = '目的地';
  $('#dwName').textContent   = p.name;
  $('#dwRegion').textContent = [provText(p.province), macroRegion(provList(p.province)[0])].filter(Boolean).join(' · ');
  $('#dwHero').style.background = `linear-gradient(135deg, ${color}, ${shade(color,-30)})`;

  /* 第三层：本目的地的景点（attractions.json 中 placeId === p.id 的记录）
     字段：id / name / placeId / summary / bestSeason / grade（1-5 数字） */
  const list = p.attractions || [];
  const spotRow = a => `
    <div class="spot" id="spot-${esc(a.id)}">
      <div class="spot-h">
        <span class="spot-name">${esc(a.name)}</span>
        ${a.grade ? `<span class="tag-grade" title="推荐度 ${esc(a.grade)}/5">★ ${esc(a.grade)}</span>` : ''}
      </div>
      ${a.summary ? `<div class="spot-d">${txt(a.summary)}</div>` : ''}
      ${a.bestSeason ? `<div class="spot-meta"><span>${esc(seasonDisplay(a))}</span></div>` : ''}
    </div>`;

  $('#dwBody').innerHTML = `
    <div class="dw-sec">
      <h5>什么时候去</h5>
      ${calHTML(p._season)}
      <div class="cal-note">${esc(seasonDisplay(p) || '季节信息待补充（本条不参与时间筛选）')}</div>
    </div>
    <div class="dw-sec">
      <h5>目的地概览</h5>
      <p>${txt(p.summary)}</p>
    </div>
    ${regions.length ? `<div class="dw-sec">
      <h5>所属旅游区域</h5>
      <div class="pill-row">${regions.map(r=>
        `<span class="link-chip" data-region="${esc(r.id)}">${esc(regionName(r))} →</span>`).join('')}</div>
    </div>` : ''}
    <div class="dw-sec">
      <h5>主题</h5>
      <div class="pill-row">${(p.themes||[]).map(t=>
        `<span class="pill" style="background:${themeColor(t)}14;color:${themeColor(t)}">${themeName(t)}</span>`).join('')}</div>
    </div>
    ${p.transport ? `<div class="dw-sec"><h5>怎么去</h5><p>${txt(p.transport)}</p></div>` : ''}
    <div class="dw-sec" style="margin-bottom:0">
      <h5>相关景点${list.length ? '（' + list.length + '）' : ''}</h5>
      ${list.length
        ? `<div class="spot-list">${list.map(spotRow).join('')}</div>`
        : `<p class="dim">该目的地暂无结构化景点（attractions.json 中尚无 placeId 指向本目的地）。</p>`}
    </div>`;

  $('#dwBody').querySelectorAll('[data-region]').forEach(n=>{ n.onclick = ()=> openRegion(n.dataset.region, true); });
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

const SPOT_LIMIT = 18;                        // 代表景点一次最多铺 18 个，其余折叠
function openRegion(id, zoom){
  const r = regionById[id]; if(!r) return;
  state.current = { type:'region', id };
  state.regionId = id;
  const color = themeColor((r.themes||[])[0]);
  const name = regionName(r);

  const spots = r.spots || [];                // [{ name, attraction|null }]
  const linked = spots.filter(s => s.attraction).length;

  $('#dwKicker').textContent = '旅游区域';
  $('#dwName').textContent   = name;
  $('#dwRegion').textContent = provText(r.province) + ' · ' + r.places.length + ' 个目的地 · ' + spots.length + ' 个代表景点';
  $('#dwHero').style.background = `linear-gradient(135deg, ${color}, ${shade(color,-30)})`;

  const placeRow = p => `
    <div class="rec" data-go="${esc(p.id)}">
      <div class="n" style="color:${themeColor((p.themes||[])[0])}">→</div>
      <div><div class="t">${esc(p.name)}${p.key ? ' <span class="badge-key">重点</span>' : ''}</div>
      <div class="d">${esc(provText(p.province))} · ${(p.themes||[]).map(themeName).join(' / ')} · ${esc(seasonShort(p) || '季节待补充')}</div></div>
    </div>`;
  /* 代表景点：能在 attractions.json 里按 name 对上的做成可点（跳到所属目的地并高亮），其余标注未结构化 */
  const spotPill = s => s.attraction
    ? `<span class="pill link" data-spot="${esc(s.attraction.id)}" title="跳转到景点「${esc(s.attraction.name)}」">${esc(s.name)}</span>`
    : `<span class="pill" title="attractions.json 中暂无同名景点（未结构化）">${esc(s.name)}</span>`;
  const bindSpots = () => $('#dwBody').querySelectorAll('[data-spot]').forEach(n=>{ n.onclick = ()=> openSpot(n.dataset.spot); });

  $('#dwBody').innerHTML = `
    <div class="dw-sec">
      <h5>什么时候去</h5>
      ${calHTML(r._season)}
      <div class="cal-note">${esc(seasonDisplay(r) || '季节信息待补充')}</div>
    </div>
    <div class="dw-sec">
      <h5>区域速写</h5>
      <p>${txt(r.summary)}</p>
    </div>
    ${r.transport ? `<div class="dw-sec"><h5>交通与动线</h5><p>${txt(r.transport)}</p></div>` : ''}
    ${r.places.length ? `<div class="dw-sec">
      <h5>关联目的地（${r.places.length}）</h5>
      <div class="dw-spots">${r.places.map(placeRow).join('')}</div>
    </div>` : ''}
    ${spots.length ? `<div class="dw-sec" style="margin-bottom:0">
      <h5>代表景点（${spots.length}${linked ? ' · 已结构化 ' + linked : ''}）</h5>
      <div class="pill-row" id="spotPills">
        ${spots.slice(0,SPOT_LIMIT).map(spotPill).join('')}
        ${spots.length>SPOT_LIMIT ? `<span class="pill more" id="spotMore">展开其余 ${spots.length-SPOT_LIMIT} 个</span>` : ''}
      </div>
      ${linked ? `<div class="cal-note">蓝色景点可直接跳到所属目的地，并高亮该景点。</div>` : ''}
    </div>` : ''}`;

  $('#dwBody').querySelectorAll('[data-go]').forEach(n=>{ n.onclick = ()=> openPlace(n.dataset.go, true); });
  bindSpots();
  const more = $('#spotMore');
  if (more) more.onclick = ()=>{ $('#spotPills').innerHTML = spots.map(spotPill).join(''); bindSpots(); };
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
  $('#drawer').classList.remove('open');
  state.current = null;
  state.regionId = null;
  if (infoWin) infoWin.close();
  renderTabs(); renderList(); renderMarkers();
}

