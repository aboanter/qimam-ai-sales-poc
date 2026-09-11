'use strict';
const assert=require('assert');
const {PRESENTATION_SYSTEM,parseJsonPrefix,isPresentationBody,extractEnvelope}=require('../presentation-v4-envelope');

const plan={operations:[{name:'monthly_sales',arguments:{model:'sale.order'}}]};
const results={monthly_sales:{rows:[{'date_order:month':'2025-06-01 00:00:00','amount_total:sum':100}]}};
const content=[
  'prefix ignored',
  'Original question:\nأعطني تقرير مبيعات 2025',
  '\n\nExecuted Odoo MCP plan:\n'+JSON.stringify(plan),
  '\n\nLIVE factual Odoo results:\n'+JSON.stringify(results),
  '\n\nANALYST V3.2 — AUTHORITATIVE SEMANTIC ANALYSIS WITH DETERMINISTIC MATH:\nPeak is June.'
].join('');
const body={system:PRESENTATION_SYSTEM,messages:[{role:'user',content}]};
assert.strictEqual(isPresentationBody(body),true);
const env=extractEnvelope(body);
assert.ok(env);
assert.strictEqual(env.question,'أعطني تقرير مبيعات 2025');
assert.strictEqual(env.plan.operations[0].name,'monthly_sales');
assert.strictEqual(env.results.monthly_sales.rows[0]['amount_total:sum'],100);
assert.ok(env.analystSummary.includes('Peak is June.'));
assert.deepStrictEqual(parseJsonPrefix('  {"x":1}\nTRAILING'),{x:1});
assert.strictEqual(extractEnvelope({system:'wrong',messages:[]}),null);
assert.strictEqual(extractEnvelope({system:PRESENTATION_SYSTEM,messages:[{content:'bad'}]}),null);
console.log('presentation-v4-envelope tests: OK');
