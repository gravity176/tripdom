/* ============================================================
   途迹 · events  全局事件绑定（顶栏 / 侧栏 / 滑块 / 快捷键）
   ------------------------------------------------------------
   依赖：以上全部（DOM 在 body 末尾已就绪）。无导出，纯副作用
   ============================================================ */
/* ============================================================
   事件绑定
   ============================================================ */
$('#dwClose').onclick = closeDrawer;
$('#q').oninput = e => { state.q = e.target.value.trim(); render(); };
$('#rsMin').addEventListener('input', ()=>{ syncRange(); render(); });
$('#rsMax').addEventListener('input', ()=>{ syncRange(); render(); });
$('#rangeReset').onclick = ()=>{ $('#rsMin').value = 0; $('#rsMax').value = 35; syncRange(); render(); };
$('#tabPlaces').onclick  = ()=>{ state.tab='places';  render(); };
$('#tabRegions').onclick = ()=>{ state.tab='regions'; render(); };
$('#regionBannerClear').onclick = ()=>{ state.regionId=null; render(); };
$('#btnReset2').onclick = ()=>{ if(map){ map.setCenter(new TMap.LatLng(35.5,104.0)); map.setZoom(4.1); } closeDrawer(); };
$('#btnIn').onclick  = ()=> map && map.setZoom(Math.min(18, map.getZoom()+1));
$('#btnOut').onclick = ()=> map && map.setZoom(Math.max(3,  map.getZoom()-1));
$('#btnSurprise').onclick = ()=>{
  const list = filteredPlaces().filter(p=>p.key);
  if (!list.length) return;
  const pick = list[Math.floor(Math.random()*list.length)];
  openPlace(pick.id, true); toast('为你推荐：' + pick.name);
};
$('#btnMenu').onclick = ()=>{ $('#sidebar').classList.add('open'); $('#scrim').classList.add('show'); };
$('#scrim').onclick   = ()=>{ $('#sidebar').classList.remove('open'); $('#scrim').classList.remove('show'); };
document.addEventListener('keydown', e=>{ if(e.key==='Escape') closeDrawer(); });

function render(){
  renderThemeChips(); renderTabs(); renderList(); renderMarkers();
}

