/* ============================================================
   途迹 · list    侧栏渲染（主题标签 / 卡片 / 统计 / 图例 / 标签页）
   ------------------------------------------------------------
   依赖：00-core 10-data。全局：renderThemeChips/renderStats/renderLegend/renderTabs/renderList/placeCard/regionCard
   ============================================================ */
/* ============================================================
   渲染：侧栏
   ============================================================ */
/* 旬级双滑块：读取滑块值 → 更新 state.range / 填充条 / 文字标签 */
function syncRange(){
  let a = +$('#rsMin').value, b = +$('#rsMax').value;
  const s = Math.min(a,b), e = Math.max(a,b);
  $('#drFill').style.left  = (s/35*100) + '%';
  $('#drFill').style.width = ((e-s)/35*100) + '%';
  if (s === 0 && e === 35){
    state.range = null;
    $('#cRange').textContent = '不限';
  } else {
    state.range = [s,e];
    $('#cRange').textContent = xunLabel(s) + ' — ' + xunLabel(e);
  }
}
function renderThemeChips(){
  const tc = $('#themeChips'); tc.innerHTML='';
  Object.entries(THEMES).forEach(([id,t])=>{
    const b = el('button','chip'+(state.themes.has(id)?' on':''),
      `<span class="swatch" style="background:${t.color}"></span>${t.name}`);
    b.onclick = ()=>{ state.themes.has(id) ? state.themes.delete(id) : state.themes.add(id); render(); };
    tc.appendChild(b);
  });
}
function renderTabs(){
  $('#tabPlaces').classList.toggle('on', state.tab==='places');
  $('#tabRegions').classList.toggle('on', state.tab==='regions');
  $('#nPlaces').textContent  = PLACES.length;
  $('#nRegions').textContent = REGIONS.length;
  const banner = $('#regionBanner');
  if (state.regionId && regionById[state.regionId] && state.tab==='places'){
    banner.style.display='flex';
    $('#regionBannerName').textContent = regionName(regionById[state.regionId]);
  } else banner.style.display='none';
}

function placeCard(p){
  const color = themeColor((p.themes||[])[0]);
  const card = el('div','card'+(state.current && state.current.type==='place' && state.current.id===p.id?' on':''));
  const regions = (p.regionIds||[]).map(id => regionById[id]).filter(Boolean);
  const meta = [`<span>${esc(provText(p.province))}</span>`];
  if (regions.length)   meta.push(`<span>${esc(regions.map(regionName).join(' / '))}</span>`);
  meta.push(`<span>${esc(seasonShort(p) || '季节待补充')}</span>`);
  if ((p.attractions||[]).length) meta.push(`<span>${(p.attractions||[]).length} 个景点</span>`);
  card.innerHTML = `
    <div class="card-thumb" style="background:linear-gradient(135deg,${color},${shade(color,-22)})">
      ${esc(p.name.slice(0,2))}
    </div>
    <div class="card-body">
      <div class="card-title">${esc(p.name)}</div>
      <div class="card-meta">${meta.join('')}</div>
      <div class="card-desc">${txt(p.summary)}</div>
      <div class="card-tags">${(p.themes||[]).map(t=>`<span class="mini-tag">${themeName(t)}</span>`).join('')}</div>
    </div>`;
  card.onclick = ()=> openPlace(p.id, true);
  card.onmouseenter = ()=> { if (p.coord) hoverPlace(p); };
  return card;
}
function regionCard(r){
  const color = themeColor((r.themes||[])[0]);
  const card = el('div','card'+(state.current && state.current.type==='region' && state.current.id===r.id?' on':''));
  card.innerHTML = `
    <div class="card-thumb" style="background:linear-gradient(135deg,${color},${shade(color,-22)})">
      ${esc(regionName(r).slice(0,2))}
    </div>
    <div class="card-body">
      <div class="card-title">${esc(regionName(r))}
        <span style="font-size:11px;color:var(--ink-3);font-weight:400">${esc(provText(r.province))}</span>
      </div>
      <div class="card-meta"><span>${r.places.length} 个目的地</span><span>${(r.spots||[]).length} 个代表景点</span><span>${esc(seasonShort(r) || '季节待补充')}</span></div>
      <div class="card-desc">${txt(r.summary)}</div>
      <div class="card-tags">${(r.themes||[]).map(t=>`<span class="mini-tag">${themeName(t)}</span>`).join('')}</div>
    </div>`;
  card.onclick = ()=> openRegion(r.id, true);
  return card;
}
function renderList(){
  const box = $('#list'); box.innerHTML='';
  if (state.tab==='places'){
    const list = filteredPlaces();
    $('#footCount').textContent = '显示 ' + list.length + ' 个';
    if (!list.length){
      box.appendChild(el('div','empty',
        state.q ? '没有匹配的目的地<br>试试其他关键词（如 红叶 / 古城 / 雪山）'
                : '没有符合条件的目的地<br>试试放宽月份或主题'));
      return;
    }
    list.forEach(p=> box.appendChild(placeCard(p)));
  } else {
    const list = filteredRegions();
    $('#footCount').textContent = '显示 ' + list.length + ' 个';
    if (!list.length){
      box.appendChild(el('div','empty','没有符合条件的旅游区域<br>试试放宽月份或主题'));
      return;
    }
    list.forEach(r=> box.appendChild(regionCard(r)));
  }
}
function renderLegend(){
  const box = $('#legendRows'); box.innerHTML='';
  Object.values(THEMES).forEach(t=>{
    box.appendChild(el('div','legend-row', `<i style="background:${t.color}"></i>${t.name}`));
  });
}
function renderStats(){
  $('#sRegion').textContent = REGIONS.length;
  $('#sDest').textContent   = PLACES.length;
  $('#sSpot').textContent   = ATTRACTIONS.length;
  $('#footLayer').textContent = '三层结构：区域 ' + REGIONS.length + ' · 目的地 ' + PLACES.length
    + (ATTRACTIONS.length ? ' · 景点 ' + ATTRACTIONS.length : '（等待 attractions.json）');
}

