/* ============================================================
   途迹 · map     腾讯地图 / 标记 / 信息窗
   ------------------------------------------------------------
   依赖：00-core 10-data。全局：initMap failMap map markerLayer infoWin renderMarkers hoverPlace easeTo（initMap/failMap 供 SDK 的 inline onload/onerror 调用，必须是全局函数）
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
function renderMarkers(){
  if (!markerLayer || !PLACES.length) return;
  const styles = {}, geos = [];
  filteredPlaces().forEach(p=>{
    if (!p.coord || !p.key) return;          // 地图只打点「重点目的地」
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
function easeTo(coord, zoom){
  if (!map || !coord) return;
  try{ map.easeTo({ center:new TMap.LatLng(coord.lat,coord.lng), zoom: Math.max(map.getZoom(), zoom) }, { duration: 620 }); }
  catch(e){ map.setCenter(new TMap.LatLng(coord.lat,coord.lng)); map.setZoom(Math.max(map.getZoom(), zoom)); }
}

