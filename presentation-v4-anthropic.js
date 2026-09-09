'use strict';
const {parseManifestText}=require('./presentation-v4-art-director');

const API_URL='https://api.anthropic.com/v1/messages';

function firstText(payload){
  const block=(payload?.content||[]).find(x=>x?.type==='text'&&typeof x.text==='string');
  if(!block)throw new Error('Anthropic Art Director returned no text block');
  return block.text;
}
function truncationError(payload,maxTokens){
  if(payload?.stop_reason!=='max_tokens')return null;
  const used=payload?.usage?.output_tokens;
  const suffix=Number.isFinite(used)?` after ${used} output tokens`:'';
  return new Error(`Anthropic Art Director response truncated at max_tokens=${maxTokens}${suffix}`);
}
async function callAnthropicArtDirector({prompt,apiKey,model='claude-sonnet-4-6',fetchImpl=global.fetch,maxTokens=1200,timeoutMs=45000}){
  if(typeof fetchImpl!=='function')throw new Error('fetch implementation is required');
  if(!apiKey)throw new Error('ANTHROPIC_API_KEY is required');
  if(!prompt)throw new Error('Art Director prompt is required');
  const tokenLimit=Math.max(256,Math.min(Number(maxTokens)||1200,2400));
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),Math.max(1000,Number(timeoutMs)||45000));
  try{
    const response=await fetchImpl(API_URL,{
      method:'POST',
      headers:{'content-type':'application/json','x-api-key':apiKey,'anthropic-version':'2023-06-01'},
      body:JSON.stringify({
        model,
        max_tokens:tokenLimit,
        temperature:0,
        system:'Return exactly one compact Qimam Presentation Manifest JSON object under 900 tokens. Never serialize dataset rows, values, chart arrays, table rows, CSS, or explanations.',
        messages:[{role:'user',content:String(prompt)}]
      }),
      signal:controller.signal
    });
    const payload=await response.json().catch(()=>({}));
    if(!response.ok){
      const detail=payload?.error?.message||payload?.message||`HTTP ${response.status}`;
      throw new Error(`Anthropic Art Director failed: ${detail}`);
    }
    const truncated=truncationError(payload,tokenLimit);
    if(truncated)throw truncated;
    const text=firstText(payload);
    return{manifest:parseManifestText(text),rawText:text,usage:payload?.usage||null,model:payload?.model||model,stopReason:payload?.stop_reason||null};
  }catch(e){
    if(e?.name==='AbortError')throw new Error(`Anthropic Art Director timeout after ${timeoutMs}ms`);
    throw e;
  }finally{clearTimeout(timer)}
}

module.exports={callAnthropicArtDirector,firstText,truncationError,API_URL};
