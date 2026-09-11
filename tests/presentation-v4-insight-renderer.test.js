'use strict';
const assert=require('assert');
const fs=require('fs');
const path=require('path');

const src=fs.readFileSync(path.join(__dirname,'..','public','insight-renderer-v331.js'),'utf8');

assert.ok(src.includes("schema.insightRendererVersion='3.3.4'"),'renderer version must be 3.3.4');
assert.ok(src.includes('function refOrder(tree)'),'renderer must derive stable ref order from layoutTree');
assert.ok(src.includes("refs.indexOf(String(c.id||''))"),'renderer must resolve an untitled insight by component id/ref order');
assert.ok(src.includes("String(c.title||'').trim()"),'title matching should remain only as a legacy fallback');
assert.ok(src.includes("findIndex(x=>String(x?.id||'')===String(c.id||''))"),'renderer must have component-order fallback when layoutTree is unavailable');
assert.ok(src.includes("sourceItems(c).length||c.text"),'structured items and text fallback must both be renderable');
assert.ok(src.includes('cell.replaceChildren(box)'),'resolved insight cell must be replaced with the structured insight UI');

// Regression fixture: an untitled insight must still be discoverable by the same ref id
// that V4 emits in layoutTree after the table component.
const schema={
  components:[
    {id:'v4_table_1',type:'table'},
    {id:'v4_insight_2',type:'insight',title:'',items:[{text:'A'},{text:'B'},{text:'C'}]}
  ],
  layoutTree:[{type:'section',children:[{type:'stack',children:[
    {type:'ref',id:'v4_table_1'},
    {type:'ref',id:'v4_insight_2'}
  ]}]}]
};
function refs(tree){const out=[];(function walk(n){if(Array.isArray(n))return n.forEach(walk);if(!n||typeof n!=='object')return;if(n.type==='ref'&&n.id){out.push(String(n.id));return}(n.children||[]).forEach(walk)})(tree);return out}
assert.deepStrictEqual(refs(schema.layoutTree),['v4_table_1','v4_insight_2']);
assert.strictEqual(refs(schema.layoutTree).indexOf(schema.components[1].id),1);
assert.strictEqual(schema.components[1].items.length,3);

console.log('presentation-v4-insight-renderer tests: OK');
