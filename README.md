# Domestic trip advisor website

## 主要功能
- 按照地区/省份/旅游区域/目的地/景点，筛选具体目的地和出游时间
- 根据出行时间/主题，筛选目的地
- 了解目的地和景点的客观推荐信息

## 三层数据与关联字段

```
① 旅游区域   34 条    provinceRegions.json
       │   place.provinceRegionId → provinceRegion.id
       ▼
② 目的地    147 条    places.json
       │   attraction.placeId → place.id
       ▼
③ 景点      已录入    attractions.json
```
