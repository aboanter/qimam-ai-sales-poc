'use strict';
const assert=require('assert');
const {buildPresentation,validateManifest,computeFormula,comparisonPairs,aggregate,buildGroundedFact}=require('../presentation-v4-core');

const datasets={
  q3:{rows:[{'amount_total:sum':32148.67,'date_order:count_distinct':74}]},
  q4:{rows:[{'amount_total:sum':227923.10,'date_order:count_distinct':60}]},
  quarters:{rows:[
    {'date_order:quarter':'2025-Q3','amount_total:sum':32148.67,'date_order:count_distinct':74},
    {'date_order:quarter':'2025-Q4','amount_total:sum':227923.10,'date_order:count_distinct':60}
  ]}
};

const manifest={
  title:'Q3 vs Q4',
  sections:[
    {layout:'strip',components:[
      {type:'kpi',title:'متوسط طلب Q3',formula:{op:'divide',left:{dataset:'quarters',field:'amount_total:sum',aggregate:'first'},right:{dataset:'quarters',field:'date_order:count_distinct',aggregate:'first'}},format:'currency',currencyLabel:'ر.س'},
      {type:'kpi',title:'متوسط طلب Q4',formula:{op:'divide',left:{dataset:'quarters',field:'amount_total:sum',aggregate:'last'},right:{dataset:'quarters',field:'date_order:count_distinct',aggregate:'last'}},format:'currency',currencyLabel:'ر.س'},
      {type:'kpi',title:'نمو المبيعات',formula:{op:'percent_change',left:{dataset:'q4',field:'amount_total:sum'},right:{dataset:'q3',field:'amount_total:sum'}},format:'percent'}
    ]},
    {layout:'wide',components:[
      {type:'bar_chart',title:'مقارنة المبيعات',points:[
        {label:'Q3',dataset:'quarters',field:'amount_total:sum',aggregate:'first'},
        {label:'Q4',dataset:'quarters',field:'amount_total:sum',aggregate:'last'}
      ],seriesLabel:'المبيعات'}
    ]},
    {layout:'wide',components:[
      {type:'insight',title:'فروقات مؤكدة',facts:[
        {label:'إجمالي المبيعات',leftLabel:'Q3',rightLabel:'Q4',left:{dataset:'quarters',field:'amount_total:sum',aggregate:'first'},right:{dataset:'quarters',field:'amount_total:sum',aggregate:'last'},format:'currency',currencyLabel:'ر.س'},
        {label:'عدد الطلبات',leftLabel:'Q3',rightLabel:'Q4',left:{dataset:'quarters',field:'date_order:count_distinct',aggregate:'first'},right:{dataset:'quarters',field:'date_order:count_distinct',aggregate:'last'}}
      ]}
    ]}
  ]
};

const check=validateManifest(manifest,datasets);
assert.strictEqual(check.ok,true,check.errors.join('\n'));
const ui=buildPresentation(manifest,datasets);
assert.strictEqual(ui.presentationBuilderVersion,'4.0.0-alpha.5');
assert.ok(Math.abs(ui.components[0].value-(32148.67/74))<1e-9);
assert.ok(Math.abs(ui.components[1].value-(227923.10/60))<1e-9);
assert.ok(Math.abs(ui.components[2].value-((227923.10-32148.67)/32148.67))<1e-9);
assert.strictEqual(ui.components[0].derived,true);
assert.deepStrictEqual(ui.components[3].categories,['Q3','Q4']);
assert.deepStrictEqual(ui.components[3].series[0].data,[32148.67,227923.10]);
assert.strictEqual(ui.components[3].comparison,true);
assert.strictEqual(ui.components[4].grounded,true);
assert.strictEqual(ui.components[4].items.length,2);
assert.ok(ui.components[4].items[0].text.includes('ارتفع إجمالي المبيعات'));
assert.ok(ui.components[4].items[1].text.includes('انخفض عدد الطلبات'));
assert.ok(ui.components[4].items[1].text.includes('18.9%'));

assert.strictEqual(aggregate(datasets.quarters.rows,'amount_total:sum','first'),32148.67);
assert.strictEqual(aggregate(datasets.quarters.rows,'amount_total:sum','last'),227923.10);
assert.strictEqual(aggregate(datasets.quarters.rows,'date_order:count_distinct','last'),60);
assert.ok(Math.abs(computeFormula({op:'subtract',left:{dataset:'q4',field:'amount_total:sum'},right:{dataset:'q3',field:'amount_total:sum'}},datasets)-195774.43)<1e-9);
assert.deepStrictEqual(comparisonPairs([{label:'Q3',dataset:'quarters',field:'amount_total:sum',aggregate:'first'},{label:'Q4',dataset:'quarters',field:'amount_total:sum',aggregate:'last'}],datasets),[
  {label:'Q3',value:32148.67},{label:'Q4',value:227923.10}
]);
const grounded=buildGroundedFact({label:'عدد الطلبات',leftLabel:'Q3',rightLabel:'Q4',left:{dataset:'quarters',field:'date_order:count_distinct',aggregate:'first'},right:{dataset:'quarters',field:'date_order:count_distinct',aggregate:'last'}},datasets);
assert.ok(grounded.text.includes('انخفض عدد الطلبات'));
assert.ok(!grounded.text.includes('ارتفع عدد الطلبات'));

// Comparison points are chart-neutral: the Art Director, not the local builder,
// chooses whether the same two values are shown as bar, pie, line, etc.
const pieManifest={sections:[{components:[{type:'pie_chart',title:'حصة الربعين',points:[
  {label:'Q3',dataset:'quarters',field:'amount_total:sum',aggregate:'first'},
  {label:'Q4',dataset:'quarters',field:'amount_total:sum',aggregate:'last'}
]}]}]};
assert.strictEqual(validateManifest(pieManifest,datasets).ok,true);
const pieUi=buildPresentation(pieManifest,datasets);
assert.strictEqual(pieUi.components[0].type,'pie_chart');
assert.deepStrictEqual(pieUi.components[0].categories,['Q3','Q4']);
assert.deepStrictEqual(pieUi.components[0].series[0].data,[32148.67,227923.10]);

const badFormula={sections:[{components:[{type:'kpi',title:'x',formula:{op:'divide',left:{dataset:'missing',field:'x'},right:{dataset:'q3',field:'date_order:count_distinct'}}}]}]};
assert.strictEqual(validateManifest(badFormula,datasets).ok,false);
const badInsight={sections:[{components:[{type:'insight',facts:[{label:'x',left:{dataset:'missing',field:'x'},right:{dataset:'q4',field:'amount_total:sum'}}]}]}]};
assert.strictEqual(validateManifest(badInsight,datasets).ok,false);

console.log('presentation-v4-derived tests: OK');
