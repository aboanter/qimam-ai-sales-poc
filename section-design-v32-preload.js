// Generative Section Design Language V3.3 — Claude authors presentation intent; server hydrates Odoo data locally.
require('./coverage-schema-preload.js');

const upstreamFetch = global.fetch;
const PRESENTATION_SYSTEM = 'You output only the JSON object described in the instructions below — no other text.';
const MAX_FULL_RETRIES = 0;

const SECTION_INSTRUCTION = `\n\nSECTION DESIGN LANGUAGE V3.3 — COMPACT ART-DIRECTION MODE:\nYou are the ART DIRECTOR, not a data serializer. The Odoo evidence is already present in the prompt. Minimize generated JSON while preserving analytical coverage.\n\nHARD RULES:\n- For broad dashboards return all requested analytical classes in ONE pass: at least 3 KPI components when supported, a time-trend chart, customer/ranking chart, requested table, and insight component.\n- Prefer server-side data bindings instead of repeating rows/numbers from Odoo evidence.\n- Put binding inside component data when the component can be built directly from ONE executed MCP operation.\n- binding format for KPI: {\"operation\":\"exact_plan_operation_name\",\"kind\":\"kpi\",\"valueField\":\"amount_total:sum\",\"aggregate\":\"sum|count|first\"}.\n- binding format for bar/line/area/pie: {\"operation\":\"exact_plan_operation_name\",\"kind\":\"chart\",\"labelField\":\"partner_id|date_order:month|...\",\"valueField\":\"amount_total:sum|...\",\"limit\":10,\"sort\":\"desc|asc|none\"}.\n- binding format for table: {\"operation\":\"exact_plan_operation_name\",\"kind\":\"table\",\"columns\":[{\"title\":\"العميل\",\"field\":\"partner_id\"},{\"title\":\"المبيعات\",\"field\":\"amount_total:sum\"}],\"limit\":10,\"sortField\":\"amount_total:sum\",\"sort\":\"desc\"}.\n- Use EXACT operation names and EXACT field keys visible in Executed Odoo MCP plan / LIVE results. Do not invent aliases.\n- If a requested component needs a derived calculation or combines multiple operations and cannot be represented safely by one binding, include its compact literal data as before.\n- Do NOT duplicate categories/series/rows when a binding can provide them.\n- KPI data should normally contain only id,value/format when derived, or binding + format; icon may be a short semantic string. Avoid component-level CSS, gradients, watermark specs, titleStyle/valueStyle, and palettes unless explicitly essential.\n- Use ONE concise top-level designSystem for report art direction. Let the renderer provide component styling defaults.\n- Do not generate layoutTree when section metadata is sufficient.\n- Summary max 3 concise Arabic sentences. Insights normally max 5 concise items.\n\nSECTION COMPOSITION:\n- Put an optional section object INSIDE each component data: {\"id\":\"executive_overview\",\"title\":\"نظرة تنفيذية\",\"subtitle\":\"...\",\"presentation\":\"hero|editorial|panel|plain|accent\",\"layout\":\"grid|split|stack|strip|wide\",\"columns\":2|3|4,\"ratio\":\"1:1|2:1|1:2|3:2|2:3\",\"order\":1}.\n- Use 3-6 meaningful sections for broad reports. Section metadata enriches coverage; it never replaces requested components.\n\nDESIGN SYSTEM:\n- Keep designSystem compact: background, cardBackground/surface, textColor, mutedColor, accent, accent2, positive, negative, warning, borderColor, fontFamily, density, surfaceStyle, headingStyle, radius, gap, sectionGap, padding, maxWidth, shadow.\n- Prefer coherent report-level art direction over verbose per-component styling.\n\nThe server will hydrate valid bindings deterministically from the supplied MCP results AFTER your response. Return JSON only.`;

function isPresentationBody(body){return body&&body.system===PRESENTATION_SYSTEM&&Array.isArray(body.messages)}
function lastMessage(body){return Array.isArray(body?.messages)?body.messages[body.messages.length-1]:null}
function secs(ms){return Math.round(ms/100)/10}
function uiFromPayload(payload){if(!Array.isArray(payload?.content))return null;for(const block of payload.content){if(block&&block.type==='text'&&typeof block.text==='string'){try{return JSON.parse(block.text)}catch{}}}return null}
function responseFromPayload(payload,response){const headers=new Headers(response.headers);headers.set('content-type','application/json');return new Response(JSON.stringify(payload),{status:response.status,statusText:response.statusText,headers})}

function extractEnvelope(body){
  try{
    const text=String(lastMessage(body)?.content||'');
    const q='Original question:\n',p='\n\nExecuted Odoo MCP plan:\n',r='\n\nLIVE factual Odoo results:\n';
    const qi=text.indexOf(q),pi=text.indexOf(p),ri=text.indexOf(r);
    if(qi<0||pi<0||ri<0)return null;
    const plan=JSON.parse(text.slice(pi+p.length,ri).trim());
    const tail=text.slice(ri+r.length);
    const start=tail.search(/[\[{]/);if(start<0)return null;
    const s=tail.slice(start);let depth=0,inStr=false,esc=false,end=-1;
    const open=s[0],close=open==='{'?'}':']';
    for(let i=0;i<s.length;i++){const ch=s[i];if(inStr){if(esc)esc=false;else if(ch==='\\')esc=true;else if(ch==='"')inStr=false;continue}if(ch==='"'){inStr=true;continue}if(ch===open)depth++;else if(ch===close&&--depth===0){end=i+1;break}}
    if(end<0)return null;
    return{question:text.slice(qi+q.length,pi).trim(),plan,results:JSON.parse(s.slice(0,end))};
  }catch(e){console.error('section-design-v33 envelope parse error:',e.message);return null}
}

function rowsOf(v){
  if(Array.isArray(v))return v;
  if(!v||typeof v!=='object')return[];
  for(const k of ['records','rows','data','result','results','items'])if(Array.isArray(v[k]))return v[k];
  return[];
}
function labelOf(v){if(v==null)return'';if(Array.isArray(v))return String(v[1]??v[0]??'');if(typeof v==='object')return String(v.display_name??v.name??v.label??v.value??'');return String(v)}
function numOf(v){if(typeof v==='number'&&Number.isFinite(v))return v;if(typeof v==='string'){const n=Number(v.replace(/,/g,''));return Number.isFinite(n)?n:null}return null}
function getField(row,key){if(!row||typeof row!=='object')return undefined;if(Object.prototype.hasOwnProperty.call(row,key))return row[key];if(key.endsWith(':sum')){const base=key.slice(0,-4);if(Object.prototype.hasOwnProperty.call(row,base))return row[base]}if(key.endsWith('_count')&&Object.prototype.hasOwnProperty.call(row,'__count'))return row.__count;return undefined}
function operationNames(plan){return new Set((Array.isArray(plan?.operations)?plan.operations:[]).map(o=>o?.name).filter(Boolean))}
function sourceRows(envelope,operation){if(!envelope||!operation||!operationNames(envelope.plan).has(operation))return[];return rowsOf(envelope.results?.[operation])}
function sortedRows(rows,binding){let out=rows.slice();const key=binding.sortField||binding.valueField;if((binding.sort==='asc'||binding.sort==='desc')&&key){out.sort((a,b)=>{const av=numOf(getField(a,key))??0,bv=numOf(getField(b,key))??0;return binding.sort==='asc'?av-bv:bv-av})}const limit=Math.max(1,Math.min(Number(binding.limit)||100,100));return out.slice(0,limit)}
function hydrateComponent(c,envelope){
  const b=c?.binding;if(!b||typeof b!=='object'||typeof b.operation!=='string')return false;
  const rows=sourceRows(envelope,b.operation);if(!rows.length)return false;
  if(c.type==='kpi'&&b.kind==='kpi'){
    const vals=rows.map(r=>numOf(getField(r,b.valueField))).filter(Number.isFinite);
    if(!vals.length)return false;
    c.value=b.aggregate==='first'?vals[0]:b.aggregate==='count'?rows.length:vals.reduce((s,n)=>s+n,0);delete c.binding;return true;
  }
  if(['bar_chart','line_chart','area_chart','pie_chart'].includes(c.type)&&b.kind==='chart'&&b.labelField&&b.valueField){
    const rr=sortedRows(rows,b);const pairs=rr.map(r=>[labelOf(getField(r,b.labelField)),numOf(getField(r,b.valueField))]).filter(x=>x[0]&&Number.isFinite(x[1]));if(!pairs.length)return false;
    c.categories=pairs.map(x=>x[0]);c.series=[{name:c.seriesName||c.title||'القيمة',data:pairs.map(x=>x[1])}];delete c.seriesName;delete c.binding;return true;
  }
  if(c.type==='table'&&b.kind==='table'&&Array.isArray(b.columns)&&b.columns.length){
    const rr=sortedRows(rows,b);c.columns=b.columns.map(x=>String(x.title||x.field||''));c.rows=rr.map(r=>b.columns.map(x=>{const v=getField(r,x.field);return Array.isArray(v)?labelOf(v):v??''}));delete c.binding;return true;
  }
  return false;
}
function hydrateUi(ui,envelope){if(!ui||!Array.isArray(ui.components)||!envelope)return{bound:0,total:0};let bound=0;for(const c of ui.components)if(hydrateComponent(c,envelope))bound++;return{bound,total:ui.components.length}}
function coverageStats(ui){const comps=Array.isArray(ui?.components)?ui.components:[];const types=comps.map(c=>c?.type);return{components:comps.length,kpis:types.filter(t=>t==='kpi').length,hasTrend:comps.some(c=>['line_chart','area_chart','bar_chart'].includes(c?.type)&&/(شهري|اتجاه|monthly|trend|month)/i.test(String(c?.title||''))),hasRanking:comps.some(c=>['bar_chart','pie_chart','table'].includes(c?.type)&&/(أعلى|اعلى|أفضل|افضل|عميل|عملاء|customer|top|ranking)/i.test(String(c?.title||''))),hasTable:types.includes('table'),hasInsight:types.includes('insight')}}
function isThin(stats){return stats.components<6||stats.kpis<3||!stats.hasTrend||!stats.hasRanking||!stats.hasTable||!stats.hasInsight}
function addMetadata(payload,diag,envelope){if(!Array.isArray(payload?.content))return payload;for(const block of payload.content){if(block&&block.type==='text'&&typeof block.text==='string'){try{const ui=JSON.parse(block.text);diag.binding=hydrateUi(ui,envelope);const stats=coverageStats(ui);diag.initialThin=isThin(stats);diag.finalThin=diag.initialThin;diag.coverage=stats;ui.sectionDesignLanguageVersion='3.3';ui.structuredCoverageGuardVersion='3.3';ui.presentationPerformance=diag;ui.dataBindingVersion='1.0';block.text=JSON.stringify(ui)}catch(e){console.error('section-design-v33 metadata/hydration error:',e.message)}}}return payload}

async function timedFetch(url,options,diag){const started=Date.now();const response=await upstreamFetch(url,options);const ended=Date.now();diag.attempts.push({label:'initial',durationMs:ended-started,durationSeconds:secs(ended-started),httpStatus:response.status});console.log(`[PERF:PRESENT] compact_binding initial=${secs(ended-started)}s status=${response.status}`);return response}

global.fetch=async function sectionDesignFetch(url,options={}){
  let body=null,isPresentation=false,envelope=null;
  try{if(String(url).includes('api.anthropic.com/v1/messages')&&options.body){body=JSON.parse(options.body);isPresentation=isPresentationBody(body);if(isPresentation){envelope=extractEnvelope(body);const msg=lastMessage(body);if(msg&&typeof msg.content==='string'&&!msg.content.includes('SECTION DESIGN LANGUAGE V3.3'))msg.content+=SECTION_INSTRUCTION;options={...options,body:JSON.stringify(body)}}}}catch(e){console.error('section-design-v33 request inspection error:',e.message)}
  if(!isPresentation)return upstreamFetch(url,options);
  const totalStarted=Date.now();const diag={version:'2.0',mode:'compact_binding_single_pass',maxFullRetries:MAX_FULL_RETRIES,attempts:[]};
  const response=await timedFetch(url,options,diag);if(!response.ok)return response;
  try{const payload=await response.clone().json();diag.totalDurationMs=Date.now()-totalStarted;diag.totalDurationSeconds=secs(diag.totalDurationMs);diag.attemptCount=1;addMetadata(payload,diag,envelope);console.log(`[PERF:PRESENT] compact_binding total=${diag.totalDurationSeconds}s bound=${diag.binding?.bound||0}/${diag.binding?.total||0}`);return responseFromPayload(payload,response)}catch(e){console.error('section-design-v33 response error:',e.message);return response}
};
