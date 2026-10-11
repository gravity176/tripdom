'use strict';
/* ============================================================
   途迹 · build/split
   ------------------------------------------------------------
   一次性 / 重新生成工具：把 data/ 里三个「整文件」数据层按省份拆成
   src/ 下的分片，并写出 src/manifest.json。

     data/provinceRegions.json  ──▶  src/meta/regions.json   + src/regions/<省>.json
     data/places.json           ──▶  src/meta/places.json    + src/places/<省>.json
     data/attractions.json      ──▶  src/meta/attractions.json + src/attractions/<省>.json

   用法：
     node build/split.js           首次拆分（src/manifest.json 已存在时会拒绝运行）
     node build/split.js --force   覆盖已有 src/（会丢弃你在 src/ 里的手工改动！）

   注意：拆完需要用 `node build/build.js` 重新生成 data/。
   ============================================================ */

const fs = require('fs');
const path = require('path');
const { provinceSlug } = require('./province-slugs');

const ROOT = path.resolve(__dirname, '..');
const DATA = path.join(ROOT, 'data');
const SRC  = path.join(ROOT, 'src');

const force = process.argv.includes('--force');
const readJson  = f => JSON.parse(fs.readFileSync(path.join(DATA, f), 'utf8'));
const writeJson = (p, obj) => {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(obj, null, 2) + '\n', 'utf8');
};

if (fs.existsSync(path.join(SRC, 'manifest.json')) && !force){
  console.error('✖ src/manifest.json 已存在。直接重跑会覆盖你在 src/ 里的手工改动。');
  console.error('  确认要「从 data/ 重新拆分」请加 --force：node build/split.js --force');
  process.exit(1);
}

const regions = readJson('provinceRegions.json');
const places  = readJson('places.json');
const atts    = readJson('attractions.json');

const placeById = Object.fromEntries(places.places.map(p => [p.id, p]));
const provinceOfPlace = p => (Array.isArray(p.province) ? p.province[0] : p.province);

/* 按 slug 分组，保留 slug 首次出现的顺序，供 manifest 里排定分片顺序 */
function groupBySlug(items, slugOf){
  const order = [];
  const buckets = new Map();
  for (const it of items){
    const s = slugOf(it);
    if (!buckets.has(s)){ buckets.set(s, []); order.push(s); }
    buckets.get(s).push(it);
  }
  return { order, buckets };
}

const rGroups = groupBySlug(regions.provinceRegions, r => provinceSlug((r.province || [])[0]));
const pGroups = groupBySlug(places.places, p => provinceSlug(provinceOfPlace(p)));

const orphanIds = [];
const aGroups = groupBySlug(atts.attractions, a => {
  const p = placeById[a.placeId];
  if (!p){ orphanIds.push(a.id); return '_orphan'; }
  return provinceSlug(provinceOfPlace(p));
});

/* 未匹配到目的地的景点统一放 _orphan.json，且排在最后 */
const aOrder = aGroups.order.filter(s => s !== '_orphan');
if (aGroups.buckets.has('_orphan')) aOrder.push('_orphan');

/* ---------- 写 meta ---------- */
writeJson(path.join(SRC, 'meta', 'regions.json'),     regions.meta);
writeJson(path.join(SRC, 'meta', 'places.json'),      places.meta);
writeJson(path.join(SRC, 'meta', 'attractions.json'), atts.meta);

/* ---------- 写分片 ---------- */
function writeShards(layer, order, buckets, key){
  order.forEach(slug => writeJson(
    path.join(SRC, layer, slug + '.json'),
    { [key]: buckets.get(slug) }
  ));
}

writeShards('regions',     rGroups.order, rGroups.buckets, 'provinceRegions');
writeShards('places',      pGroups.order, pGroups.buckets, 'places');
writeShards('attractions', aOrder,        aGroups.buckets, 'attractions');

/* ---------- 写 manifest ---------- */
const manifest = {
  version: 1,
  note: '分片清单。build/build.js 按 layers.*.shards 的顺序读取分片并合并。'
      + '新增省份/区域时：在对应目录新建 <省slug>.json，并把文件名加进这里的 shards。'
      + '输出数组的展示顺序默认沿用上一次 data/*.json 的顺序（新增项排到最后）；'
      + '若要显式指定顺序，可在某层加 "order": ["id1","id2",...]。',
  layers: {
    regions: {
      out: 'provinceRegions.json',
      key: 'provinceRegions',
      meta: 'meta/regions.json',
      shards: rGroups.order.map(s => 'regions/' + s + '.json'),
    },
    places: {
      out: 'places.json',
      key: 'places',
      meta: 'meta/places.json',
      shards: pGroups.order.map(s => 'places/' + s + '.json'),
    },
    attractions: {
      out: 'attractions.json',
      key: 'attractions',
      meta: 'meta/attractions.json',
      shards: aOrder.map(s => 'attractions/' + s + '.json'),
    },
  },
};
writeJson(path.join(SRC, 'manifest.json'), manifest);

/* ---------- 汇总 ---------- */
console.log('✓ 已拆分 src/');
console.log('  区域   ' + regions.provinceRegions.length + ' 条 → ' + rGroups.order.length + ' 个省份分片');
console.log('  目的地 ' + places.places.length + ' 条 → ' + pGroups.order.length + ' 个省份分片');
console.log('  景点   ' + atts.attractions.length + ' 条 → ' + aOrder.length + ' 个分片'
  + (orphanIds.length ? '（含 _orphan ' + orphanIds.length + ' 条：' + orphanIds.join(', ') + '）' : ''));
console.log('  下一步：node build/build.js  重新生成 data/');
