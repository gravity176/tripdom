# Domestic trip advisor website

## 主要功能
- 按照地区/省份/旅游区域/目的地/景点，筛选具体目的地和出游时间
- 根据出行时间/主题，筛选目的地
- 了解目的地和景点的客观推荐信息

## 数据：源分片 → 构建 → 运行文件

页面与测试只读 `data/` 里的整文件；**手工编辑在 `src/`（按省份分片）**，改完跑一次构建合并回去。

```
src/  （你编辑这里）                                   data/  （页面 / 测试直读）
├── manifest.json   分片清单（每层 → 有序的 shards）    ├── general.json          手工维护
├── meta/           各层 meta                          ├── provinceRegions.json  ┐
│   ├── regions.json                                   ├── places.json          ├ 由 src/ 构建生成
│   ├── places.json                                    ├── attractions.json     ┘
│   └── attractions.json                               └── backgrounds.json      手工维护
├── regions/sichuan.json       ← 川西 + 川北
├── places/sichuan.json        ← 甘孜州、阿坝州…
└── attractions/sichuan.json   ← 九寨沟、四姑娘山…
```

分片按**省份**（拼音 slug：`sichuan`、`shanxi`＝山西、`shaanxi`＝陕西）归档：

- `regions/<省>.json`：该省的全部旅游区域（一个省可有多个区域，如四川含川西 + 川北）。
- `places/<省>.json`：该省的全部目的地。
- `attractions/<省>.json`：按景点所属目的地的省份归档；未匹配到目的地的放 `attractions/_orphan.json`。

### 命令

```bash
node build/build.js     # 校验 src/ 并生成 data/ 三个文件（改完数据必跑）
node build/split.js     # 一次性：把 data/ 三个整文件重新拆成 src/ 分片（会覆盖 src/，需加 --force）
```

### 构建做了什么

- 按 `src/manifest.json` 里各层的 `shards` 顺序读入分片并合并成数组。
- **校验**：id 唯一、`place.province` 在 general.json、`themes` 在词表、`region.places[]` 与 `attraction.placeId` 有主。**有错误则不写 `data/`**（退出码 1），避免半成品覆盖。
- **展示顺序**默认沿用上一次 `data/*.json` 的顺序（新增记录自动排到末尾）；要显式排序，可在 manifest 某层加 `"order": ["id1", "id2", …]`。
- `general.json`、`backgrounds.json` 不参与构建，仍是 `data/` 下的手工文件。

### 更新某地区（例：川西 / 川北）

1. 编辑 `src/regions/sichuan.json`、`src/places/sichuan.json`、`src/attractions/sichuan.json`。
2. `node build/build.js`
3. `node tests/smoke.js`（可选，回归）

新增省份：在对应目录新建 `<slug>.json`，并把文件名加进 `src/manifest.json` 的 `shards`。

## 三层数据与关联字段

```
① 旅游区域   34 条    provinceRegions.json    （region.places[] → place.name，可多对多）
       ▼
② 目的地    147 条    places.json             （attraction.placeId → place.id）
       ▼
③ 景点     352 条    attractions.json
```

<details>
<summary>字段说明（与各文件 meta 一致）</summary>

- 区域：`id / name / province[] / places[]（名称）/ themes[] / summary / bestSeason / attractionSpots[]（名称）/ transport`
- 目的地：`id / name / province / coord / key / themes[] / summary / bestSeason / transport`
- 景点：`id / name / placeId / summary / bestSeason / grade?`

</details>

