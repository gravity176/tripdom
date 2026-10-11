'use strict';
/* ============================================================
   途迹 · build/province-slugs
   ------------------------------------------------------------
   省份名 → 分片文件名 slug 的映射，split.js 与 build.js 共用。

   数据里省份有两种写法：
     · provinceRegions.json / general.json 用全称（如「四川省」）
     · places.json 用简称（如「四川」）
   统一先 normProv() 归一成简称，再查表拿 slug，保证同一省份落到同一个文件。

   注意「山西 / 陕西」：约定 shanxi = 山西，shaanxi = 陕西。
   ============================================================ */

/* normProv 与 js/10-data.js 中的实现保持一致（去掉 省/市/自治区/特别行政区 后缀） */
function normProv(x){
  return String(x == null ? '' : x)
    .replace(/特别行政区$/, '')
    .replace(/(壮族|维吾尔|回族|藏族)?自治区$/, '')
    .replace(/[省市]$/, '');
}

const PROVINCE_SLUG = {
  北京: 'beijing',
  天津: 'tianjin',
  河北: 'hebei',
  山西: 'shanxi',
  内蒙古: 'neimenggu',
  辽宁: 'liaoning',
  吉林: 'jilin',
  黑龙江: 'heilongjiang',
  上海: 'shanghai',
  江苏: 'jiangsu',
  浙江: 'zhejiang',
  安徽: 'anhui',
  福建: 'fujian',
  江西: 'jiangxi',
  山东: 'shandong',
  河南: 'henan',
  湖北: 'hubei',
  湖南: 'hunan',
  广东: 'guangdong',
  广西: 'guangxi',
  海南: 'hainan',
  重庆: 'chongqing',
  四川: 'sichuan',
  贵州: 'guizhou',
  云南: 'yunnan',
  西藏: 'xizang',
  陕西: 'shaanxi',
  甘肃: 'gansu',
  青海: 'qinghai',
  宁夏: 'ningxia',
  新疆: 'xinjiang',
  香港: 'hongkong',
  澳门: 'macau',
  台湾: 'taiwan',
};

/* 省份名 → slug；查不到时抛错（新增省份时在 PROVINCE_SLUG 里补一行即可） */
function provinceSlug(name){
  const n = normProv(name);
  const s = PROVINCE_SLUG[n];
  if (!s) throw new Error('未知省份，无法确定分片文件名：' + JSON.stringify(name) + '（归一化后「' + n + '」），请在 build/province-slugs.js 里补充映射');
  return s;
}

module.exports = { normProv, provinceSlug, PROVINCE_SLUG };
