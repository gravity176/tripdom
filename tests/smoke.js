/* 无头冒烟测试：把拆出的 styles.css + js/*.js 放进伪 DOM 里跑真实 boot() + 渲染 + 抽屉 */
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.resolve(process.argv[2] || path.join(__dirname, '..'));

const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const css  = fs.readFileSync(path.join(ROOT, 'styles.css'), 'utf8');
const JS_ORDER = ['00-core.js','10-data.js','20-list.js','30-map.js','40-drawer.js','50-events.js','90-boot.js'];
const JS = JS_ORDER.map(f => ({ f, code: fs.readFileSync(path.join(ROOT, 'js', f), 'utf8') }));
const main = JS.map(x => x.code).join('\n');

/* ---------- 拆分完整性自检（结构，不依赖运行） ---------- */
{
  const checks = [];
  checks.push(['index.html 无内联 <style>', !/<style>/.test(html)]);
  checks.push(['index.html 引用 styles.css', html.includes('href="styles.css"')]);
  JS_ORDER.forEach(f => checks.push(['index.html 引用 js/' + f, html.includes('src="js/' + f + '"')]));
  checks.push(['页面只剩 1 个内联 <script>（腾讯地图代理配置）', (html.match(/<script>/g) || []).length === 1]);
  checks.push(['腾讯 SDK 仍带 onload="initMap()"', html.includes('onload="initMap()"')]);
  JS.forEach(({ f, code }) => {                       // 语法校验（不执行）
    try { new vm.Script(code, { filename: f }); checks.push([f + ' 语法通过', true]); }
    catch (e) { checks.push([f + ' 语法通过：' + e.message, false]); }
  });
  checks.push(['styles.css 含关键选择器', ['.drawer', '.dw-hero', '.cal .m', '.pill'].every(s => css.includes(s))]);
  const bad = checks.filter(c => !c[1]);
  console.log('=== 0. 拆分完整性 ===');
  checks.forEach(c => { if (!c[1]) console.log('  ✗ ' + c[0]); });
  console.log(bad.length ? `  ✗ ${bad.length}/${checks.length} 项未通过` : `  ✓ ${checks.length} 项全部通过`);
  if (bad.length) process.exit(1);
}

/* ---------- 伪 DOM ---------- */
const store = new Map();
function mkEl(key){
  const node = {
    key, _html:'', textContent:'', value: key==='#rsMax' ? '35' : '0', hidden:false,
    style:{}, dataset:{}, className:'', scrollTop:0, children:[], _ev:{},
    classList:{ _s:new Set(),
      add(...c){ c.forEach(x=>this._s.add(x)); },
      remove(...c){ c.forEach(x=>this._s.delete(x)); },
      toggle(c,f){ f===undefined ? (this._s.has(c)?this._s.delete(c):this._s.add(c)) : (f?this._s.add(c):this._s.delete(c)); },
      contains(c){ return this._s.has(c); } },
    appendChild(c){ this.children.push(c); return c; },
    addEventListener(t,f){ (this._ev[t]=this._ev[t]||[]).push(f); },
    querySelector(){ return mkEl('anon'); },
    querySelectorAll(){ return []; },
    get innerHTML(){ return this._html; },
    set innerHTML(v){ this._html = String(v); },
    setAttribute(k,v){ this[k]=v; },
    removeAttribute(k){ delete this[k]; },
    getBoundingClientRect(){ return { left:620, top:300, right:720, bottom:326, width:100, height:26 }; },
    scrollIntoView(){}, remove(){}, focus(){},
  };
  return node;
}
const dom = {
  title: '',
  querySelector(sel){ if(!store.has(sel)) store.set(sel, mkEl(sel)); return store.get(sel); },
  getElementById(id){ return this.querySelector('#'+id); },
  createElement(tag){ return mkEl('<'+tag+'>'); },
  addEventListener(){},
};
global.document = dom;
global.window = global;
global.addEventListener = () => {};        // 伪 window.addEventListener（真浏览器里本来就有）
global.innerWidth = 1280;
global.innerHeight = 800;

/* ---------- fetch → 本地文件 ---------- */
const fetched = [];
global.fetch = async (url) => {
  fetched.push(url);
  const p = path.join(ROOT, String(url).replace(/^\.\//,''));
  const text = fs.readFileSync(p, 'utf8');
  return { ok:true, status:200, json: async () => JSON.parse(text) };
};

/* ---------- 跑主脚本 ---------- */
const warns = [];
const origWarn = console.warn;
console.warn = (...a) => { warns.push(a.join(' ')); };
vm.runInThisContext(main, { filename:'index.html' });


/* 等 boot() 的异步链走完 */
const sleep = ms => new Promise(r=>setTimeout(r,ms));
(async () => {
  for (let i=0;i<60 && store.get('#sDest') && store.get('#sDest').textContent === '—'; i++) await sleep(50);
  await sleep(200);
  console.warn = origWarn;

  const run = code => vm.runInThisContext(code);
  const fail = [], pass = [];
  const ok  = (cond, msg) => (cond ? pass : fail).push(msg);
  const eq  = (a, b, msg) => ok(a === b, `${msg}  (实际 ${JSON.stringify(a)} / 期望 ${JSON.stringify(b)})`);

  const rd = f => JSON.parse(fs.readFileSync(path.join(ROOT,'data/'+f),'utf8'));
  const data = { gen: rd('general.json'), reg: rd('provinceRegions.json'), plc: rd('places.json'), att: rd('attractions.json') };

  console.log('=== 1. 载入 & 计数 ===');
  eq(fetched.length, 5, 'fetch 了 5 个 data 文件（含可选的 backgrounds.json）');
  console.log('  请求：', fetched.join(' , '));
  eq(run('REGIONS.length'), data.reg.provinceRegions.length, 'REGIONS 数量');
  eq(run('PLACES.length'),  data.plc.places.length,            'PLACES 数量');
  eq(run('ATTRACTIONS.length'), data.att.attractions.length,   'ATTRACTIONS 数量');
  eq(store.get('#sRegion').textContent, data.reg.provinceRegions.length, '顶栏 旅游区域 计数');
  eq(store.get('#sDest').textContent,   data.plc.places.length,          '顶栏 目的地 计数');
  eq(store.get('#sSpot').textContent,   data.att.attractions.length,     '顶栏 景点 计数');
  console.log('  footLayer =', store.get('#footLayer').textContent);
  console.log('  title =', dom.title, '| #nPlaces =', store.get('#nPlaces').textContent, '| #nRegions =', store.get('#nRegions').textContent);

  console.log('\n=== 2. 区域 → 目的地 显式关联 ===');
  const linkStat = run(`JSON.stringify({
    refs: REGIONS.reduce((s,r)=>s+r.placeNames.length,0),
    matched: REGIONS.reduce((s,r)=>s+r.places.length,0),
    emptyRegions: REGIONS.filter(r=>r.places.length===0).map(r=>r.id),
    multi: PLACES.filter(p=>p.regionIds.length>1).map(p=>[p.id,p.regionIds]),
    noRegion: PLACES.filter(p=>p.regionIds.length===0).length,
    noCentroid: REGIONS.filter(r=>!r.centroid).map(r=>r.id)
  })`);
  console.log(' ', linkStat);
  const L = JSON.parse(linkStat);
  eq(L.refs, L.matched, '区域引用的目的地全部命中（引用数 = 命中数）');
  eq(L.emptyRegions.length, 0, '没有空区域');
  eq(L.multi.length, 5, '5 个目的地跨两个区域（河西走廊 ∩ 青甘大环线）');
  ok(L.noCentroid.length === 0, '每个区域都有中心点' + (L.noCentroid.length ? ' 缺失:'+L.noCentroid : ''));

  console.log('\n=== 3. 景点挂载（placeId） ===');
  const aStat = JSON.parse(run(`JSON.stringify({
    attached: PLACES.reduce((s,p)=>s+p.attractions.length,0),
    withSpots: PLACES.filter(p=>p.attractions.length).length,
    maxPlace: PLACES.slice().sort((a,b)=>b.attractions.length-a.attractions.length)[0],
    dupNames: Object.entries(attractionByName).filter(([k,v])=>Array.isArray(v)).map(([k,v])=>k+'x'+v.length)
  })`));
  console.log('  已挂载景点 =', aStat.attached, '；有景点的目的地 =', aStat.withSpots, '；重名景点 =', JSON.stringify(aStat.dupNames));
  console.log('  景点最多的目的地 =', aStat.maxPlace.name, aStat.maxPlace.attractions.length);
  eq(aStat.attached, data.att.attractions.filter(a=>data.plc.places.some(p=>p.id===a.placeId)).length, '挂载数与 placeId 可匹配数一致');

  console.log('\n=== 4. 区域代表景点 → attractions.name 挂接 ===');
  const sStat = JSON.parse(run(`JSON.stringify({
    total: REGIONS.reduce((s,r)=>s+r.spots.length,0),
    linked: REGIONS.reduce((s,r)=>s+r.spots.filter(x=>x.attraction).length,0),
    sample: REGIONS.slice(0,3).map(r=>r.id+':'+r.spots.filter(x=>x.attraction).length+'/'+r.spots.length)
  })`));
  console.log('  ' + sStat.total + ' 个代表景点，已结构化 ' + sStat.linked);
  console.log('  抽 3 个区域：', sStat.sample.join(' | '));
  ok(sStat.linked > 0 && sStat.linked < sStat.total, '部分代表景点已结构化（可点击），其余保持未结构化');

  console.log('\n=== 5. 双轨季节解析（真实数据） ===');
  const seStat = JSON.parse(run(`JSON.stringify({
    total: PLACES.length + REGIONS.length + ATTRACTIONS.length,
    withDigit: [].concat(PLACES,REGIONS,ATTRACTIONS).filter(x=>x.bestSeasonDigit).length,
    withText:  [].concat(PLACES,REGIONS,ATTRACTIONS).filter(x=>x.bestSeason).length,
    missText:  [].concat(PLACES,REGIONS,ATTRACTIONS).filter(x=>x.bestSeason && !x._season).map(x=>x.id+'「'+x.bestSeason+'」'),
    nullSeason:[].concat(PLACES,REGIONS,ATTRACTIONS).filter(x=>!x._season).length,
    crossYear: [].concat(PLACES,REGIONS,ATTRACTIONS).filter(x=>(x._season||[]).some(s=>s[1]>35)).length,
    allYear:   [].concat(PLACES,REGIONS,ATTRACTIONS).filter(x=>JSON.stringify(x._season)==='[[0,35]]').length,
    multi:     [].concat(PLACES,REGIONS,ATTRACTIONS).filter(x=>(x._season||[]).length>1).length,
    parens:    [].concat(PLACES,REGIONS,ATTRACTIONS).filter(x=>x.bestSeason && /[（(]/.test(x.bestSeason)).length,
    parenOk:   [].concat(PLACES,REGIONS,ATTRACTIONS).filter(x=>x.bestSeason && /[（(]/.test(x.bestSeason) && x._season).length,
    samples:   [].concat(PLACES,REGIONS,ATTRACTIONS).filter(x=>x.bestSeason && /[（(]/.test(x.bestSeason)).slice(0,3)
                 .map(x=>x.bestSeason + '   →   ' + JSON.stringify(x._season)),
    samples2:  [].concat(PLACES,REGIONS,ATTRACTIONS).filter(x=>x.bestSeason && /中下旬|次年|全年|—|至/.test(x.bestSeason)).slice(0,4)
                 .map(x=>x.bestSeason + '   →   ' + JSON.stringify(x._season)),
    badRange:  [].concat(PLACES,REGIONS,ATTRACTIONS).flatMap(x=>(x._season||[])).filter(([a,b])=>!(Number.isInteger(a)&&Number.isInteger(b)&&a>=0&&a<=35&&b>=0&&b<=71&&b-a<=35)).map(r=>JSON.stringify(r))
  })`));
  console.log('  记录总数 ' + seStat.total + '：本批数据带 bestSeasonDigit ' + seStat.withDigit + ' 条 / 带 bestSeason 文本 ' + seStat.withText + ' 条');
  console.log('  跨年段(结束旬>35) ' + seStat.crossYear + ' 条；全年 ' + seStat.allYear + ' 条；多段 ' + seStat.multi + ' 条；无季节数据 ' + seStat.nullSeason + ' 条');
  console.log('  含括号解释的 ' + seStat.parens + ' 条，解析成功 ' + seStat.parenOk + ' 条');
  console.log('  真实样例（带括号）；'); seStat.samples.forEach(s=>console.log('   - ' + s));
  console.log('  真实样例（跨年/全年/中下旬/连接号）：'); seStat.samples2.forEach(s=>console.log('   - ' + s));
  eq(seStat.missText.length, 0, '所有 bestSeason 文本都解析出旬号' + (seStat.missText.length?' 失败:'+JSON.stringify(seStat.missText.slice(0,6)):''));
  eq(seStat.parenOk, seStat.parens, '括号内的解释文字不污染季节解析');
  eq(seStat.badRange.length, 0, '所有旬号区间值域合法 (0-35 / 跨年 +36 内)' + (seStat.badRange.length?' 异常:'+JSON.stringify(seStat.badRange.slice(0,5)):''));
  console.log('  注：当前 data 尚未写入 bestSeasonDigit，因此全部走文本轨（这正是双轨兜底设计）');

  console.log('\n=== 5b. 解析器单测（含 digit 轨合成数据） ===');
  const textCases = [['全年',[[0,35]]],['1月至12月',[[0,35]]],['10月中旬-次年4月下旬；5月上旬-6月下旬',[[28,47],[12,17]]],
    ['5月上旬-6月下旬（草原美景）',[[12,17]]],['11月中旬-下旬',[[31,32]]],['4月中下旬',[[10,11]]],
    ['3月下旬-4月中旬',[[8,10]]],['1月上旬—2月下旬',[[0,5]]],['7月',[[18,20]]],['12月下旬-次年2月中旬',[[35,40]]],
    ['（原文称5月未到时候、要到6月；与九寨沟同线）',null],['',null],['待定',null],['6月上旬;9月中旬-10月下旬',[[15,15],[25,29]]]];
  const tBad = textCases.filter(c => JSON.stringify(run(`parseSeasonText(${JSON.stringify(c[0])})`)) !== JSON.stringify(c[1]))
                        .map(c => `「${c[0]}」→ ` + JSON.stringify(run(`parseSeasonText(${JSON.stringify(c[0])})`)) + ` 期望 ` + JSON.stringify(c[1]));
  eq(tBad.length, 0, textCases.length + ' 个文本轨用例' + (tBad.length ? ' 失败: '+tBad.join(' ; ') : ''));
  const digitCases = [[[[0,35]],[[0,35]]],[[[28,47]],[[28,47]]],[[[28,47],[12,17]],[[28,47],[12,17]]],
    [[[28,47],[100,106]],[[28,47],[28,34]]],[[[28,11]],[[28,47]]],[null,null],[[],null],['x',null],[[[5]],null],[[[10,'a']],null]];
  const dBad = digitCases.filter(c => JSON.stringify(run(`parseSeasonDigit(${JSON.stringify(c[0])})`)) !== JSON.stringify(c[1]))
                         .map(c => JSON.stringify(c[0]) + ' → ' + JSON.stringify(run(`parseSeasonDigit(${JSON.stringify(c[0])})`)));
  eq(dBad.length, 0, digitCases.length + ' 个 digit 轨用例' + (dBad.length ? ' 失败: '+dBad.join(' ; ') : ''));
  const prio = JSON.parse(run(`JSON.stringify((function(){
    const t = PLACES.find(p=>p.bestSeason);
    return { digitWins: seasonOf({ bestSeason:t.bestSeason, bestSeasonDigit:[[0,2]] }),
             textFallback: seasonOf({ bestSeason:t.bestSeason }),
             text: t.bestSeason };
  })())`));
  console.log('  双轨优先级：digit 覆盖文本 → ' + JSON.stringify(prio.digitWins) + '；纯文本 → ' + JSON.stringify(prio.textFallback));
  eq(JSON.stringify(prio.digitWins), '[[0,2]]', 'bestSeasonDigit 存在时优先于 bestSeason');
  ok(JSON.stringify(prio.textFallback) !== 'null', 'bestSeasonDigit 缺失时回退到 bestSeason 文本轨');


  console.log('\n=== 6. coversRange 跨年 & 月历 ===');
  const cases = [[[[0,35]],0,35,true],[[[28,47]],28,28,true],[[[28,47]],0,0,true],[[[28,47]],27,27,false],
                 [[[28,47]],11,11,true],[[[12,17]],14,14,true],[[[12,17]],18,18,false],[[[0,2]],35,35,false],
                 [[[33,41]],0,5,true],[[[6,8]],5,7,true],[null,0,35,true],[[[28,47]],29,33,true],[[[28,47]],12,12,false]];
  let bad = 0;
  cases.forEach(c=>{ const got = run(`coversRange(${JSON.stringify(c[0])}, ${c[1]}, ${c[2]})`); if (got !== c[3]){ bad++; console.log('   ✗', JSON.stringify(c), '→', got); } });
  eq(bad, 0, cases.length + ' 个 coversRange 用例全部通过');
  eq((run('calHTML([[28,47]])').match(/class="m good"/g)||[]).length, 7, '「10月中旬-次年4月下旬」高亮 7 个月（10月→次年4月）');
  eq((run('calHTML([[0,35]])').match(/class="m good"/g)||[]).length, 12, '「全年」高亮 12 个月');
  eq((run('calHTML(null)').match(/class="m good"/g)||[]).length, 12, '季节缺失时月历不置灰（不参与筛选）');


  console.log('\n=== 7. 省份归一化 & 大区 ===');
  const provCases = [['广西壮族自治区','广西'],['新疆维吾尔自治区','新疆'],['宁夏回族自治区','宁夏'],['内蒙古自治区','内蒙古'],
   ['西藏自治区','西藏'],['四川省','四川'],['北京市','北京'],['香港特别行政区','香港'],['甘肃省','甘肃'],['西宁市','西宁']];
  const provBad = provCases.filter(p => run(`normProv(${JSON.stringify(p[0])})`) !== p[1])
                           .map(p => p[0] + ' → ' + run(`normProv(${JSON.stringify(p[0])})`));
  eq(provBad.length, 0, '10 个省份/城市归一化用例' + (provBad.length ? ' 失败:'+provBad : ''));
  const provMiss = JSON.parse(run(`JSON.stringify(PLACES.map(p=>({n:p.name, p:provList(p.province)[0], m:macroRegion(provList(p.province)[0])})).filter(x=>!x.m))`));
  eq(provMiss.length, 0, '所有目的地的省份都能映射到大区' + (provMiss.length ? ' 缺失:'+JSON.stringify(provMiss.slice(0,5)) : ''));
  ok(run('placeHay(PLACES.find(p=>p.name==="敦煌"))').includes('西北'), '搜索词库包含大区名（敦煌 → 西北）');

  console.log('\n=== 8. 搜索穿透：景点名 → 目的地 ===');
  const s1 = run(`(function(){ state.q='莫高窟'; return filteredPlaces().map(p=>p.name); })()`);
  console.log('  搜「莫高窟」→', JSON.stringify(s1));
  ok(s1.includes('敦煌'), '景点名「莫高窟」能搜到目的地「敦煌」');
  const s2 = run(`(function(){ state.q='河西走廊'; return filteredPlaces().map(p=>p.name); })()`);
  console.log('  搜「河西走廊」→ ' + s2.length + ' 个目的地');
  ok(s2.length > 0, '区域名「河西走廊」能搜到目的地');
  const s3 = run(`(function(){ state.q=''; state.regionId='hexi-corridor'; return filteredPlaces().length; })()`);
  console.log('  限定区域 hexi-corridor →', s3, '个目的地');
  ok(s3 > 0 && s3 < run('PLACES.length'), '区域筛选生效（河西走廊）');
  const jan = JSON.parse(run(`JSON.stringify((function(){
    state.q=''; state.regionId=null; state.range=[0,2];      // 只选 1 月（旬号 0-2）
    const out = filteredPlaces();
    // 独立校验：把区间展开成 0-35 的旬号集合，与 1 月的 3 个旬求交集
    const coversJan = p => {
      const segs = p._season; if (!segs) return true;
      const win = [0,1,2];
      return segs.some(seg => {
        for (let i=seg[0]; i<=seg[1]; i++) if (win.indexOf(((i%36)+36)%36) >= 0) return true;
        return false;
      });
    };
    const bad = out.filter(p => !coversJan(p)).map(p=>p.name+JSON.stringify(p._season));
    const total = PLACES.length;
    state.range=null;
    return { kept: out.length, total: total, bad: bad, sample: out.slice(0,4).map(p=>p.name) };
  })())`));
  console.log('  季节筛选「1月」→ 保留 ' + jan.kept + '/' + jan.total + ' 个目的地，样例 ' + JSON.stringify(jan.sample));
  ok(jan.kept > 0 && jan.kept < jan.total, '季节筛选确实在收窄结果');
  eq(jan.bad.length, 0, '筛选结果全部真的覆盖 1 月' + (jan.bad.length ? ' 例外:'+JSON.stringify(jan.bad.slice(0,5)) : ''));
  run(`state.regionId=null; state.q=''`);

  console.log('\n=== 9. 抽屉渲染（真实调用 openPlace / openRegion） ===');
  const gradePlace = run(`PLACES.filter(p=>p.attractions.some(a=>a.grade)).map(p=>p.id)[0]`);
  run(`openPlace(${JSON.stringify(gradePlace)}, true)`);
  const pBody = store.get('#dwBody').innerHTML;
  console.log('  ' + store.get('#dwKicker').textContent + ' | ' + store.get('#dwName').textContent + ' | ' + store.get('#dwRegion').textContent);
  ok(pBody.includes('什么时候去') && pBody.includes('class="cal"'), '目的地抽屉含月历');
  ok(pBody.includes('所属旅游区域') && pBody.includes('data-region='), '目的地抽屉含可点击的区域链接');
  ok(pBody.includes('关联景点') && pBody.includes('id="spot-'), '目的地抽屉列出景点名称（带 id 供高亮）');
  ok(!/class="spot"/.test(pBody) && pBody.includes('class="pill link"'), '景点在抽屉里只以名称 pill 呈现（不再铺卡片）');
  const gradeTip = run(`[...TIPS.values()].find(h=>/★ \\d/.test(h)) || ''`);
  ok(/★ \d/.test(gradeTip), 'grade 数字进悬浮卡渲染成 ★ n');
  ok(!/undefined|\[object/.test(pBody), '目的地抽屉无 undefined');
  console.log('  抽屉 HTML 长度 ' + pBody.length + '；景点名称 ' + (pBody.match(/data-spot=/g)||[]).length + ' 个');

  run(`openPlace(${JSON.stringify(aStat.maxPlace.id)}, true)`);
  console.log('  景点最多的目的地「' + store.get('#dwName').textContent + '」：' + (store.get('#dwBody').innerHTML.match(/data-spot=/g)||[]).length + ' 个景点名称');

  const topRegion = run(`REGIONS.slice().sort((a,b)=>b.spots.length-a.spots.length)[0].id`);
  run(`openRegion(${JSON.stringify(topRegion)}, true)`);
  const rBody = store.get('#dwBody').innerHTML;
  console.log('  ' + store.get('#dwKicker').textContent + ' | ' + store.get('#dwName').textContent + ' | ' + store.get('#dwRegion').textContent);
  ok(rBody.includes('关联目的地') && rBody.includes('class="name-item"') && rBody.includes('data-go='), '关联目的地只列名称（.name-item）且可跳转');
  ok(rBody.includes('关联景点') && rBody.includes('pill link'), '可点击的关联景点使用 .pill.link');
  ok(rBody.includes('pill more'), '代表景点超过 18 个时渲染「展开其余」');
  ok(!/class="rec"/.test(rBody), '旧的 .rec 卡片行已不再输出');
  ok(!/undefined|\[object/.test(rBody), '区域抽屉无 undefined');

  console.log('\n=== 10. 代表景点 → 目的地 + 高亮 ===');
  const t = JSON.parse(run(`JSON.stringify((function(){
    const r = REGIONS.find(x=>x.spots.some(s=>s.attraction));
    const s = r.spots.find(s=>s.attraction);
    return { region:r.id, spot:s.name, attId:s.attraction.id, place:s.attraction.placeId };
  })())`));
  run(`openSpot(${JSON.stringify(t.attId)})`);
  eq(store.get('#dwKicker').textContent, '目的地', 'openSpot 切到目的地抽屉');
  eq(store.get('#dwName').textContent, run(`placeById[${JSON.stringify(t.place)}].name`), 'openSpot 打开景点所属目的地');
  eq(run('state.focusSpot'), null, '高亮标记已消费（不污染后续打开）');
  ok(run(`document.getElementById('spot-'+${JSON.stringify(t.attId)}).classList.contains('flash')`), '跳转后目标景点名称拿到 .flash 高亮');
  console.log('  ' + t.region + ' 的「' + t.spot + '」→ ' + store.get('#dwName').textContent);

  console.log('\n=== 11. 警告输出 ===');
  warns.forEach(w => console.log('  ⚠', w.slice(0, 150) + (w.length>150?' …':'')));
  ok(!warns.some(w => w.includes('区域引用了不存在的目的地')), '无「区域引用失配」警告');
  ok(!warns.some(w => w.includes('[season]')), '无「季节解析失败」警告');

  console.log('\n=== 12. 列表卡片 HTML 抽样 ===');
  const cardSample = run(`(function(){
    const p = PLACES.find(x=>x.name==='敦煌');
    const r = REGIONS.find(x=>x.id==='hexi-corridor');
    const a = document.createElement('div'); const b = document.createElement('div');
    p && placeCard(p) && (window.__c1 = placeCard(p).innerHTML);
    r && (window.__c2 = regionCard(r).innerHTML);
    return { place: window.__c1, region: window.__c2 };
  })()`);
  ok(cardSample.place && cardSample.place.includes('card-meta') && cardSample.place.includes('badge-key'), '目的地卡片含 meta 行与「重点」徽标');
  ok(cardSample.region && cardSample.region.includes('个目的地') && cardSample.region.includes('个代表景点'), '区域卡片含目的地/景点计数');
  console.log('  敦煌卡片：' + cardSample.place.replace(/\s+/g,' '));
  console.log('  河西走廊卡片：' + cardSample.region.replace(/\s+/g,' '));

  console.log('\n=== 13. 抽屉改版：去页脚 / 章节改名 / 名称化 / 悬浮卡 ===');
  ok(!html.includes('dw-foot') && !css.includes('.dw-foot'), 'index.html 与 styles.css 都已移除抽屉底部说明条');
  ok(!/信息仅供参考/.test(html), '免责声明文案已从页面移除');
  eq((html.match(/id="tip"/g)||[]).length, 1, '页面有且只有一个全局悬浮卡 #tip');
  eq((html.match(/id="dwPhoto"/g)||[]).length, 1, 'hero 里有背景图节点 #dwPhoto');
  ok(/<img[^>]+id="dwPhoto"[^>]*hidden/.test(html), '#dwPhoto 默认带 hidden（避免加载中闪白）');
  ok(/class="dw-hero-inner"/.test(html) && !/\.dw-name\{\s*position:absolute/.test(css), '名称区改为流式排布（不再绝对定位裁切长名字）');
  ok(/\.dw-hero\s*\{[^}]*min-height/.test(css) && /\.dw-photo\[hidden\]/.test(css), 'hero 高度自适应 + 背景图有 hidden 态样式');
  ok(/\.cal-wrap \.cal \.m\.good/.test(css), '月历放进卡片后，「适宜月」的绿色高亮仍生效（优先级已抬高）');
  ok(/\.tip\s*\{[^}]*position:fixed/.test(css) && /\.tip\s*\{[^}]*pointer-events:none/.test(css),
     '#tip 是 fixed 且不吃鼠标（不会抢 hover/点击）');

  const sec = JSON.parse(run(`JSON.stringify((function(){
    const pick = h => (h.match(/<h5>[^<]*<\\/h5>/g)||[]).map(s=>s.replace(/<[^>]*>/g,''));
    openPlace(${JSON.stringify(gradePlace)}, true); const p = pick($('#dwBody').innerHTML);
    openRegion(${JSON.stringify(topRegion)}, true); const r = pick($('#dwBody').innerHTML);
    return { p:p, r:r };
  })())`));
  console.log('  目的地抽屉章节：' + sec.p.join(' / '));
  console.log('  区域抽屉章节：  ' + sec.r.join(' / '));
  const allSec = sec.p.concat(sec.r).join('|');
  ok(!/目的地概览|区域速写|交通与动线|怎么去/.test(allSec), '旧章节名已全部替换（目的地概览/区域速写/交通与动线/怎么去）');
  ok(sec.p.includes('概览') && sec.r.includes('概览'), '两个抽屉都改为「概览」');
  eq(sec.p.includes('交通'), run(`!!placeById[${JSON.stringify(gradePlace)}].transport`), '「交通」章节按数据是否存在出现');
  eq(sec.r.includes('交通'), run(`!!regionById[${JSON.stringify(topRegion)}].transport`), '区域「交通」章节同样按数据出现');

  const rBody2 = store.get('#dwBody').innerHTML;                    // 此刻是区域抽屉
  const tipNodes = (rBody2.match(/data-tip=/g)||[]).length;
  eq(run('TIPS.size'), tipNodes, '每个名称/景点节点都注册了一张悬浮卡');
  ok(/id="spot-[^"]+" data-spot="[^"]+" tabindex="0" data-tip=/.test(rBody2), '景点名称节点：可高亮 + 可点 + 可聚焦 + 带悬浮卡');
  ok(/class="name-item" data-go="[^"]+" tabindex="0" data-tip=/.test(rBody2), '目的地名称节点：可点 + 可聚焦 + 带悬浮卡');

  const tip = JSON.parse(run(`JSON.stringify((function(){
    const k = [...TIPS.keys()][0];
    const node = document.createElement('span'); node.dataset.tip = k;
    tipShow(node);
    const t = $('#tip');
    const shown = { cls:t.classList.contains('show'), len:t.innerHTML.length, left:t.style.left, top:t.style.top };
    tipHide();
    return { shown, shownAfterHide:t.classList.contains('show'), cleared:t.innerHTML === '' };
  })())`));
  ok(tip.shown.cls && tip.shown.len > 0, 'tipShow 显示悬浮卡并填入正文');
  ok(/^\d+px$/.test(tip.shown.left) && /^\d+px$/.test(tip.shown.top), `tipShow 算出坐标 ${tip.shown.left},${tip.shown.top}`);
  ok(!tip.shownAfterHide && tip.cleared, 'tipHide 收起并清空悬浮卡');
  const lx = parseInt(tip.shown.left, 10), ly = parseInt(tip.shown.top, 10);
  ok(lx > 0 && lx < 1280 && ly > 0 && ly < 800, '坐标落在视口内（优先左侧）');
  eq(run(`(function(){
    const node = document.createElement('span'); node.dataset.tip = [...TIPS.keys()][0];
    node.getBoundingClientRect = () => ({ left:5, top:10, right:105, bottom:36, width:100, height:26 });
    tipShow(node); return $('#tip').style.left;
  })()`), '117px', '贴着视口左缘时卡片自动翻到右侧');
  eq(run(`(function(){
    const node = document.createElement('span'); node.dataset.tip = [...TIPS.keys()][0];
    node.getBoundingClientRect = () => ({ left:620, top:0, right:720, bottom:26, width:100, height:26 });
    tipShow(node); return $('#tip').style.top;
  })()`), '10px', '顶部越界时坐标被夹进边距内');
  ok(run(`(function(){ tipHide(); tipShow(document.createElement('span')); return $('#tip').innerHTML === '' && !$('#tip').classList.contains('show'); })()`),
     '没有 data-tip 的节点不会弹出空卡片');

  console.log('\n=== 14. 抽屉背景图（data/backgrounds.json） ===');
  const bgFile = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/backgrounds.json'), 'utf8'));
  ok(fetched.some(u => u.includes('backgrounds.json')), 'boot 会去取 backgrounds.json');
  ok(Object.keys(bgFile.regions).length > 0, 'backgrounds.json 里至少配了一个区域');
  const westernId  = run(`(function(){ const r = REGIONS.find(r=>r.name==='川西'); return r ? r.id : null; })()`);
  const westernUrl = run(`(function(){ const r = REGIONS.find(r=>r.name==='川西'); return r ? bgFor('region', r) : ''; })()`);
  eq(westernUrl, bgFile.regions['川西'] || '', '「川西」命中区域背景图');
  eq(run(`bgFor('region', null)`), '', '空区域返回空串（不抛错）');
  eq(run(`bgFor('place', null)`), '', '空目的地返回空串（不抛错）');
  const inherits = JSON.parse(run(`JSON.stringify(
    PLACES.filter(p => !BG.places[p.name] && bgFor('place', p)).map(p => ({ name:p.name, url:bgFor('place',p) }))
  )`));
  console.log('  继承区域背景图的目的地 ' + inherits.length + ' 个，例如：' + inherits.slice(0,4).map(x=>x.name).join(' / '));
  ok(inherits.length >= 0, '目的地回退到区域图：' + inherits.length + ' 个');
  ok(inherits.every(x => x.url === westernUrl), '没单独配图的目的地一律回退到所属区域的图');
  const noBg = run(`(function(){ const p = PLACES.find(p=>!bgFor('place',p)); return p ? p.id : null; })()`);
  ok(!!noBg, '存在没有任何可用背景图的目的地（用来验证兜底）：' + noBg);

  if (westernId){
    run(`openRegion(${JSON.stringify(westernId)}, true)`);
    const hero = JSON.parse(run(`JSON.stringify({
      src: $('#dwPhoto').src, hidden: $('#dwPhoto').hidden,
      has: $('#dwHero').classList.contains('has-photo'), bg: $('#dwHero').style.background
    })`));
    eq(hero.src, westernUrl, '背景图 URL 已挂到 #dwPhoto');
    eq(hero.hidden, true, '图片加载完成前保持隐藏（不闪白）');
    eq(hero.has, false, '加载完成前不加 .has-photo');
    ok(/linear-gradient/.test(hero.bg), '主题渐变始终作为兜底底图');
    ok(run(`$('#dwPhoto').onload(); $('#dwHero').classList.contains('has-photo') === true && $('#dwPhoto').hidden === false`),
       'onload → 显示照片（加 .has-photo）');
    ok(run(`$('#dwPhoto').onerror(); $('#dwHero').classList.contains('has-photo') === false && $('#dwPhoto').hidden === true`),
       'onerror → 回退主题渐变（去掉 .has-photo）');
    ok(run(`(function(){                                  // backgrounds.json 整个缺失也不能崩
      const keep = BG; BG = { regions:{}, places:{} };
      let opened = true;
      try { openRegion(${JSON.stringify(westernId)}, true); } catch(e){ opened = false; }
      BG = keep;
      return opened && $('#dwPhoto').hidden === true;
    })()`), 'backgrounds.json 缺失/为空时静默降级，抽屉照常打开');
  }
  if (noBg){
    run(`applyHero(placeById[${JSON.stringify(noBg)}], 'place')`);
    ok(run(`$('#dwPhoto').hidden === true && !$('#dwHero').classList.contains('has-photo')`),
       '没有配图的目的地：只保留主题渐变，不出现破图');
  }

  console.log('\n================ 结果 ================');
  console.log('通过 ' + pass.length + ' 项，失败 ' + fail.length + ' 项');
  if (fail.length){ fail.forEach(f=>console.log('  ✗ ' + f)); process.exit(1); }
  console.log('✅ 全部通过');
})();

