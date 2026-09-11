'use strict';
const assert=require('assert');
const {buildPresentation,validateManifest,normalizeIcon,displayCategory,skewHint}=require('../presentation-v4-core');

const datasets={
  sales_summary:{rows:[{'amount_total:sum':3206106.07,'__count':229}]},
  monthly_sales:{rows:[
    {'date_order:month':'2025-06-01 00:00:00','amount_total:sum':2946034.3},
    {'date_order:month':'2025-07-01 00:00:00','amount_total:sum':340.4},
    {'date_order:month':'2025-08-01 00:00:00','amount_total:sum':26459.2}
  ]},
  top_customers:{rows:[
    {partner_id:[1,'مؤسسة احمد سالم عمر'],'amount_total:sum':2905971.6,'__count':28},
    {partner_id:[2,'خالد مبارك'],'amount_total:sum':230529.02,'__count':70}
  ]},
  invoice_status:{rows:[
    {invoice_status:'to invoice','amount_total:sum':3000000},
    {invoice_status:'to invoice','amount_total:sum':171269.77},
    {invoice_status:'invoiced','amount_total:sum':34836.3}
  ]}
};

const manifest={
  title:'اختبار V4',
  summary:'Manifest صغير؛ البيانات تُحقن محلياً.',
  designSystem:{fontFamily:'Tajawal, sans-serif'},
  sections:[
    {id:'overview',layout:'grid',presentation:'hero',components:[
      {type:'kpi',title:'إجمالي المبيعات',dataset:'sales_summary',field:'amount_total:sum',aggregate:'sum',format:'currency',currencyLabel:'ر.س',icon:'trending-up'},
      {type:'kpi',title:'عدد الطلبات',dataset:'sales_summary',field:'__count',aggregate:'sum',icon:'shopping-cart'}
    ]},
    {id:'trend',layout:'wide',components:[
      {type:'area_chart',title:'الاتجاه الشهري',dataset:'monthly_sales',labelField:'date_order:month',valueField:'amount_total:sum',sort:'asc',sortField:'date_order:month'}
    ]},
    {id:'customers',layout:'split',components:[
      {type:'bar_chart',title:'أعلى العملاء',dataset:'top_customers',labelField:'partner_id',valueField:'amount_total:sum',sort:'desc',sortField:'amount_total:sum',limit:10},
      {type:'pie_chart',title:'حالة الفوترة',dataset:'invoice_status',labelField:'invoice_status',valueField:'amount_total:sum',aggregateByLabel:true,sort:'desc'}
    ]},
    {id:'detail',layout:'wide',components:[
      {type:'table',title:'تفاصيل العملاء',dataset:'top_customers',columns:[{field:'partner_id',title:'العميل'},{field:'amount_total:sum',title:'المبيعات'},{field:'__count',title:'عدد الطلبات'}],sort:'desc',sortField:'amount_total:sum'}
    ]}
  ]
};

const check=validateManifest(manifest,datasets);
assert.strictEqual(check.ok,true,check.errors.join('\n'));
const ui=buildPresentation(manifest,datasets);
assert.strictEqual(ui.generativeUiVersion,4);
assert.strictEqual(ui.presentationBuilderVersion,'4.0.0-alpha.4');
assert.strictEqual(ui.components.length,6);
assert.strictEqual(ui.components[0].value,3206106.07);
assert.strictEqual(ui.components[1].value,229);
assert.deepStrictEqual(ui.components[0].icon,{name:'trend'});
assert.deepStrictEqual(ui.components[1].icon,{name:'cart'});
assert.deepStrictEqual(ui.components[2].categories,['يونيو 2025','يوليو 2025','أغسطس 2025']);
assert.strictEqual(ui.components[2].componentLayout.linearScaleNote,true);
assert.strictEqual(ui.components[2].componentLayout.highlightExtremes,true);
assert.strictEqual(ui.components[2].componentLayout.highIndex,0);
assert.strictEqual(ui.components[2].componentLayout.lowIndex,1);
assert.ok(ui.components[2].componentLayout.skewRatio>100);
assert.deepStrictEqual(ui.components[3].categories,['مؤسسة احمد سالم عمر','خالد مبارك']);
assert.strictEqual(ui.components[3].componentLayout,undefined,'ranking bar should not get trend-only skew hint');
assert.deepStrictEqual(ui.components[4].categories,['to invoice','invoiced']);
assert.deepStrictEqual(ui.components[4].series[0].data,[3171269.77,34836.3]);
assert.deepStrictEqual(ui.components[5].rows[0],['مؤسسة احمد سالم عمر',2905971.6,28]);
assert.deepStrictEqual(normalizeIcon('dollar-sign'),{name:'revenue'});
assert.deepStrictEqual(normalizeIcon({name:'bar-chart',size:30}),{name:'chart',size:30});
assert.strictEqual(displayCategory('2025-12-01 00:00:00','date_order:month'),'ديسمبر 2025');
assert.strictEqual(displayCategory('مؤسسة س','partner_id'),'مؤسسة س');
assert.strictEqual(skewHint('bar_chart',[{label:'A',value:100},{label:'B',value:1},{label:'C',value:.5}]),null);

const bad={sections:[{components:[{type:'bar_chart',dataset:'missing',labelField:'x',valueField:'y'}]}]};
assert.strictEqual(validateManifest(bad,datasets).ok,false);

console.log('presentation-v4-core tests: OK');
