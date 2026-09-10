'use strict';

function summarize(ui){
  const types={};
  for(const c of ui?.components||[])types[c.type]=(types[c.type]||0)+1;
  return{components:(ui?.components||[]).length,types};
}

function safeLayout(v){return ['wide','grid','split','stack','strip'].includes(v)?v:'stack'}
function safeRatio(v){return ['1:1','2:1','1:2','3:2','2:3'].includes(v)?v:'1:1'}
function buildLayoutTree(presentation){
  const components=Array.isArray(presentation?.components)?presentation.components:[];
  if(!components.length)return null;
  const groups=new Map();
  components.forEach((c,i)=>{
    const sec=c?.section&&typeof c.section==='object'?c.section:{};
    const id=String(sec.id||`section_${i+1}`);
    if(!groups.has(id))groups.set(id,{meta:sec,items:[]});
    groups.get(id).items.push(c);
  });
  const ordered=[...groups.values()].sort((a,b)=>(Number(a.meta?.order)||0)-(Number(b.meta?.order)||0));
  return ordered.map(g=>{
    const refs=g.items.map(c=>({type:'ref',id:String(c.id)}));
    const layout=safeLayout(g.meta?.layout);
    let inner;
    if(layout==='grid') inner={type:'grid',columns:Math.max(2,Math.min(Number(g.meta?.columns)||2,4)),gap:'md',children:refs};
    else if(layout==='split'){
      const first=refs.slice(0,2),extra=refs.slice(2);
      const split={type:'split',ratio:safeRatio(g.meta?.ratio),gap:'md',children:first};
      inner=extra.length?{type:'stack',gap:'md',children:[split,...extra]}:split;
    }else if(layout==='strip') inner={type:'strip',gap:'md',children:refs};
    else inner={type:'stack',gap:'md',children:refs};
    return{type:'section',variant:'plain',gap:'md',children:[inner]};
  });
}

function buildVisiblePresentation(shadow,{usage=null,model='claude-sonnet-4-6'}={}){
  if(!shadow?.ok||!shadow?.presentation)throw new Error('V4 visible requires a successful materialized presentation');
  const presentation={...shadow.presentation};
  presentation.layoutTree=buildLayoutTree(presentation);
  presentation.presentationV4={
    version:'4.0-visible-alpha.3',
    mode:'visible_test',
    prompt:shadow.promptSize||null,
    llmMs:shadow.llmMs??null,
    totalMs:shadow.totalMs??null,
    usage,
    model,
    summary:summarize(shadow.presentation),
    manifest:shadow.manifest||null,
    layoutSource:'server_manifest'
  };
  return presentation;
}

// The established structured-preload layer expects every component in the compact
// {type,title,data:<JSON string>} dialect. V4 materializes components before that layer,
// so adapt only at this boundary; structured-preload will inflate them back losslessly.
function toStructuredAdapterUi(presentation){
  const compact={
    title:String(presentation?.title||''),
    summary:String(presentation?.summary||''),
    components:(presentation?.components||[]).map(c=>{
      const data={...c};
      delete data.type;
      delete data.title;
      return{type:c.type,title:String(c.title||''),data:JSON.stringify(data)};
    })
  };
  for(const key of ['generativeUiVersion','presentationBuilderVersion','presentationManifestVersion','materialization','presentationV4']){
    if(presentation?.[key]!==undefined)compact[key]=presentation[key];
  }
  if(Array.isArray(presentation?.layoutTree)&&presentation.layoutTree.length){
    compact.layoutTree=JSON.stringify(presentation.layoutTree);
  }
  if(presentation?.designSystem&&Object.keys(presentation.designSystem).length){
    compact.designSystem=JSON.stringify(presentation.designSystem);
  }
  return compact;
}

function buildAnthropicPayload(presentation,{usage=null,model='claude-sonnet-4-6'}={}){
  const adapterUi=toStructuredAdapterUi(presentation);
  return{
    id:'msg_qimam_v4_visible',
    type:'message',
    role:'assistant',
    model,
    content:[{type:'text',text:JSON.stringify(adapterUi)}],
    stop_reason:'end_turn',
    stop_sequence:null,
    usage:usage||{input_tokens:0,output_tokens:0}
  };
}

function responseFromPayload(payload){
  return new Response(JSON.stringify(payload),{status:200,headers:{'content-type':'application/json'}});
}

module.exports={summarize,buildLayoutTree,buildVisiblePresentation,toStructuredAdapterUi,buildAnthropicPayload,responseFromPayload};
