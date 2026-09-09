'use strict';
const assert=require('assert');
const {runShadow}=require('../presentation-v4-shadow');
(async()=>{
  const plan={operations:[{name:'summary',arguments:{model:'sale.order'}},{name:'monthly',arguments:{model:'sale.order',groupby:['date_order:month']}}]};
  const results={summary:{rows:[{'amount_total:sum':300,'__count':3}]},monthly:{rows:[{'date_order:month':'2025-01-01 00:00:00','amount_total:sum':100},{'date_order:month':'2025-02-01 00:00:00','amount_total:sum':200}]}};
  let sawPrompt='';
  const out=await runShadow({question:'أعطني لوحة مختصرة بدون جداول',plan,results,analystSummary:'المبيعات ارتفعت في فبراير.',artDirector:async({prompt})=>{
    sawPrompt=prompt;
    return JSON.stringify({title:'لوحة مختصرة',sections:[{id:'k',layout:'strip',components:[{type:'kpi',title:'المبيعات',dataset:'summary',field:'amount_total:sum',format:'currency'}]},{id:'t',layout:'wide',components:[{type:'area_chart',title:'الاتجاه',dataset:'monthly',labelField:'date_order:month',valueField:'amount_total:sum',sort:'asc',sortField:'date_order:month'}]}]});
  }});
  assert.strictEqual(out.ok,true);
  assert.strictEqual(out.presentation.components.length,2);
  assert.strictEqual(out.presentation.components[0].value,300);
  assert.deepStrictEqual(out.presentation.components[1].series[0].data,[100,200]);
  assert.ok(sawPrompt.includes('بدون جداول'));
  assert.ok(sawPrompt.includes('AVAILABLE DATASETS'));
  assert.ok(out.promptSize.estimatedTokens<2000);
  const bad=await runShadow({question:'x',plan,results,artDirector:async()=>({sections:[{components:[{type:'bar_chart',dataset:'missing',labelField:'x',valueField:'y'}]}]})});
  assert.strictEqual(bad.ok,false);
  assert.strictEqual(bad.stage,'validate_manifest');
  console.log('presentation-v4-shadow tests: OK');
})().catch(e=>{console.error(e);process.exit(1)});
