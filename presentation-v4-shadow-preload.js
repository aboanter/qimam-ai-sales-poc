'use strict';

// Opt-in only. When disabled this file delegates immediately to the proven V3 startup chain.
// When enabled it observes completed presentation calls and runs V4 asynchronously using
// the same factual envelope. It never modifies the user-visible V3 response.

const nativeFetch=global.fetch;
const {parseRequestBody,extractEnvelope,isPresentationBody}=require('./presentation-v4-envelope');
const {runShadow}=require('./presentation-v4-shadow');
const {callAnthropicArtDirector}=require('./presentation-v4-anthropic');
const {parseManifestText}=require('./presentation-v4-art-director');

const enabled=String(process.env.QIMAM_PRESENTATION_V4_SHADOW||'').toLowerCase();
const SHADOW_ON=enabled==='1'||enabled==='true'||enabled==='yes';

require('./binding-compat-preload.js');

if(SHADOW_ON){
  const currentFetch=global.fetch;
  function isAnthropic(url){return String(url||'').includes('api.anthropic.com/v1/messages')}
  async function currentUiSummary(response){
    try{
      const payload=await response.clone().json();
      const block=(payload?.content||[]).find(x=>x?.type==='text'&&typeof x.text==='string');
      if(!block)return null;
      const ui=parseManifestText(block.text);
      const types={};for(const c of ui?.components||[])types[c.type]=(types[c.type]||0)+1;
      return{components:(ui?.components||[]).length,types};
    }catch{return null}
  }
  global.fetch=async function v4ShadowFetch(url,options={}){
    const body=parseRequestBody(options);
    const presentation=isAnthropic(url)&&isPresentationBody(body);
    const response=await currentFetch(url,options);
    if(!presentation||!response.ok)return response;
    const envelope=extractEnvelope(body);
    if(!envelope)return response;
    // Never block the current response; comparison is diagnostic only.
    setImmediate(async()=>{
      try{
        let usage=null;
        const shadow=await runShadow({
          question:envelope.question,
          plan:envelope.plan,
          results:envelope.results,
          analystSummary:envelope.analystSummary,
          artDirector:async({prompt})=>{
            const out=await callAnthropicArtDirector({
              prompt,
              apiKey:process.env.ANTHROPIC_API_KEY,
              model:process.env.QIMAM_PRESENTATION_V4_MODEL||process.env.ANTHROPIC_MODEL||'claude-sonnet-4-6',
              fetchImpl:nativeFetch,
              maxTokens:Number(process.env.QIMAM_PRESENTATION_V4_MAX_TOKENS)||1200,
              timeoutMs:Number(process.env.QIMAM_PRESENTATION_V4_TIMEOUT_MS)||45000
            });
            usage=out.usage;
            return out.manifest;
          }
        });
        const current=await currentUiSummary(response);
        console.log('[V4:SHADOW]',JSON.stringify({
          ok:shadow.ok,
          stage:shadow.stage||'complete',
          current,
          v4:shadow.summary||null,
          prompt:shadow.promptSize||null,
          llmMs:shadow.llmMs||null,
          totalMs:shadow.totalMs||null,
          usage,
          errors:shadow.errors||[]
        }));
      }catch(e){console.error('[V4:SHADOW] non-fatal:',e.message)}
    });
    return response;
  };
  console.log('[V4:SHADOW] enabled; V3 remains authoritative');
}
