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
    'Return only the compact manifest. Use only dataset and field names listed above.'
  ].join('\n');
}
function parseManifestText(text){
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
    if(ch==='}'&&--depth===0){try{return JSON.parse(s.slice(start,i+1))}catch(e){throw new Error(`Invalid manifest JSON: ${e.message}`)}}
  }
  throw new Error('Unterminated manifest JSON');
}
function estimatePromptSize(prompt){
  const chars=String(prompt||'').length;
  return{chars,estimatedTokens:Math.ceil(chars/4)};
}
module.exports={buildArtDirectorPrompt,parseManifestText,estimatePromptSize};
