'use strict';

// V4 visible-test interceptor. It is installed BEFORE the proven V3 preload chain so
// the existing Analyst layer can enrich the presentation request first. When V4 succeeds,
// it replaces only the Anthropic presentation response. Any technical V4 failure falls through
// to the original V3 Anthropic call, preserving a working result. Clarify/advise decisions are
// intentional V4 outcomes and are shown to the user instead of falling through.

const fs=require('fs');
const path=require('path');
const nativeReadFileSync=fs.readFileSync.bind(fs);
const nativeFetch=global.fetch;
const {parseRequestBody,isPresentationBody,extractEnvelope}=require('./presentation-v4-envelope');
const {runShadow}=require('./presentation-v4-shadow');
const {callAnthropicArtDirector}=require('./presentation-v4-anthropic');
const {buildVisiblePresentation,buildDecisionPresentation,buildAnthropicPayload,responseFromPayload,summarize}=require('./presentation-v4-visible-response');

fs.readFileSync=function v4VisibleReadFileSync(file,...args){
  const value=nativeReadFileSync(file,...args);
  try{
    const normalized=String(file||'').replace(/\\/g,'/');
    if(normalized.endsWith('/public/index.html')&&typeof value==='string'&&!value.includes('/presentation-v4-visible-renderer.js')){
      return value.replace('</body>','<script src="/presentation-v4-visible-renderer.js"></script><script src="/presentation-v4-chart-enhancer.js"></script></body>');
    }
  }catch{}
  return value;
};

function isAnthropic(url){return String(url||'').includes('api.anthropic.com/v1/messages')}

async function runVisible(envelope){
  let usage=null,model=process.env.QIMAM_PRESENTATION_V4_MODEL||process.env.ANTHROPIC_MODEL||'claude-sonnet-4-6';
  const shadow=await runShadow({
    question:envelope.question,
    plan:envelope.plan,
    results:envelope.results,
    analystSummary:envelope.analystSummary,
    artDirector:async({prompt})=>{
      const out=await callAnthropicArtDirector({
        prompt,
        apiKey:process.env.ANTHROPIC_API_KEY,
        model,
        fetchImpl:nativeFetch,
        maxTokens:Number(process.env.QIMAM_PRESENTATION_V4_MAX_TOKENS)||1200,
        timeoutMs:Number(process.env.QIMAM_PRESENTATION_V4_TIMEOUT_MS)||45000
      });
      usage=out.usage;
      model=out.model||model;
      return out.manifest;
    }
  });
  if(!shadow.ok){
    const error=new Error(`V4 ${shadow.stage||'unknown'} failed: ${(shadow.errors||[]).join('; ')}`);
    error.shadow=shadow;
    throw error;
  }
  const presentation=shadow.presentation
    ? buildVisiblePresentation(shadow,{usage,model})
    : buildDecisionPresentation(shadow,{usage,model});
  return{shadow,presentation,usage,model};
}

global.fetch=async function v4VisibleFetch(url,options={}){
  const body=parseRequestBody(options);
  if(!isAnthropic(url)||!isPresentationBody(body))return nativeFetch(url,options);
  const envelope=extractEnvelope(body);
  if(!envelope)return nativeFetch(url,options);
  const started=Date.now();
  try{
    const out=await runVisible(envelope);
    console.log('[V4:VISIBLE]',JSON.stringify({
      ok:true,
      mode:'visible_test',
      decision:out.shadow?.decision?.decision||'render',
      v4:summarize(out.presentation),
      prompt:out.shadow.promptSize||null,
      llmMs:out.shadow.llmMs||null,
      totalMs:Date.now()-started,
      usage:out.usage,
      errors:[]
    }));
    return responseFromPayload(buildAnthropicPayload(out.presentation,{usage:out.usage,model:out.model}));
  }catch(e){
    console.error('[V4:VISIBLE] fail-open to V3:',e.message);
    return nativeFetch(url,options);
  }
};

require('./binding-compat-preload.js');
console.log('[V4:VISIBLE] enabled; V4 is user-visible on this test service, V3 remains fail-open fallback');

module.exports={runVisible};
