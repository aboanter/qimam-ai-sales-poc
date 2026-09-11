'use strict';
const assert=require('assert');
const {buildPresentation,validateManifest,computeFormula,comparisonPairs}=require('../presentation-v4-core');

const datasets={
  q3:{rows:[{'amount_total:sum':32148.67,'date_order:count_distinct':74}]},
  q4:{rows:[{'amount_total:sum':227923.10,'date_order:count_distinct':60}]}
};

const manifest={
  title:'Q3 vs Q4',
  sections:[
    {layout:'strip',components:[
      {type:'kpi',title:'متوسط طلب Q3',formula:{op:'divide',left:{dataset:'q3',field:'amount_total:sum'},right:{dataset:'q3',field:'date_order:count_distinct'}},format:'currency',currencyLabel:'ر.س'},
      {type:'kpi',title:'متوسط طلب Q4',formula:{op:'divide',left:{dataset:'q4',field:'amount_total:sum'},right:{dataset:'q4',field:'date_order:count_distinct'}},format:'currency',currencyLabel:'ر.س'},
      {type:'kpi',title:'نمو المبيعات',formula:{op:'percent_change',left:{dataset:'q4',field:'amount_total:sum'},right:{dataset:'q3',field:'amount_total:sum'}},format:'percent'}
    ]},
    {layout:'wide',components:[
      {type:'bar_chart',title:'مقارنة المبيعات',points:[
        {label:'Q3',dataset:'q3',field:'amount_total:sum'},
        {label:'Q4',dataset:'q4',field:'amount_total:sum'}
      ],seriesLabel:'المبيعات'}
    ]}
  ]
};

const check=validateManifest(manifest,datasets);
assert.strictEqual(check.ok,true,check.errors.join('\n'));
const ui=buildPresentation(manifest,datasets);
assert.strictEqual(ui.presentationBuilderVersion,'4.0.0-alpha.4');
assert.strictEqual(ui.presentationManifestVersion,'1.1');
assert.ok(Math.abs(ui.components[0].value-(32148.67/74))<1e-9);
assert.ok(Math.abs(ui.components[1].value-(227923.10/60))<1e-9);
assert.ok(Math.abs(ui.components[2].value-((227923.10-32148.67)/32148.67))<1e-9);
assert.strictEqual(ui.components[0].derived,true);
assert.deepStrictEqual(ui.components[3].categories,['Q3','Q4']);
assert.deepStrictEqual(ui.components[3].series[0].data,[32148.67,227923.10]);
assert.strictEqual(ui.components[3].comparison,true);

assert.ok(Math.abs(computeFormula({op:'subtract',left:{dataset:'q4',field:'amount_total:sum'},right:{dataset:'q3',field:'amount_total:sum'}},datasets)-195774.43)<1e-9);
assert.deepStrictEqual(comparisonPairs([{label:'Q3',dataset:'q3',field:'amount_total:sum'},{label:'Q4',dataset:'q4',field:'amount_total:sum'}],datasets),[
  {label:'Q3',value:32148.67},{label:'Q4',value:227923.10}
]);

const badFormula={sections:[{components:[{type:'kpi',title:'x',formula:{op:'divide',left:{dataset:'missing',field:'x'},right:{dataset:'q3',field:'date_order:count_distinct'}}}]}]};
assert.strictEqual(validateManifest(badFormula,datasets).ok,false);
const badChart={sections:[{components:[{type:'line_chart',title:'x',points:[{label:'Q3',dataset:'q3',field:'amount_total:sum'}]}]}]};
assert.strictEqual(validateManifest(badChart,datasets).ok,false);

console.log('presentation-v4-derived tests: OK');
