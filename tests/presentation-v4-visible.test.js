'use strict';
const assert=require('assert');
const fs=require('fs');
const path=require('path');
const {buildLayoutTree,collectChartHints,buildVisiblePresentation,toStructuredAdapterUi,buildAnthropicPayload,summarize}=require('../presentation-v4-visible-response');

const shadow={
  ok:true,
  manifest:{title:'اختبار',components:[{type:'table'}]},
  promptSize:{chars:1000,estimatedTokens:250},
  llmMs:4321,
  totalMs:4330,
  presentation:{
    title:'اختبار',summary:'',generativeUiVersion:4,presentationBuilderVersion:'4.0.0-alpha.3',
    components:[
      {type:'table',title:'جدول',id:'t1',columns:['العميل','المبيعات'],rows:[['A',100],['B',50]],section:{id:'detail',layout:'stack',order:1}},
      {type:'insight',title:'ملاحظات',id:'i1',items:[{text:'ملاحظة 1'},{text:'ملاحظة 2'}],section:{id:'detail',layout:'stack',order:1}},
      {type:'area_chart',title:'اتجاه',id:'c1',categories:['يونيو 2025','يوليو 2025','أغسطس 2025'],series:[{name:'المبيعات',data:[1000,1,10]}],componentLayout:{linearScaleNote:true,highlightExtremes:true,highIndex:0,lowIndex:1,skewRatio:100},section:{id:'visual',layout:'wide',order:2}}
    ],
    designSystem:{fontFamily:'Tajawal, Arial, sans-serif'},materialization:{components:3,failures:[]}
  }
};
const usage={input_tokens:700,output_tokens:250};
const visible=buildVisiblePresentation(shadow,{usage,model:'claude-test'});
assert.strictEqual(visible.presentationV4.mode,'visible_test');
assert.strictEqual(visible.presentationV4.version,'4.0-visible-alpha.5');
assert.strictEqual(visible.presentationV4.visibleNormalizerVersion,'1.1');
assert.strictEqual(visible.presentationV4.layoutSource,'server_manifest');
assert.strictEqual(visible.presentationV4.llmMs,4321);
assert.deepStrictEqual(visible.presentationV4.summary,{components:3,types:{table:1,insight:1,area_chart:1}});
assert.strictEqual(visible.components[0].rows[0][0],'A');
assert.deepStrictEqual(visible.presentationV4.chartHints.c1,{linearScaleNote:true,highlightExtremes:true,highIndex:0,lowIndex:1,skewRatio:100});
assert.deepStrictEqual(collectChartHints(visible).c1,{linearScaleNote:true,highlightExtremes:true,highIndex:0,lowIndex:1,skewRatio:100});

const tree=buildLayoutTree(visible);
assert.strictEqual(tree.length,2);
assert.strictEqual(tree[0].children[0].type,'stack');
assert.deepStrictEqual(tree[0].children[0].children.map(x=>x.id),['t1','i1']);
assert.strictEqual(tree[1].children[0].type,'stack');

const compact=toStructuredAdapterUi(visible);
assert.strictEqual(compact.components.length,3);
assert.strictEqual(typeof compact.components[0].data,'string');
assert.deepStrictEqual(JSON.parse(compact.components[0].data).columns,['العميل','المبيعات']);
assert.deepStrictEqual(JSON.parse(compact.components[0].data).rows,[['A',100],['B',50]]);
assert.strictEqual(JSON.parse(compact.components[1].data).items.length,2);
assert.deepStrictEqual(JSON.parse(compact.components[2].data).categories,['يونيو 2025','يوليو 2025','أغسطس 2025']);
assert.deepStrictEqual(JSON.parse(compact.components[2].data).series[0].data,[1000,1,10]);
assert.strictEqual(compact.presentationV4.chartHints.c1.highIndex,0);
assert.strictEqual(compact.presentationV4.chartHints.c1.lowIndex,1);
assert.strictEqual(JSON.parse(compact.designSystem).fontFamily,'Tajawal, Arial, sans-serif');
assert.strictEqual(typeof compact.layoutTree,'string');
const compactTree=JSON.parse(compact.layoutTree);
assert.strictEqual(compactTree[0].children[0].type,'stack');
assert.deepStrictEqual(compactTree[0].children[0].children.map(x=>x.id),['t1','i1']);

const roundTrip=compact.components.map((c,i)=>({type:c.type,title:c.title,...JSON.parse(c.data),_i:i}));
assert.deepStrictEqual(roundTrip[0].columns,['العميل','المبيعات']);
assert.deepStrictEqual(roundTrip[0].rows,[['A',100],['B',50]]);
assert.deepStrictEqual(roundTrip[1].items,[{text:'ملاحظة 1'},{text:'ملاحظة 2'}]);
assert.deepStrictEqual(roundTrip[2].series,[{name:'المبيعات',data:[1000,1,10]}]);

const payload=buildAnthropicPayload(visible,{usage,model:'claude-test'});
assert.strictEqual(payload.stop_reason,'end_turn');
assert.strictEqual(payload.usage.output_tokens,250);
const parsed=JSON.parse(payload.content[0].text);
assert.strictEqual(parsed.generativeUiVersion,4);
assert.strictEqual(parsed.presentationV4.version,'4.0-visible-alpha.5');
assert.strictEqual(parsed.presentationV4.visibleNormalizerVersion,'1.1');
assert.strictEqual(parsed.presentationV4.chartHints.c1.skewRatio,100);
assert.ok(parsed.components.every(c=>typeof c.data==='string'));
assert.strictEqual(JSON.parse(parsed.layoutTree)[0].children[0].type,'stack');
assert.throws(()=>buildVisiblePresentation({ok:false}),/successful materialized presentation/i);
assert.deepStrictEqual(summarize({components:[]}),{components:0,types:{}});

const preload=fs.readFileSync(path.join(__dirname,'..','presentation-v4-visible-preload.js'),'utf8');
const installIndex=preload.indexOf('global.fetch=async function v4VisibleFetch');
const chainIndex=preload.indexOf("require('./binding-compat-preload.js')");
assert.ok(installIndex>=0&&chainIndex>installIndex,'V4 interceptor must install before V3 chain so Analyst can enrich the request');
assert.ok(preload.includes('fail-open to V3'),'visible mode must have explicit fail-open logging');
assert.ok(preload.includes('return nativeFetch(url,options)'),'visible failures must fall through to V3 Anthropic call');
assert.ok(preload.includes('/presentation-v4-visible-renderer.js'),'visible service must inject the V4-only browser layout adapter');
assert.ok(preload.includes('/presentation-v4-chart-enhancer.js'),'visible service must inject the V4-only chart enhancer');
assert.ok(preload.includes("endsWith('/public/index.html')"),'layout adapter injection must be scoped to the served index only');
assert.ok(!preload.includes("require('./presentation-v4-shadow-preload.js')"),'visible test must not recursively start shadow mode');

const renderer=fs.readFileSync(path.join(__dirname,'..','public','presentation-v4-visible-renderer.js'),'utf8');
assert.ok(renderer.includes('if(!schema?.presentationV4)return upstreamRender(schema,host)'),'browser adapter must be a no-op for V3 schemas');
assert.ok(renderer.includes('height:auto!important'),'stacked V4 items must not stretch to equal-height blank panels');
assert.ok(renderer.includes('min-width:100%!important'),'V4 tables should use the available card width before horizontal scrolling');
assert.ok(renderer.includes('refs.slice(2)'),'split layouts must preserve extra components rather than dropping them');

const chartEnhancer=fs.readFileSync(path.join(__dirname,'..','public','presentation-v4-chart-enhancer.js'),'utf8');
assert.ok(chartEnhancer.includes('if(!schema?.presentationV4||!host)return'),'chart enhancer must be V4-only');
assert.ok(chartEnhancer.includes('presentationV4?.chartHints'),'chart enhancer must read isolated V4 chart hints');
assert.ok(chartEnhancer.includes('linearScaleNote'),'chart enhancer must honor deterministic skew metadata');
assert.ok(chartEnhancer.includes('المقياس خطي'),'Arabic scale note must disclose that the axis remains linear');
assert.ok(!chartEnhancer.includes('logarithmic'),'chart enhancer must not silently change scale semantics');
console.log('presentation-v4-visible tests: OK');
