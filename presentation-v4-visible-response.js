'use strict';

function summarize(ui){
  const types={};
  for(const c of ui?.components||[])types[c.type]=(types[c.type]||0)+1;
  return{components:(ui?.components||[]).length,types};
}

function buildVisiblePresentation(shadow,{usage=null,model='claude-sonnet-4-6'}={}){
  if(!shadow?.ok||!shadow?.presentation)throw new Error('V4 visible requires a successful materialized presentation');
  return{
    ...shadow.presentation,
    presentationV4:{
      version:'4.0-visible-alpha.2',
      mode:'visible_test',
      prompt:shadow.promptSize||null,
      llmMs:shadow.llmMs??null,
      totalMs:shadow.totalMs??null,
      usage,
      model,
      summary:summarize(shadow.presentation),
      manifest:shadow.manifest||null
    }
  };
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
  // Metadata must survive inflation. structured-preload preserves unknown top-level
  // properties from the parsed object, so keep the V4 diagnostics here as well.
  for(const key of ['generativeUiVersion','presentationBuilderVersion','presentationManifestVersion','materialization','presentationV4']){
    if(presentation?.[key]!==undefined)compact[key]=presentation[key];
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

module.exports={summarize,buildVisiblePresentation,toStructuredAdapterUi,buildAnthropicPayload,responseFromPayload};
