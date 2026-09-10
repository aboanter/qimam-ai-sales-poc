'use strict';
const assert=require('assert');
const {normalizeVisiblePresentation,temporalKey,formatTemporal,normalizeIcon}=require('../presentation-v4-visible-normalize');

const input={
  title:'تقرير المبيعات 2025',
  components:[
    {type:'kpi',title:'إجمالي المبيعات',format:'currency',currencyLabel:'SAR',icon:'trending-up',value:100},
    {type:'kpi',title:'إجمالي الطلبات',icon:'shopping-cart',value:10},
    {type:'area_chart',title:'الاتجاه الشهري',categories:['2025-12-01 00:00:00','2025-06-01 00:00:00','2025-10-01 00:00:00'],series:[{name:'المبيعات',data:[44.85,2946034.3,225316.05]}]}
  ]
};
const out=normalizeVisiblePresentation(input);
assert.strictEqual(out.components[0].currencyLabel,'ر.س');
assert.deepStrictEqual(out.components[0].icon,{name:'trend'});
assert.deepStrictEqual(out.components[1].icon,{name:'cart'});
assert.deepStrictEqual(out.components[2].categories,['يونيو 2025','أكتوبر 2025','ديسمبر 2025']);
assert.deepStrictEqual(out.components[2].series[0].data,[2946034.3,225316.05,44.85]);
assert.strictEqual(out.components[2].componentLayout.linearScaleNote,true);
assert.strictEqual(out.components[2].componentLayout.highIndex,0);
assert.strictEqual(out.components[2].componentLayout.lowIndex,2);
assert.strictEqual(temporalKey('2025-06-01 00:00:00'),20250601);
assert.strictEqual(temporalKey('يونيو 2025'),20250601);
assert.strictEqual(formatTemporal('2025-12-01 00:00:00',true),'ديسمبر 2025');
assert.deepStrictEqual(normalizeIcon({name:'bar-chart',size:32}),{name:'chart',size:32});
assert.strictEqual(input.components[0].currencyLabel,'SAR','normalizer must not mutate input');
console.log('presentation-v4-visible-normalize tests: OK');
