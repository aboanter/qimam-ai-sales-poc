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
      version:'4.0-visible-alpha.1',
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

function buildAnthropicPayload(presentation,{usage=null,model='claude-sonnet-4-6'}={}){
  return{
    id:'msg_qimam_v4_visible',
    type:'message',
    role:'assistant',
    model,
    content:[{type:'text',text:JSON.stringify(presentation)}],
    stop_reason:'end_turn',
    stop_sequence:null,
    usage:usage||{input_tokens:0,output_tokens:0}
  };
}

function responseFromPayload(payload){
  return new Response(JSON.stringify(payload),{status:200,headers:{'content-type':'application/json'}});
}

module.exports={summarize,buildVisiblePresentation,buildAnthropicPayload,responseFromPayload};
