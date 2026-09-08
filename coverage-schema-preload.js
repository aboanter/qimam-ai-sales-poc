// Structured coverage guard V3.4.1 — final compact breadth contract at the network boundary.
const upstreamFetch = global.fetch;
const PRESENTATION_SYSTEM = 'You output only the JSON object described in the instructions below — no other text.';

function originalQuestion(body){
  try{
    const msg=body?.messages?.[body.messages.length-1];
    const text=String(msg?.content||'');
    const q='Original question:\n', p='\n\nExecuted Odoo MCP plan:\n';
    const qi=text.indexOf(q), pi=text.indexOf(p);
    return qi>=0&&pi>qi ? text.slice(qi+q.length,pi).trim() : '';
  }catch{return ''}
}
function coverageScore(question){
  const q=String(question||'');
  const checks=[
    /(dashboard|لوحة|تقرير\s+مبيعات|تقرير\s+شامل|executive)/i,
    /(kpi|مؤشر|مؤشرات|إجمالي المبيعات|عدد الطلبات|متوسط قيمة الطلب)/i,
    /(اتجاه|شهري|الشهرية|trend|monthly)/i,
    /(أعلى العملاء|افضل العملاء|أفضل العملاء|top customers|ranking|ترتيب العملاء)/i,
    /(جدول|تفصيلي|table|details)/i,
    /(ملاحظات|تحليل|تحليلات|insight|analysis|استراتيجي)/i
  ];
  return checks.reduce((n,re)=>n+(re.test(q)?1:0),0);
}
function parseJsonPrefix(text){
  const s=String(text||'').trimStart(),start=s.search(/[\[{]/);if(start<0)return null;
  const open=s[start],close=open==='{'?'}':']';let depth=0,inString=false,escaped=false;
  for(let i=start;i<s.length;i++){
    const ch=s[i];
    if(inString){if(escaped)escaped=false;else if(ch==='\\')escaped=true;else if(ch==='"')inString=false;continue}
    if(ch==='"'){inString=true;continue}
    if(ch===open)depth++;else if(ch===close&&--depth===0){try{return JSON.parse(s.slice(start,i+1))}catch{return null}}
  }
  return null;
}
function extractPlan(text){
  try{
    const p='\n\nExecuted Odoo MCP plan:\n',r='\n\nLIVE factual Odoo results:\n';
    const pi=text.indexOf(p),ri=text.indexOf(r);if(pi<0||ri<0||ri<=pi)return null;
    return JSON.parse(text.slice(pi+p.length,ri).trim());
  }catch{return null}
}
function extractAnalyst(text){
  const marker='ANALYST V3.2 — AUTHORITATIVE SEMANTIC ANALYSIS WITH DETERMINISTIC MATH:\n';
  const i=text.lastIndexOf(marker);if(i<0)return null;
  return parseJsonPrefix(text.slice(i+marker.length));
}
function resultCatalog(text,plan){
  try{
    const r='\n\nLIVE factual Odoo results:\n';const ri=text.indexOf(r);if(ri<0)return[];
    const results=parseJsonPrefix(text.slice(ri+r.length));if(!results||typeof results!=='object')return[];
    const operations=Array.isArray(plan?.operations)?plan.operations:[];
    return operations.map(op=>{
      const raw=results[op.name];let rows=[];
      if(Array.isArray(raw))rows=raw;
      else if(raw&&typeof raw==='object')for(const k of ['records','rows','data','result','results','items'])if(Array.isArray(raw[k])){rows=raw[k];break}
      const first=rows.find(x=>x&&typeof x==='object'&&!Array.isArray(x))||null;
      return {
        name:op.name,
        tool:op.tool,
        model:op.arguments?.model||'',
        fields:Array.isArray(op.arguments?.fields)?op.arguments.fields:[],
        groupby:Array.isArray(op.arguments?.groupby)?op.arguments.groupby:[],
        rowCount:rows.length,
        resultKeys:first?Object.keys(first).slice(0,20):[]
      };
    });
  }catch{return[]}
}
function compactAnalyst(a){
  if(!a||typeof a!=='object')return null;
  return {
    version:a.version||'3.2',answerability:a.answerability,scope:a.scope||{},
    facts:Array.isArray(a.facts)?a.facts.slice(0,12):[],
    derivedMetrics:Array.isArray(a.derivedMetrics)?a.derivedMetrics.slice(0,16):[],
    rankings:Array.isArray(a.rankings)?a.rankings.slice(0,6):[],
    comparisons:Array.isArray(a.comparisons)?a.comparisons.slice(0,6):[],
    trends:Array.isArray(a.trends)?a.trends.slice(0,8):[],
    anomalies:Array.isArray(a.anomalies)?a.anomalies.slice(0,8):[],
    insights:Array.isArray(a.insights)?a.insights.slice(0,8):[],
    caveats:Array.isArray(a.caveats)?a.caveats.slice(0,8):[]
  };
}

const SCHEMA_ADAPTER = `STRUCTURED OUTPUT SHAPE — MANDATORY:\n- Top-level object: {title:string, summary:string, components:array, designSystem?:string, layoutTree?:string}.\n- EVERY component must be exactly {type,title,data}.\n- data MUST be a JSON-encoded STRING containing that component's id, binding or literal values, compact section metadata and optional small componentLayout.\n- designSystem, when present, MUST be a JSON-encoded STRING.\n- Do not place id, binding, values, categories, series, rows, section or styles beside data; they belong INSIDE the data JSON string.\n`;

const FINAL_COMPACT_V341 = `FINAL PRESENTATION CONTRACT V3.4.1 — HIGHEST PRIORITY:\nYou are the ART DIRECTOR. The Analyst already performed semantic analysis and the server retains raw Odoo rows for deterministic binding hydration.\n- COVERAGE BEFORE DECORATION. For a broad executive dashboard return 8-10 useful components in ONE response: normally 3-4 KPIs + one monthly/time trend + one customer/ranking chart + one detail table + one insight component.\n- NEVER collapse a broad dashboard into one KPI. Build the complete component manifest first.\n- Prefer binding for charts, tables and direct KPIs. Use exact operation names and exact result keys from ODOO_OPERATION_CATALOG when available.\n- Bound chart/table components must NOT copy categories, series, rows or raw Odoo data. The server hydrates them locally after your response.\n- Use compact literal values only for derived KPIs or insights already supported by ANALYST_JSON and not safely bindable to one operation.\n- Treat ANALYST_JSON values/status as authoritative. Do not recalculate them.\n- For insights, paraphrase only decision-useful Analyst facts/insights/caveats. Never invent causation, seasonality or explanations not supported by Analyst.\n- Use short semantic icon strings only: revenue, receipt, users, chart, profit, invoice, warning, wallet, trend.\n- NO verbose icon objects, watermark objects, per-component CSS, gradients, titleStyle/valueStyle, palettes, shadows or decorative specifications by default.\n- Use ONE compact top-level designSystem and compact section metadata. Do not emit layoutTree when sections are sufficient.\n- For time-grouped charts use sort:\"asc\" in the binding so the local hydrator renders chronological order.\n- If output budget becomes tight, remove decoration first and optional extra charts second. Never remove requested analytical classes.\n- Summary max 3 concise Arabic sentences; insight list normally 3-5 items. Return JSON only.`;

function buildCompactMessage(body){
  const msg=body.messages?.[body.messages.length-1];if(!msg||typeof msg.content!=='string')return false;
  const text=msg.content,q=originalQuestion(body),plan=extractPlan(text),analyst=extractAnalyst(text);
  if(!q||!plan||!analyst)return false;
  const catalog=resultCatalog(text,plan);
  msg.content=`Original question:\n${q}\n\nANALYTICAL_INTENT:\n${JSON.stringify(plan.analyticalIntent||{})}\n\nODOO_OPERATION_CATALOG:\n${JSON.stringify(catalog)}\n\nANALYST_JSON — AUTHORITATIVE:\n${JSON.stringify(compactAnalyst(analyst))}\n\n${SCHEMA_ADAPTER}\n${FINAL_COMPACT_V341}`;
  return true;
}
function stripLegacyPresentationInstructions(text){
  let out=String(text||'');
  const marker='\n\nIMPORTANT STRUCTURED-OUTPUT ADAPTER:';
  const i=out.indexOf(marker);
  if(i>=0)out=out.slice(0,i);
  return out;
}

global.fetch = async function coverageSchemaFetch(url,options={}){
  try{
    if(String(url).includes('api.anthropic.com/v1/messages')&&options.body){
      const body=JSON.parse(options.body);
      if(body?.system===PRESENTATION_SYSTEM){
        const score=coverageScore(originalQuestion(body));
        const msg=body.messages?.[body.messages.length-1];
        const v33=typeof msg?.content==='string' && msg.content.includes('SECTION DESIGN LANGUAGE V3.3');
        if(score>=4 && msg&&typeof msg.content==='string'){
          let compacted=false;
          if(v33)compacted=buildCompactMessage(body);
          if(v33 && !compacted){
            // Fallback is still grounded in the original prompt, but removes the old verbose
            // design examples that competed with the compact art-director contract.
            msg.content=stripLegacyPresentationInstructions(msg.content)+`\n\n${SCHEMA_ADAPTER}\n${FINAL_COMPACT_V341}`;
          }
          if(!v33 && !msg.content.includes('STRUCTURED COVERAGE GUARD V3.4.1')){
            msg.content+='\n\nSTRUCTURED COVERAGE GUARD V3.4.1 — Preserve executive KPIs, time trend, customer/ranking analysis, detailed table and insights. Do not collapse a broad report into one hero KPI.';
          }
          if(v33){
            body.max_tokens=Math.min(Number(body.max_tokens)||3600,3600);
            body.metadata={...(body.metadata||{}),qimam_presentation_mode:compacted?'compact_analyst_manifest':'compact_grounded_fallback'};
          }
          options={...options,body:JSON.stringify(body)};
        }
      }
    }
  }catch(e){console.error('coverage-schema-preload non-fatal error:',e.message)}
  return upstreamFetch(url,options);
};

require('./structured-preload.js');