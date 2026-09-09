'use strict';
const assert=require('assert');
const fs=require('fs');
const path=require('path');
const {buildVisiblePresentation,buildAnthropicPayload,summarize}=require('../presentation-v4-visible-response');

const shadow={
  ok:true,
  manifest:{title:'اختبار',components:[{type:'table'}]},
  promptSize:{chars:1000,estimatedTokens:250},
  llmMs:4321,
  totalMs:4330,
  presentation:{
    title:'اختبار',summary:'',generativeUiVersion:4,presentationBuilderVersion:'4.0.0-alpha.1',
    components:[{type:'table',title:'جدول',columns:['العميل'],rows:[['A']]},{type:'insight',title:'ملاحظات',items:[{text:'ملاحظة'}]}],
    designSystem:{},materialization:{components:2,failures:[]}
  }
};
const usage={input_tokens:700,output_tokens:250};
const visible=buildVisiblePresentation(shadow,{usage,model:'claude-test'});
assert.strictEqual(visible.presentationV4.mode,'visible_test');
assert.strictEqual(visible.presentationV4.llmMs,4321);
assert.deepStrictEqual(visible.presentationV4.summary,{components:2,types:{table:1,insight:1}});
assert.strictEqual(visible.components[0].rows[0][0],'A');
const payload=buildAnthropicPayload(visible,{usage,model:'claude-test'});
assert.strictEqual(payload.stop_reason,'end_turn');
assert.strictEqual(payload.usage.output_tokens,250);
const parsed=JSON.parse(payload.content[0].text);
assert.strictEqual(parsed.generativeUiVersion,4);
assert.strictEqual(parsed.presentationV4.version,'4.0-visible-alpha.1');
assert.throws(()=>buildVisiblePresentation({ok:false}),/successful materialized presentation/i);
assert.deepStrictEqual(summarize({components:[]}),{components:0,types:{}});

const preload=fs.readFileSync(path.join(__dirname,'..','presentation-v4-visible-preload.js'),'utf8');
const installIndex=preload.indexOf('global.fetch=async function v4VisibleFetch');
const chainIndex=preload.indexOf("require('./binding-compat-preload.js')");
assert.ok(installIndex>=0&&chainIndex>installIndex,'V4 interceptor must install before V3 chain so Analyst can enrich the request');
assert.ok(preload.includes('fail-open to V3'),'visible mode must have explicit fail-open logging');
assert.ok(preload.includes('return nativeFetch(url,options)'),'visible failures must fall through to V3 Anthropic call');
assert.ok(!preload.includes("require('./presentation-v4-shadow-preload.js')"),'visible test must not recursively start shadow mode');
console.log('presentation-v4-visible tests: OK');
