'use strict';
const assert=require('assert');
const {runShadow}=require('../presentation-v4-shadow');

(async()=>{
  const plan={operations:[
    {name:'overall_kpis_2025',arguments:{model:'sale.order'}},
    {name:'monthly_trend_2025',arguments:{model:'sale.order',groupby:['date_order:month']}},
    {name:'top_customers_2025',arguments:{model:'sale.order',groupby:['partner_id']}},
    {name:'invoice_status_summary_2025',arguments:{model:'sale.order',groupby:['invoice_status']}}
  ]};
  const results={
    overall_kpis_2025:{rows:[{'amount_total:sum':3206106.07,'__count':229}]},
    monthly_trend_2025:{rows:[
      {'date_order:month':'2025-06-01 00:00:00','amount_total:sum':2946034.3,'__count':95},
      {'date_order:month':'2025-07-01 00:00:00','amount_total:sum':340.4,'__count':2},
      {'date_order:month':'2025-08-01 00:00:00','amount_total:sum':26459.2,'__count':20},
      {'date_order:month':'2025-09-01 00:00:00','amount_total:sum':5349.07,'__count':12},
      {'date_order:month':'2025-10-01 00:00:00','amount_total:sum':225316.05,'__count':75}
    ]},
    top_customers_2025:{rows:[
      {partner_id:[1,'مؤسسة احمد سالم عمر'],'amount_total:sum':2905971.6,'__count':28},
      {partner_id:[2,'خالد مبارك'],'amount_total:sum':230529.02,'__count':70},
      {partner_id:[3,'عميل نقدي - شركة قمم'],'amount_total:sum':38788.65,'__count':91}
    ]},
    invoice_status_summary_2025:{rows:[
      {invoice_status:'to invoice','amount_total:sum':3000000},
      {invoice_status:'to invoice','amount_total:sum':171269.77},
      {invoice_status:'invoiced','amount_total:sum':34836.3}
    ]}
  };
  let prompt='';
  const manifest={
    title:'لوحة المبيعات التنفيذية 2025',
    sections:[
      {id:'overview',layout:'grid',presentation:'hero',components:[
        {type:'kpi',title:'إجمالي المبيعات',dataset:'overall_kpis_2025',field:'amount_total:sum',aggregate:'sum',format:'currency',currencyLabel:'ر.س'},
        {type:'kpi',title:'عدد الطلبات',dataset:'overall_kpis_2025',field:'__count',aggregate:'sum'}
      ]},
      {id:'trend',layout:'wide',components:[
        {type:'area_chart',title:'الاتجاه الشهري',dataset:'monthly_trend_2025',labelField:'date_order:month',valueField:'amount_total:sum',sort:'asc',sortField:'date_order:month'}
      ]},
      {id:'customers',layout:'split',components:[
        {type:'bar_chart',title:'أعلى العملاء',dataset:'top_customers_2025',labelField:'partner_id',valueField:'amount_total:sum',sort:'desc',sortField:'amount_total:sum',limit:10},
        {type:'pie_chart',title:'حالة الفوترة',dataset:'invoice_status_summary_2025',labelField:'invoice_status',valueField:'amount_total:sum',aggregateByLabel:true,sort:'desc'}
      ]},
      {id:'detail',layout:'wide',components:[
        {type:'table',title:'تفاصيل العملاء',dataset:'top_customers_2025',columns:[{field:'partner_id',title:'العميل'},{field:'amount_total:sum',title:'المبيعات'},{field:'__count',title:'الطلبات'}],sort:'desc',sortField:'amount_total:sum'}
      ]}
    ]
  };
  const out=await runShadow({
    question:'أعطني Executive Dashboard لعام 2025 واختر التصميم الأنسب للبيانات',
    plan,results,
    analystSummary:'تركيز مرتفع لدى أكبر عميل، والاتجاه الشهري يحتوي قمة واضحة.',
    artDirector:async({prompt:p})=>{prompt=p;return manifest;}
  });
  assert.strictEqual(out.ok,true);
  assert.strictEqual(out.presentation.components.length,6);
  assert.strictEqual(out.presentation.components[0].value,3206106.07);
  assert.strictEqual(out.presentation.components[1].value,229);
  assert.deepStrictEqual(out.presentation.components[2].series[0].data,[2946034.3,340.4,26459.2,5349.07,225316.05]);
  assert.deepStrictEqual(out.presentation.components[3].categories,['مؤسسة احمد سالم عمر','خالد مبارك','عميل نقدي - شركة قمم']);
  assert.deepStrictEqual(out.presentation.components[4].categories,['to invoice','invoiced']);
  assert.deepStrictEqual(out.presentation.components[4].series[0].data,[3171269.77,34836.3]);
  assert.deepStrictEqual(out.presentation.components[5].rows[0],['مؤسسة احمد سالم عمر',2905971.6,28]);
  assert.ok(!prompt.includes('3206106.07'),'Art Director prompt must not serialize KPI fact');
  assert.ok(!prompt.includes('2946034.3'),'Art Director prompt must not serialize chart facts');
  assert.ok(prompt.includes('invoice_status'),'catalog must still expose semantic field names');
  assert.ok(prompt.includes('to invoice')&&prompt.includes('invoiced'),'low-cardinality category labels may be exposed for visual choice');
  assert.ok(out.promptSize.estimatedTokens<2200,`prompt too large: ${out.promptSize.estimatedTokens}`);
  console.log('presentation-v4-acceptance tests: OK');
})().catch(e=>{console.error(e);process.exit(1)});
