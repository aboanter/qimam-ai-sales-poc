'use strict';
const {PRESENTATION_V4_CONTRACT}=require('./presentation-v4-contract');
const {compactCatalog}=require('./presentation-v4-catalog');

function safeText(v,max=6000){return String(v||'').slice(0,max)}
function buildArtDirectorPrompt({question,analystSummary='',catalog}){
  return [
    PRESENTATION_V4_CONTRACT,
    '',
    'USER REQUEST:',safeText(question,2500),
    '',
    'ANALYST SEMANTIC SUMMARY:',safeText(analystSummary,3500),
    '',
    'AVAILABLE DATASETS:',JSON.stringify(compactCatalog(catalog),null,0),
    '',
    'Return only the compact decision object. For render, include manifest. Use only dataset and field names listed above.'
  ].join('\n');
}
function parseJsonObject(text){
  const s=String(text||'').trim();
  if(!s)throw new Error('Empty Art Director response');
  try{return JSON.parse(s)}catch{}
  const start=s.indexOf('{');if(start<0)throw new Error('Art Director response contains no JSON object');
  let depth=0,inStr=false,esc=false;
  for(let i=start;i<s.length;i++){
    const ch=s[i];
    if(inStr){if(esc)esc=false;else if(ch==='\\')esc=true;else if(ch==='"')inStr=false;continue}
    if(ch==='"'){inStr=true;continue}
    if(ch==='{')depth++;
    if(ch==='}'&&--depth===0){try{return JSON.parse(s.slice(start,i+1))}catch(e){throw new Error(`Invalid decision JSON: ${e.message}`)}}
  }
  throw new Error('Unterminated decision JSON');
}
function normalizeDecision(value){
  const obj=typeof value==='string'?parseJsonObject(value):value;
  if(!obj||typeof obj!=='object'||Array.isArray(obj))throw new Error('Art Director decision must be an object');
  // Backward compatibility during V4 rollout: a direct manifest means render.
  if(!obj.decision)return{decision:'render',manifest:obj};
  const decision=String(obj.decision).toLowerCase();
  if(decision==='render'){
    if(!obj.manifest||typeof obj.manifest!=='object'||Array.isArray(obj.manifest))throw new Error('render decision requires manifest');
    return{decision:'render',manifest:obj.manifest};
  }
  if(decision==='clarify'){
    const question=String(obj.question||'').trim();
    if(!question)throw new Error('clarify decision requires question');
    return{decision:'clarify',question,options:Array.isArray(obj.options)?obj.options.slice(0,3).map(String):[]};
  }
  if(decision==='advise'){
    const message=String(obj.message||'').trim();
    if(!message)throw new Error('advise decision requires message');
    return{decision:'advise',message,options:Array.isArray(obj.options)?obj.options.slice(0,3).map(String):[]};
  }
  throw new Error(`Unsupported Art Director decision: ${decision}`);
}
// Historical export kept for existing tests/callers. It returns a direct manifest when
// the response is render, and the decision object for clarify/advise.
function parseManifestText(text){
  const d=normalizeDecision(text);
  return d.decision==='render'?d.manifest:d;
}
function estimatePromptSize(prompt){
  const chars=String(prompt||'').length;
  return{chars,estimatedTokens:Math.ceil(chars/4)};
}
module.exports={buildArtDirectorPrompt,parseManifestText,parseJsonObject,normalizeDecision,estimatePromptSize};
