// Generative Section Design Language V3.5.1 — compact Claude art direction + deterministic local coverage repair.
require('./coverage-schema-preload.js');

const upstreamFetch = global.fetch;
const PRESENTATION_SYSTEM = 'You output only the JSON object described in the instructions below — no other text.';
const MAX_FULL_RETRIES = 0;

const SECTION_INSTRUCTION = `\n\nSECTION DESIGN LANGUAGE V3.3 — COMPACT ART-DIRECTION MODE:\nYou are the ART DIRECTOR, not a data serializer. For broad dashboards, build the complete analytical manifest before decoration: at least 3 KPIs when supported, a time-trend chart, customer/ranking analysis, a detail table and insights. Prefer exact server-side bindings for charts/tables/direct KPIs. Use one compact top-level designSystem. Avoid verbose per-component CSS, gradients, watermark objects, titleStyle/valueStyle and palettes. Return JSON only.`;

function isPresentationBody(body){return body&&body.system===PRESENTATION_SYSTEM&&Array.isArray(body.messages)}
function lastMessage(body){return Array.isArray(body?.messages)?body.messages[body.messages.length-1]:null}
function secs(ms){return Math.round(ms/100)/10}
function responseFromPayload(payload,response){const headers=new Headers(response.headers);headers.set('content-type','application/json');return new Response(JSON.stringify(payload),{status:response.status,statusText:response.statusText,headers})}

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
function extractEnvelope(body){
  try{
    const text=String(lastMessage(body)?.content||'');
    const q='Original question:\n',p='\n\nExecuted Odoo MCP plan:\n',r='\n\nLIVE factual Odoo results:\n';
    const qi=text.indexOf(q),pi=text.indexOf(p),ri=text.indexOf(r);if(qi<0||pi<0||ri<0)return null;
    return{question:text.slice(qi+q.length,pi).trim(),plan:JSON.parse(text.slice(pi+p.length,ri).trim()),results:parseJsonPrefix(text.slice(ri+r.length))};
  }catch(e){console.error('section-design-v35 envelope parse error:',e.message);return null}
}
function opName(op,i){return String(op?.name||op?.operation||op?.id||op?.label||`operation_${i+1}`)}
function resultEntries(results){
  if(Array.isArray(results))return results.map((v,i)=>[String(v?.name||v?.operation||v?.id||`operation_${i+1}`),v]);
  if(results&&typeof results==='object')return Object.entries(results);
  return[];
}
function rowsOf(v){
  if(Array.isArray(v))return v;
  if(!v||typeof v!=='object')return[];
  for(const k of ['records','rows','data','result','results','items'])if(Array.isArray(v[k]))return v[k];
  return[];
}
function sourceRows(envelope,operation){
  if(!envelope||!operation)return[];
  const ops=Array.isArray(envelope.plan?.operations)?envelope.plan.operations:[];
  const wanted=String(operation);let idx=ops.findIndex((o,i)=>opName(o,i)===wanted);
  if(idx<0)return[];
  if(Array.isArray(envelope.results)){
    const exact=envelope.results.find((v,i)=>String(v?.name||v?.operation||v?.id||`operation_${i+1}`)===wanted);
    return rowsOf(exact??envelope.results[idx]);
  }
  if(envelope.results&&typeof envelope.results==='object'){
    if(Object.prototype.hasOwnProperty.call(envelope.results,wanted))return rowsOf(envelope.results[wanted]);
    const entries=Object.entries(envelope.results);if(entries[idx])return rowsOf(entries[idx][1]);
  }
  return[];
}
function labelOf(v){if(v==null)return'';if(Array.isArray(v))return String(v[1]??v[0]??'');if(typeof v==='object')return String(v.display_name??v.name??v.label??v.value??'');return String(v)}
function numOf(v){if(typeof v==='number'&&Number.isFinite(v))return v;if(typeof v==='string'){const n=Number(v.replace(/,/g,''));return Number.isFinite(n)?n:null}return null}
function getField(row,key){if(!row||typeof row!=='object'||!key)return undefined;if(Object.prototype.hasOwnProperty.call(row,key))return row[key];if(String(key).endsWith(':sum')){const base=String(key).slice(0,-4);if(Object.prototype.hasOwnProperty.call(row,base))return row[base]}if(String(key).endsWith('_count')&&Object.prototype.hasOwnProperty.call(row,'__count'))return row.__count;return undefined}
function sortedRows(rows,binding){let out=rows.slice();const key=binding.sortField||binding.valueField;if((binding.sort==='asc'||binding.sort==='desc')&&key){out.sort((a,b)=>{const av=getField(a,key),bv=getField(b,key),an=numOf(av),bn=numOf(bv);if(an!==null||bn!==null)return binding.sort==='asc'?(an??0)-(bn??0):(bn??0)-(an??0);const as=labelOf(av),bs=labelOf(bv);return binding.sort==='asc'?as.localeCompare(bs):bs.localeCompare(as)})}const limit=Math.max(1,Math.min(Number(binding.limit)||100,100));return out.slice(0,limit)}
function hydrateComponent(c,envelope){
  const b=c?.binding;if(!b||typeof b!=='object'||typeof b.operation!=='string')return false;
  const rows=sourceRows(envelope,b.operation);if(!rows.length)return false;
  if(c.type==='kpi'&&b.kind==='kpi'){
    const vals=rows.map(r=>numOf(getField(r,b.valueField))).filter(Number.isFinite);if(!vals.length&&b.aggregate!=='count')return false;
    c.value=b.aggregate==='first'?vals[0]:b.aggregate==='count'?rows.reduce((s,r)=>s+(numOf(getField(r,b.valueField||'__count'))??1),0):vals.reduce((s,n)=>s+n,0);delete c.binding;return true;
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

function keysOfRows(rows){const row=rows.find(x=>x&&typeof x==='object'&&!Array.isArray(x));return row?Object.keys(row):[]}
function findKey(keys,re){return keys.find(k=>re.test(String(k)))||null}
function valueKey(keys){return findKey(keys,/(amount_total|price_total|revenue|sales|total).*(:sum)?$/i)||findKey(keys,/:sum$/i)||null}
function countKey(keys){return findKey(keys,/^__count$/i)||findKey(keys,/(order|id|record).*_count$/i)||null}
function dateKey(keys){return findKey(keys,/(date_order|invoice_date|date).*(:month|month)/i)||findKey(keys,/(month|period|date)/i)||null}
function customerKey(keys){return findKey(keys,/(partner_id|customer|client|partner)/i)||null}
function statusKey(keys){return findKey(keys,/(invoice_status|payment_state|state|status)/i)||null}
function operationCatalog(envelope){
  const ops=Array.isArray(envelope?.plan?.operations)?envelope.plan.operations:[];
  return ops.map((op,i)=>{const name=opName(op,i),rows=sourceRows(envelope,name),keys=keysOfRows(rows),groupby=Array.isArray(op?.arguments?.groupby)?op.arguments.groupby:[];return{name,op,rows,keys,groupby:[...groupby],valueKey:valueKey(keys),countKey:countKey(keys),dateKey:dateKey(keys),customerKey:customerKey(keys),statusKey:statusKey(keys)}});
}
function sumField(rows,key){return key?rows.reduce((s,r)=>s+(numOf(getField(r,key))??0),0):0}
function countRows(rows,key){return key?rows.reduce((s,r)=>s+(numOf(getField(r,key))??0),0):rows.length}
function distinctId(prefix,ui){const ids=new Set((ui.components||[]).map(c=>c.id));let id=prefix,n=2;while(ids.has(id))id=`${prefix}_${n++}`;return id}
function section(id,title,order,layout='wide',presentation='panel',columns){const s={id,title,presentation,layout,order};if(columns)s.columns=columns;return s}
function hasType(ui,type){return (ui.components||[]).some(c=>c.type===type)}
function hasTrend(ui){return (ui.components||[]).some(c=>['line_chart','area_chart','bar_chart'].includes(c.type)&&/(شهري|اتجاه|زمني|month|trend)/i.test(String(c.title||'')))}
function hasRanking(ui){return (ui.components||[]).some(c=>['bar_chart','pie_chart','table'].includes(c.type)&&/(عميل|عملاء|customer|ranking|أعلى|اعلى|أفضل|افضل)/i.test(String(c.title||'')))}
function kpiCount(ui){return (ui.components||[]).filter(c=>c.type==='kpi').length}
function chronologicalPairs(rows,labelKey,valKey){
  return rows.map(r=>({label:labelOf(getField(r,labelKey)),value:numOf(getField(r,valKey))})).filter(x=>x.label&&Number.isFinite(x.value)).sort((a,b)=>{const ad=Date.parse(a.label),bd=Date.parse(b.label);if(Number.isFinite(ad)&&Number.isFinite(bd))return ad-bd;return a.label.localeCompare(b.label)});
}
function rankedPairs(rows,labelKey,valKey,limit=10){return rows.map(r=>({label:labelOf(getField(r,labelKey)),value:numOf(getField(r,valKey)),row:r})).filter(x=>x.label&&Number.isFinite(x.value)).sort((a,b)=>b.value-a.value).slice(0,limit)}
function groupedPairs(rows,labelKey,valKey,limit=10){
  const grouped=new Map();
  for(const r of rows){const label=labelOf(getField(r,labelKey)).trim(),value=numOf(getField(r,valKey));if(!label||!Number.isFinite(value))continue;grouped.set(label,(grouped.get(label)||0)+value)}
  return [...grouped.entries()].map(([label,value])=>({label,value})).sort((a,b)=>b.value-a.value).slice(0,limit);
}
function validStatusDistribution(op){
  if(!op||!op.statusKey||!op.valueKey||!op.rows.length)return[];
  const pairs=groupedPairs(op.rows,op.statusKey,op.valueKey,6);
  // A distribution needs at least two genuinely different categories. Repeated raw rows
  // with the same state (e.g. six "invoiced" rows) are NOT a meaningful pie chart.
  if(pairs.length<2)return[];
  return pairs;
}
function requestedBroad(question){const q=String(question||'');return /(dashboard|لوحة|تقرير\s+مبيعات|تقرير\s+شامل|executive)/i.test(q)&&[/kpi|مؤشر/i,/شهري|اتجاه|monthly|trend/i,/عميل|عملاء|customer/i,/جدول|table/i,/تحليل|ملاحظات|insight/i].filter(re=>re.test(q)).length>=3}
function localRepair(ui,envelope){
  const report={applied:false,added:[],skipped:[],reason:null};if(!ui||!Array.isArray(ui.components)||!envelope||!requestedBroad(envelope.question))return report;
  const before=coverageStats(ui);if(!isThin(before))return report;
  const cat=operationCatalog(envelope);const monthly=cat.find(x=>x.rows.length&&x.dateKey&&x.valueKey);const customers=cat.find(x=>x.rows.length&&x.customerKey&&x.valueKey);const statusCandidates=cat.filter(x=>x.rows.length&&x.statusKey&&x.valueKey);const statusChoice=statusCandidates.map(x=>({op:x,pairs:validStatusDistribution(x)})).find(x=>x.pairs.length>=2)||null;
  const totalOp=cat.find(x=>x.rows.length&&x.valueKey&&x.rows.length<=3&&!x.dateKey&&!x.customerKey)||cat.find(x=>x.rows.length&&x.valueKey);
  let total=totalOp?sumField(totalOp.rows,totalOp.valueKey):0;let orders=0;
  const countOp=cat.find(x=>x.rows.length&&x.countKey&&x.rows.length<=3)||totalOp; if(countOp)orders=countRows(countOp.rows,countOp.countKey);
  if(!orders&&monthly&&monthly.countKey)orders=countRows(monthly.rows,monthly.countKey);
  const overview=section('executive_overview','المؤشرات التنفيذية الرئيسية',1,'strip','hero',4);
  while(kpiCount(ui)<3){
    const n=kpiCount(ui);let c=null;
    if(n===0&&total){c={type:'kpi',title:'إجمالي المبيعات',id:distinctId('kpi_total_sales',ui),value:total,format:'currency',currencyLabel:'ر.س',numberLocale:'en-US',icon:'revenue',section:overview}}
    else if(orders){c={type:'kpi',title:n===0?'عدد الطلبات المؤكدة':n===1?'عدد الطلبات المؤكدة':'متوسط قيمة الطلب',id:distinctId(n<=1?'kpi_order_count':'kpi_avg_order',ui),value:n<=1?orders:(total&&orders?total/orders:0),format:n<=1?'number':'currency',currencyLabel:n<=1?undefined:'ر.س',numberLocale:'en-US',icon:n<=1?'receipt':'chart',section:{id:'executive_overview',order:1}}}
    else if(total){c={type:'kpi',title:`مؤشر المبيعات ${n+1}`,id:distinctId(`kpi_sales_${n+1}`,ui),value:total,format:'currency',currencyLabel:'ر.س',numberLocale:'en-US',icon:'revenue',section:{id:'executive_overview',order:1}}}
    if(!c)break;if(c.currencyLabel===undefined)delete c.currencyLabel;ui.components.push(c);report.added.push(c.id);
  }
  if(!hasTrend(ui)&&monthly){const pairs=chronologicalPairs(monthly.rows,monthly.dateKey,monthly.valueKey);if(pairs.length){const c={type:'area_chart',title:'الاتجاه الشهري للمبيعات',id:distinctId('monthly_sales_trend',ui),categories:pairs.map(x=>x.label),series:[{name:'المبيعات',data:pairs.map(x=>x.value)}],componentLayout:{chartHeight:'340px',legendPosition:'none'},section:section('time_trend','الاتجاه الزمني للمبيعات',2,'wide','editorial')};ui.components.push(c);report.added.push(c.id)}}
  if(!hasRanking(ui)&&customers){const pairs=rankedPairs(customers.rows,customers.customerKey,customers.valueKey,10);if(pairs.length){const c={type:'bar_chart',title:'أعلى العملاء من حيث المبيعات',id:distinctId('top_customers_chart',ui),categories:pairs.map(x=>x.label),series:[{name:'المبيعات',data:pairs.map(x=>x.value)}],componentLayout:{chartHeight:'320px',legendPosition:'none'},section:section('customer_analysis','تحليل العملاء',3,'split','panel')};ui.components.push(c);report.added.push(c.id)}}
  if(!hasType(ui,'table')&&customers){const pairs=rankedPairs(customers.rows,customers.customerKey,customers.valueKey,10);if(pairs.length){const cols=['العميل','إجمالي المبيعات (ر.س)'];if(customers.countKey)cols.push('عدد الطلبات');const rows=pairs.map(x=>{const r=[x.label,x.value];if(customers.countKey)r.push(numOf(getField(x.row,customers.countKey))??0);return r});const c={type:'table',title:'جدول تفصيلي — أبرز العملاء',id:distinctId('top_customers_table',ui),columns:cols,rows,section:section('detail_table','تفاصيل العملاء',4,'wide','plain')};ui.components.push(c);report.added.push(c.id)}}
  if(!ui.components.some(c=>c.type==='pie_chart')){
    if(statusChoice){const pairs=statusChoice.pairs;const c={type:'pie_chart',title:'توزيع المبيعات بحسب الحالة',id:distinctId('sales_status_pie',ui),categories:pairs.map(x=>x.label),series:[{name:'القيمة',data:pairs.map(x=>x.value)}],componentLayout:{chartHeight:'280px',legendPosition:'bottom'},section:{id:'customer_analysis',order:3}};ui.components.push(c);report.added.push(c.id)}
    else if(statusCandidates.length)report.skipped.push('sales_status_pie:no_distinct_status_categories');
  }
  if(!hasType(ui,'insight')){
    const items=[];
    if(customers&&total){const top=rankedPairs(customers.rows,customers.customerKey,customers.valueKey,1)[0];if(top)items.push({text:`أعلى عميل هو ${top.label} بمبيعات ${top.value.toLocaleString('en-US',{maximumFractionDigits:2})} ر.س، بما يعادل ${(top.value/total*100).toFixed(1)}% من الإجمالي.`})}
    if(monthly){const peak=rankedPairs(monthly.rows,monthly.dateKey,monthly.valueKey,1)[0];if(peak)items.push({text:`أعلى فترة مبيعات ضمن البيانات المسترجعة هي ${peak.label} بقيمة ${peak.value.toLocaleString('en-US',{maximumFractionDigits:2})} ر.س.`})}
    if(total&&orders)items.push({text:`متوسط قيمة الطلب المحسوب من الإجمالي وعدد الطلبات هو ${(total/orders).toLocaleString('en-US',{maximumFractionDigits:2})} ر.س.`});
    if(items.length){const c={type:'insight',title:'أبرز الملاحظات التنفيذية',id:distinctId('executive_insights',ui),items:items.slice(0,5),section:section('insights_section','الملاحظات التنفيذية',5,'wide','accent')};ui.components.push(c);report.added.push(c.id)}
  }
  report.applied=report.added.length>0;report.reason=report.applied?'llm_output_was_thin':'no_safe_local_components_available';return report;
}
function coverageStats(ui){const comps=Array.isArray(ui?.components)?ui.components:[];const types=comps.map(c=>c?.type);return{components:comps.length,kpis:types.filter(t=>t==='kpi').length,hasTrend:hasTrend(ui),hasRanking:hasRanking(ui),hasTable:types.includes('table'),hasInsight:types.includes('insight')}}
function isThin(stats){return stats.components<6||stats.kpis<3||!stats.hasTrend||!stats.hasRanking||!stats.hasTable||!stats.hasInsight}
function addMetadata(payload,diag,envelope){if(!Array.isArray(payload?.content))return payload;for(const block of payload.content){if(block&&block.type==='text'&&typeof block.text==='string'){try{const ui=JSON.parse(block.text);diag.binding=hydrateUi(ui,envelope);const preRepair=coverageStats(ui);diag.initialThin=isThin(preRepair);diag.localRepair=localRepair(ui,envelope);const stats=coverageStats(ui);diag.finalThin=isThin(stats);diag.coverage=stats;ui.sectionDesignLanguageVersion='3.5.1';ui.structuredCoverageGuardVersion='3.5.1';ui.presentationPerformance=diag;ui.dataBindingVersion='1.1';ui.localCoverageRepairVersion='1.1';block.text=JSON.stringify(ui)}catch(e){console.error('section-design-v351 metadata/repair error:',e.message)}}}return payload}
async function timedFetch(url,options,diag){const started=Date.now();const response=await upstreamFetch(url,options);const ended=Date.now();diag.attempts.push({label:'initial',durationMs:ended-started,durationSeconds:secs(ended-started),httpStatus:response.status});console.log(`[PERF:PRESENT] v351 initial=${secs(ended-started)}s status=${response.status}`);return response}

global.fetch=async function sectionDesignFetch(url,options={}){
  let body=null,isPresentation=false,envelope=null;
  try{if(String(url).includes('api.anthropic.com/v1/messages')&&options.body){body=JSON.parse(options.body);isPresentation=isPresentationBody(body);if(isPresentation){envelope=extractEnvelope(body);const msg=lastMessage(body);if(msg&&typeof msg.content==='string'&&!msg.content.includes('SECTION DESIGN LANGUAGE V3.3'))msg.content+=SECTION_INSTRUCTION;options={...options,body:JSON.stringify(body)}}}}catch(e){console.error('section-design-v351 request inspection error:',e.message)}
  if(!isPresentation)return upstreamFetch(url,options);
  const totalStarted=Date.now();const diag={version:'3.0',mode:'compact_binding_with_local_repair',maxFullRetries:MAX_FULL_RETRIES,attempts:[]};
  const response=await timedFetch(url,options,diag);if(!response.ok)return response;
  try{const payload=await response.clone().json();diag.totalDurationMs=Date.now()-totalStarted;diag.totalDurationSeconds=secs(diag.totalDurationMs);diag.attemptCount=1;addMetadata(payload,diag,envelope);console.log(`[PERF:PRESENT] v351 total=${diag.totalDurationSeconds}s bound=${diag.binding?.bound||0}/${diag.binding?.total||0} repaired=${diag.localRepair?.added?.length||0}`);return responseFromPayload(payload,response)}catch(e){console.error('section-design-v351 response error:',e.message);return response}
};
