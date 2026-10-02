/* ============================================================
   途迹 · map     腾讯地图 / 标记 / 信息窗
   ------------------------------------------------------------
   依赖：00-core 10-data。全局：initMap failMap map markerLayer infoWin renderMarkers hoverPlace easeTo lngShiftForPx drawerBiasPx（initMap/failMap 供 SDK 的 inline onload/onerror 调用，必须是全局函数）
   ============================================================ */
/* ============================================================
   地图（腾讯地图 GL JS · 代理模式）
   ============================================================ */
let map = null, markerLayer = null, infoWin = null;

function initMap(){
  if (typeof TMap === 'undefined'){ failMap(); return; }
  try{
    map = new TMap.Map('map', {
      center: new TMap.LatLng(35.5, 104.0),
      zoom: 4.1, pitch: 0, rotation: 0, showControl: false,
      baseMap: { type: 'vector' }
    });
    map.on('tilesloaded', ()=> $('#mapLoading').classList.add('hide'));
    setTimeout(()=> $('#mapLoading').classList.add('hide'), 3500);

    infoWin = new TMap.InfoWindow({
      map, position: new TMap.LatLng(35.5,104), enableCustom: true, content:'', offset:{ x:0, y:-46 }
    });
    infoWin.close();

    markerLayer = new TMap.MultiMarker({ map, styles:{}, geometries:[] });
    markerLayer.on('click', e => { if (e.geometry && e.geometry.id) openPlace(e.geometry.id, false); });
    renderMarkers();
  }catch(err){ console.error(err); failMap(); }
}
function failMap(){
  $('#mapLoading').classList.add('hide');
  $('#mapNote').classList.add('show');
}

function pinSVG(color, selected){
  const svg =
   `<svg xmlns="http://www.w3.org/2000/svg" width="34" height="44" viewBox="0 0 34 44">
      <path d="M17 43C17 43 32 27.5 32 16A15 15 0 1 0 2 16C2 27.5 17 43 17 43Z" fill="${color}" stroke="${selected?'#B08A3E':'#FFFFFF'}" stroke-width="${selected?3:2}"/>
      <circle cx="17" cy="16" r="5.4" fill="#FFFFFF"/>
    </svg>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}
/* 打点范围：默认只打「重点目的地」；
   已打开 / 限定某个旅游区域（state.regionId 有值）时，打该区域的全部关联目的地。
   与「目的地」/「旅游区域」标签页无关 —— 区域标签页本身仍只打重点目的地。 */
function markerPlaces(){
  const list = filteredPlaces().filter(p => p.coord);
  return state.regionId ? list : list.filter(p => p.key);
}
function renderMarkers(){
  if (!markerLayer || !PLACES.length) return;
  const styles = {}, geos = [];
  markerPlaces().forEach(p=>{
    const color = themeColor((p.themes||[])[0]);
    const sel = state.current && state.current.type==='place' && state.current.id===p.id;
    const scale = sel ? 1.22 : 1;
    const sid = color.replace('#','') + (sel ? '_s' : '');
    if (!styles[sid]) styles[sid] = new TMap.MarkerStyle({
      width: Math.round(34*scale), height: Math.round(44*scale),
      src: pinSVG(color, sel), anchor: { x:0.5, y:1 }
    });
    geos.push({ id:p.id, styleId:sid, position:new TMap.LatLng(p.coord.lat, p.coord.lng) });
  });
  markerLayer.setStyles(styles);
  markerLayer.setGeometries(geos);
}
function hoverPlace(p){
  if (!map || !infoWin || !p.coord) return;
  const color = themeColor((p.themes||[])[0]);
  infoWin.setContent(`<div class="iw"><b>${esc(p.name)}</b>
     <span>${esc(provText(p.province))} · ${esc(seasonShort(p) || '全年')}</span>
     <div class="iw-tags">
       ${(p.themes||[]).slice(0,3).map(t=>`<span class="mini-tag" style="background:${themeColor(t)}1A;color:${themeColor(t)}">${themeName(t)}</span>`).join('')}
     </div></div>`);
  infoWin.setPosition(new TMap.LatLng(p.coord.lat, p.coord.lng));
  infoWin.open();
}
/* ---------- 抽屉遮挡补偿 ----------
   抽屉压在右侧（.drawer 宽 432px / max-width 92vw），地图的「视觉中心」其实在未被遮挡区域的正中。
   让选中点落在那里 = 把它向左让出「抽屉的一半宽」；向左让点 = 把地图中心向右推同样多像素。
   目的地抽屉（openPlace → zoom 6.5）与区域抽屉（openRegion → zoom 5.5）共用 easeTo，因此两类抽屉行为一致。 */
const DRAWER_BIAS = 0.5;      // 0 = 不偏移；0.5 = 落在未遮挡区正中（想少挪一点就调小）
const MERCATOR_WORLD = 256;   // 腾讯 GL 底图 Web Mercator：世界宽 = 256 × 2^zoom px

function lngShiftForPx(zoom, px){                 // 屏幕水平位移 px → 经度增量（度）
  return px ? px * 360 / (MERCATOR_WORLD * Math.pow(2, zoom)) : 0;
}
function drawerBiasPx(){                          // 抽屉实际压住地图多少 → 需要让出的半宽（px）
  const d = document.getElementById('drawer'), m = document.getElementById('map');
  if (!d || !m || !d.classList.contains('open')) return 0;    // 抽屉没开就不偏移
  const dr = d.getBoundingClientRect(), mr = m.getBoundingClientRect();
  const overlap = Math.max(0, Math.min(dr.width, mr.right - dr.left, mr.width));
  return Math.min(overlap * DRAWER_BIAS, mr.width * 0.42);    // 窄屏（92vw）兜底：别把图钉顶出画面
}
function easeTo(coord, zoom){
  if (!map || !coord) return;
  const z = Math.max(map.getZoom(), zoom);
  const center = new TMap.LatLng(coord.lat, coord.lng + lngShiftForPx(z, drawerBiasPx()));
  try{ map.easeTo({ center, zoom: z }, { duration: 620 }); }
  catch(e){ map.setCenter(center); map.setZoom(z); }
}

