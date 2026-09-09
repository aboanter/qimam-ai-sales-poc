'use strict';
const assert=require('assert');
const {buildDatasetCatalog,compactCatalog}=require('../presentation-v4-catalog');
const plan={operations:[
  {name:'monthly_sales',arguments:{model:'sale.order',groupby:['date_order:month']}},
  {name:'top_customers',arguments:{model:'sale.order',groupby:['partner_id']}},
  {name:'invoice_status',arguments:{model:'sale.order',groupby:['invoice_status']}}
]};
const results={
  monthly_sales:{rows:[{'date_order:month':'2025-06-01 00:00:00','amount_total:sum':2946034.3},{'date_order:month':'2025-07-01 00:00:00','amount_total:sum':340.4}]},
  top_customers:{rows:[{partner_id:[1,'A'],'amount_total:sum':250,'__count':2}]},
  invoice_status:{rows:[{invoice_status:'to invoice','amount_total:sum':100},{invoice_status:'invoiced','amount_total:sum':50}]}
};
const {datasets,catalog}=buildDatasetCatalog(plan,results,{sampleRows:1});
assert.strictEqual(datasets.monthly_sales.rows.length,2);
assert.strictEqual(catalog.length,3);
assert.strictEqual(catalog[0].rowCount,2);
assert.strictEqual(catalog[0].groupby[0],'date_order:month');
const amount=catalog[0].fields.find(f=>f.name==='amount_total:sum');
assert.strictEqual(amount.type,'number');
assert.strictEqual(amount.numeric.sum,2946374.7);
assert.strictEqual(amount.distinctCount,2);
const partner=catalog[1].fields.find(f=>f.name==='partner_id');
assert.strictEqual(partner.type,'many2one');
assert.deepStrictEqual(partner.distinctSample,['A']);
const compact=compactCatalog(catalog);
assert.strictEqual(Object.prototype.hasOwnProperty.call(compact[0],'sample'),false);
const compactAmount=compact[0].fields.find(f=>f.name==='amount_total:sum');
assert.strictEqual(Object.prototype.hasOwnProperty.call(compactAmount,'values'),false);
assert.strictEqual(Object.prototype.hasOwnProperty.call(compactAmount,'numeric'),false);
const compactDate=compact[0].fields.find(f=>f.name==='date_order:month');
assert.strictEqual(Object.prototype.hasOwnProperty.call(compactDate,'values'),false);
const compactStatus=compact[2].fields.find(f=>f.name==='invoice_status');
assert.deepStrictEqual(compactStatus.values,['to invoice','invoiced']);
const promptJson=JSON.stringify(compact);
assert.ok(!promptJson.includes('2946034.3'),'compact catalog must not serialize numeric facts');
assert.ok(!promptJson.includes('340.4'),'compact catalog must not serialize numeric facts');
console.log('presentation-v4-catalog tests: OK');
