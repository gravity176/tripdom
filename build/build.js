'use strict';
/* ============================================================
   途迹 · build/build
   ------------------------------------------------------------
   读取 src/（meta + 各国省份分片）→ 校验 → 合并 → 写出 data/ 三个整文件。
   页面与测试仍只读 data/*.json，无需改动。

     src/meta/regions.json      + src/regions/*.json      ──▶  data/provinceRegions.json
     src/meta/places.json       + src/places/*.json       ──▶  data/places.json
     src/meta/attractions.json  + src/attractions/*.json  ──▶  data/attractions.json

   用法：node build/build.js
   退出码：校验出现「错误」时非 0（警告不影响输出）。

   展示顺序：默认沿用上一次 data/<file> 里的数组顺序（新增记录排到最后，不影响既有
   顺序）；若 manifest 某层提供了 "order": [id...]，则优先按它排序。
   ============================================================ */

const fs = require('fs');
const path = require('path');
const { normProv } = require('./province-slugs');

const ROOT = path.resolve(__dirname, '..');
const SRC  = path.join(ROOT, 'src');
const DATA = path.join(ROOT, 'data');

const readJsonAbs = abs => JSON.parse(fs.readFileSync(abs, 'utf8'));
const readSrc = rel => readJsonAbs(path.join(SRC, rel));
const writeJson = (abs, obj) => {
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, JSON.stringify(obj, null, 2) + '\n', 'utf8');
};
const tryReadJson = abs => { try { return readJsonAbs(abs); } catch (e) { return null; } };

const errors = [];
const warnings = [];
const err  = m => errors.push(m);
const warn = m => warnings.push(m);

/* ---------- 读取 manifest ---------- */
let manifest;
try {
  manifest = readSrc('manifest.json');
} catch (e) {
  console.error('✖ 读不到 src/manifest.json：' + e.message);
  process.exit(1);
}

/* ---------- general.json：省份 / 主题词表（用于校验，缺失则跳过对应校验） ---------- */
const general = tryReadJson(path.join(DATA, 'general.json'));
const knownProvinces = general ? new Set((general.provinces || []).map(p => normProv(p.name))) : null;
const knownThemes    = general ? new Set((general.themes || []).map(t => t.id)) : null;
if (!general) warn('data/general.json 未读到，跳过省份 / 主题词表校验');

/* ---------- 合并某一层：按 shards 顺序拼接，并做 id 唯一性检查 ---------- */
function mergeLayer(name, layer){
  const key = layer.key;
  const records = [];
  (layer.shards || []).forEach(rel => {
    const abs = path.join(SRC, rel);
    if (!fs.existsSync(abs)){ err('分片不存在：src/' + rel + '（layer=' + name + '）'); return; }
    let data;
    try { data = readJsonAbs(abs); }
    catch (e){ err('分片 JSON 解析失败：src/' + rel + ' → ' + e.message); return; }
    if (!Array.isArray(data[key])){ err('分片缺少数组字段 "' + key + '"：src/' + rel); return; }
    data[key].forEach(r => records.push(r));
  });

  const seen = new Set();
  records.forEach(r => {
    if (!r || typeof r.id !== 'string' || !r.id) { err('layer=' + name + ' 存在缺少 id 的记录'); return; }
    if (seen.has(r.id)) err('layer=' + name + ' id 重复：' + r.id);
    else seen.add(r.id);
  });
  return records;
}

const layers = manifest.layers || {};
['regions', 'places', 'attractions'].forEach(n => { if (!layers[n]) err('manifest 缺少层：' + n); });
if (errors.length){ flush(null); process.exit(1); }

const regionRecords = mergeLayer('regions',     layers.regions);
const placeRecords  = mergeLayer('places',      layers.places);
const attrRecords   = mergeLayer('attractions', layers.attractions);

const placeIds   = new Set(placeRecords.map(p => p.id));
const placeNames = new Set(placeRecords.map(p => p.name));

/* ---------- 字段级校验 ---------- */
const provOf = p => (Array.isArray(p.province) ? p.province[0] : p.province);

placeRecords.forEach(p => {
  if (knownProvinces && !knownProvinces.has(normProv(provOf(p))))         warn('places: ' + p.id + ' 省份不在 general.json：' + provOf(p));
  (p.themes || []).forEach(t => { if (knownThemes && !knownThemes.has(t)) warn('places: ' + p.id + ' 主题不在词表：' + t); });
});
regionRecords.forEach(r => {
  if (knownProvinces) (r.province || []).forEach(pv => { if (!knownProvinces.has(normProv(pv))) warn('regions: ' + r.id + ' 省份不在 general.json：' + pv); });
  (r.themes || []).forEach(t => { if (knownThemes && !knownThemes.has(t)) warn('regions: ' + r.id + ' 主题不在词表：' + t); });
  (r.places || []).forEach(n => { if (!placeNames.has(n))                 warn('regions: ' + r.id + ' 引用了不存在的目的地：' + n); });
});
attrRecords.forEach(a => {
  if (!placeIds.has(a.placeId)) warn('attractions: ' + a.id + ' 的 placeId 未匹配到目的地：' + a.placeId);
});

/* ---------- 排序：manifest.order > 上一次输出顺序 > 分片顺序 ---------- */
function orderRecords(records, layer){
  const explicit = Array.isArray(layer.order) ? layer.order : null;
  const prevFile = tryReadJson(path.join(DATA, layer.out));
  const prev = prevFile && Array.isArray(prevFile[layer.key]) ? prevFile[layer.key].map(x => x.id) : [];
  const preferred = explicit || prev;
  const byId = new Map(records.map(r => [r.id, r]));
  const out = [];
  const used = new Set();
  preferred.forEach(id => { if (byId.has(id) && !used.has(id)){ out.push(byId.get(id)); used.add(id); } });
  const appended = records.filter(r => !used.has(r.id));
  appended.forEach(r => out.push(r));
  return {
    ordered: out,
    appended: appended.map(r => r.id),
    source: explicit ? 'manifest.order' : (prev.length ? '上次输出' : '分片顺序'),
  };
}

const results = {};
[['regions', regionRecords], ['places', placeRecords], ['attractions', attrRecords]].forEach(([name, recs]) => {
  const layer = layers[name];
  const { ordered, appended, source } = orderRecords(recs, layer);
  if (appended.length) warn('layer=' + name + ' 有 ' + appended.length + ' 条不在既有顺序里，已追加到末尾：'
    + appended.slice(0, 8).join(', ') + (appended.length > 8 ? ' …' : ''));
  results[name] = { layer, records: ordered, source };
});

/* ---------- 写文件（有错误则不写，避免半成品覆盖 data/） ---------- */
if (errors.length){
  flush(null);
  console.error('\n✖ 存在 ' + errors.length + ' 个错误，已跳过写出 data/。');
  process.exit(1);
}

Object.values(results).forEach(({ layer, records }) => {
  let meta = {};
  try { meta = readSrc(layer.meta); }
  catch (e){ warn('读不到 meta：src/' + layer.meta + '（输出 meta 置空）→ ' + e.message); }
  const out = { meta: meta };
  out[layer.key] = records;
  writeJson(path.join(DATA, layer.out), out);
});

flush(results);

/* ---------- 输出汇总 ---------- */
function flush(res){
  console.log('=== build · 途迹数据 ===');
  if (res){
    ['regions', 'places', 'attractions'].forEach(n => {
      const { layer, records, source } = res[n];
      console.log('  ' + n.padEnd(11) + String(records.length).padStart(4) + ' 条  →  data/' + layer.out + '  (顺序来源：' + source + ')');
    });
  }
  if (warnings.length){
    console.log('\n⚠ ' + warnings.length + ' 个警告：');
    warnings.forEach(w => console.log('  - ' + w));
  }
  if (errors.length){
    console.log('\n✖ ' + errors.length + ' 个错误：');
    errors.forEach(e => console.log('  - ' + e));
  }
  if (res && !warnings.length && !errors.length) console.log('\n✓ 校验通过，data/ 已更新。');
}

