'use strict';

const PRESENTATION_SYSTEM='You output only the JSON object described in the instructions below — no other text.';

function parseJsonPrefix(text){
  const s=String(text||'').trimStart(),start=s.search(/[\[{]/);if(start<0)return null;
  const open=s[start],close=open==='{'?'}':']';let depth=0,inStr=false,esc=false;
  for(let i=start;i<s.length;i++){
    const ch=s[i];
    if(inStr){if(esc)esc=false;else if(ch==='\\')esc=true;else if(ch==='"')inStr=false;continue}
    if(ch==='"'){inStr=true;continue}
    if(ch===open)depth++;else if(ch===close&&--depth===0){try{return JSON.parse(s.slice(start,i+1))}catch{return null}}
  }
  return null;
}
function isPresentationBody(body){return !!body&&body.system===PRESENTATION_SYSTEM&&Array.isArray(body.messages)}
function parseRequestBody(options){
  try{return typeof options?.body==='string'?JSON.parse(options.body):options?.body||null}catch{return null}
}
function extractAnalystSummary(text){
  const marker='ANALYST V3.2 — AUTHORITATIVE SEMANTIC ANALYSIS WITH DETERMINISTIC MATH:\n';
  const i=String(text||'').indexOf(marker);if(i<0)return'';
  return String(text).slice(i+marker.length).trim();
}
function extractEnvelope(body){
  if(!isPresentationBody(body))return null;
  try{
    const last=body.messages[body.messages.length-1];
    const text=typeof last?.content==='string'?last.content:'';
    const q='Original question:\n',p='\n\nExecuted Odoo MCP plan:\n',r='\n\nLIVE factual Odoo results:\n';
    const qi=text.indexOf(q),pi=text.indexOf(p),ri=text.indexOf(r);
    if(qi<0||pi<0||ri<0||!(qi<pi&&pi<ri))return null;
    const question=text.slice(qi+q.length,pi).trim();
    const plan=JSON.parse(text.slice(pi+p.length,ri).trim());
    const tail=text.slice(ri+r.length);
    const results=parseJsonPrefix(tail);
    if(!results)return null;
    return{question,plan,results,analystSummary:extractAnalystSummary(tail),rawText:text};
  }catch{return null}
}

module.exports={PRESENTATION_SYSTEM,parseJsonPrefix,isPresentationBody,parseRequestBody,extractEnvelope,extractAnalystSummary};
