/* ============================================================
   途迹 · boot    启动：并行载入数据 → 双轨季节解析 → 关联 → 首渲染
   ------------------------------------------------------------
   依赖：以上全部（最后加载）。data/general.json + provinceRegions.json + places.json + attractions.json（+ 可选 backgrounds.json）
   ============================================================ */
/* ============================================================
   启动：加载数据层 → 双轨季节解析 → 关联 → 渲染
   ------------------------------------------------------------
   data/general.json         元数据：主题 / 省份 / 大区
   data/provinceRegions.json 第一层：旅游区域
   data/places.json          第二层：目的地
   data/attractions.json     第三层：景点（缺失时降级为「待补充」）
   ============================================================ */
(async function boot(){
  const grab = url => fetch(url, { cache:'no-store' })
    .then(res => res.ok ? res.json() : Promise.reject(new Error('HTTP ' + res.status + ' ' + url)));

  try{
    const [gen, reg, plc, att] = await Promise.all([
      grab('./data/general.json')          .catch(e => { console.warn('general.json 未载入，改用内置主题字典', e); return null; }),
      grab('./data/provinceRegions.json'),
      grab('./data/places.json'),
      grab('./data/attractions.json')      .catch(e => { console.warn('attractions.json 未载入，第三层降级为待补充', e); return null; })
    ]);

    /* 元数据（general.json）：主题字典、省份→大区、站点标题 */
    if (gen){
      GENERAL = gen;
      setThemes(gen.themes);
      macroOfProvince = Object.fromEntries((gen.provinces || []).map(x => [x.name, x.region]));
      if (gen.meta && gen.meta.title) document.title = gen.meta.title;
    }

    REGIONS     = reg.provinceRegions || reg.regions || (Array.isArray(reg) ? reg : []);
    PLACES      = (plc.places || []).map(p => ({ ...p, key: !!p.key }));
    ATTRACTIONS = (att && (att.attractions || [])) || [];

    /* 索引 */
    regionById  = Object.fromEntries(REGIONS.map(r=>[r.id,r]));
    placeById   = Object.fromEntries(PLACES.map(p=>[p.id,p]));
    placeByName = Object.fromEntries(PLACES.map(p=>[p.name,p]));
    attractionById = {}; attractionByName = {};
    ATTRACTIONS.forEach(a=>{                       // 景点名可重名（如「天台山」「泸沽湖」）→ 存数组
      attractionById[a.id] = a;
      const cur = attractionByName[a.name];
      if (cur === undefined)            attractionByName[a.name] = a;
      else if (Array.isArray(cur))      cur.push(a);
      else                              attractionByName[a.name] = [cur, a];
    });

    /* 双轨季节解析：bestSeasonDigit（机器）优先，bestSeason（文本）兜底 */
    PLACES.forEach(p      => { p._season = seasonOf(p); });
    REGIONS.forEach(r     => { r._season = seasonOf(r); });
    ATTRACTIONS.forEach(a => { a._season = seasonOf(a); });

    linkRegions();

    /* 自检：有 bestSeason 文本却解析不出旬号区间的，通常是 data 里出现了新写法 */
    const miss = [].concat(PLACES, REGIONS, ATTRACTIONS).filter(x => x.bestSeason && !x._season);
    if (miss.length) console.warn('[season] ' + miss.length + ' 条 bestSeason 文本未解析出旬号：'
      + miss.map(x=>x.id + '(' + x.bestSeason + ')').join(' | '));
  }catch(err){
    console.error(err);
    $('#fatal').classList.add('show');
    return;
  }

  syncRange();
  renderLegend(); renderStats(); render();
})();
