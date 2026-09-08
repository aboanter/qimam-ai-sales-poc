// Presentation Binding Compatibility V1.2 — normalize compact Claude bindings at the network boundary.
// This wrapper is intentionally loaded FIRST. Downstream presentation wrappers keep their
// existing behavior; this only makes Claude's compact binding aliases compatible with V3.5 hydration.

const nativeFetch = global.fetch;
const PRESENTATION_SYSTEM = 'You output only the JSON object described in the instructions below — no other text.';

function isPresentationRequest(options){
  try{
    if(!options?.body)return false;
    const body=JSON.parse(options.body);
    return body?.system===PRESENTATION_SYSTEM;
  }catch{return false}
}
function normalizeSort(binding,type){
  if(!binding||typeof binding!=='object')return;
  if(binding.sort&&typeof binding.sort==='object'){
    const s=binding.sort;
    if(typeof s.field==='string'&&!binding.sortField)binding.sortField=s.field;
    if(['asc','desc'].includes(s.direction))binding.sort=s.direction;
    else delete binding.sort;
  }
  if(!['asc','desc','none'].includes(binding.sort))delete binding.sort;
  // Monthly/date charts must be chronological, not ordered by amount.
  const label=binding.labelField||binding.categoryField||'';
  if(['bar_chart','line_chart','area_chart'].includes(type)&&binding.sort==='asc'&&/(date|month|period)/i.test(label)&&!binding.sortField){
    binding.sortField=label;
  }
}
function normalizeBinding(data,type){
  const b=data?.binding;
  if(!b||typeof b!=='object'||!b.operation)return false;
  if(!b.kind){
    if(type==='kpi')b.kind='kpi';
    else if(type==='table')b.kind='table';
    else if(['bar_chart','line_chart','area_chart','pie_chart'].includes(type))b.kind='chart';
  }
  if(b.kind==='chart'){
    if(!b.labelField&&typeof b.categoryField==='string')b.labelField=b.categoryField;
    if(!b.categoryField&&typeof b.labelField==='string')b.categoryField=b.labelField;
  }
  if(b.kind==='table'&&Array.isArray(b.columns)){
    b.columns=b.columns.map(col=>{
      if(!col||typeof col!=='object')return col;
      const out={...col};
      if(!out.title&&out.label)out.title=out.label;
      return out;
    });
  }
  normalizeSort(b,type);
  return true;
}
function normalizeCompactUi(obj){
  if(!obj||!Array.isArray(obj.components))return {obj,normalized:0};
  let normalized=0;
  for(const c of obj.components){
    if(!c||typeof c!=='object'||typeof c.data!=='string')continue;
    try{
      const data=JSON.parse(c.data);
      if(normalizeBinding(data,c.type)){
        c.data=JSON.stringify(data);
        normalized++;
      }
    }catch{}
  }
  return {obj,normalized};
}
function responseFromPayload(payload,response){
  const headers=new Headers(response.headers);headers.set('content-type','application/json');
  return new Response(JSON.stringify(payload),{status:response.status,statusText:response.statusText,headers});
}

global.fetch=async function bindingCompatFetch(url,options={}){
  const isAnthropic=String(url).includes('api.anthropic.com/v1/messages');
  const presentation=isAnthropic&&isPresentationRequest(options);
  const response=await nativeFetch(url,options);
  if(!presentation||!response.ok)return response;
  try{
    const payload=await response.clone().json();
    let total=0;
    if(Array.isArray(payload?.content)){
      for(const block of payload.content){
        if(block?.type!=='text'||typeof block.text!=='string')continue;
        try{
          const compact=JSON.parse(block.text);
          const out=normalizeCompactUi(compact);total+=out.normalized;
          block.text=JSON.stringify(out.obj);
        }catch{}
      }
    }
    if(total)console.log(`[BINDING:COMPAT] normalized=${total}`);
    return responseFromPayload(payload,response);
  }catch(e){
    console.error('binding-compat non-fatal response error:',e.message);
    return response;
  }
};

require('./background-jobs-preload.js');
