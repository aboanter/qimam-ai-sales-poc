// Runtime wrapper for the live Claude POC.
if (!process.env.ANTHROPIC_MODEL) process.env.ANTHROPIC_MODEL = 'claude-sonnet-4-6';

const NativeAbortController = global.AbortController;
if (NativeAbortController) {
  global.AbortController = class RelaxedAbortController extends NativeAbortController {
    abort(reason) { setTimeout(() => super.abort(reason), 90000); }
  };
}

const originalFetch = global.fetch;
const uiSchema = {
  type:'object', additionalProperties:false, required:['title','summary','components'],
  properties:{
    title:{type:'string'}, summary:{type:'string'},
    components:{type:'array',items:{type:'object',additionalProperties:false,required:['type','title','data'],properties:{
      type:{type:'string',enum:['kpi','table','bar_chart','line_chart','area_chart','pie_chart','scatter_chart','insight']},
      title:{type:'string'}, data:{type:'string'}
    }}}
  }
};
const PRESENTATION_SYSTEM='You output only the JSON object described in the instructions below — no other text.';

function addCompactSchemaInstruction(body){
  const extra=`\n\nIMPORTANT STRUCTURED-OUTPUT ADAPTER:\nEach component is exactly {type,title,data}. Put ALL component-specific properties inside data as a JSON-encoded string.\n\nGENERATIVE UI V2 — DESIGN THE COMPOSITION, NOT JUST COLORS:\n- The factual component types stay stable for safety, but you are the visual composer. Every component MAY include a layout object. Use it to create hierarchy and variety rather than a repetitive stack of equal cards.\n- layout may include: {\"span\":1|2|3|4,\"minHeight\":\"...\",\"align\":\"start|center|end\",\"variant\":\"hero|feature|compact|quiet\",\"order\":number}. span is relative visual importance; on narrow mobile the renderer may collapse spans responsively.\n- For KPI, layout.variant=hero means the metric is visually dominant. Use hero only for the 1-2 most important metrics. compact is for secondary metrics. feature is medium emphasis. Do NOT make every KPI a large colored rectangle.\n- You may use transparent/white/minimal KPI surfaces, colored accent edges, soft gradients, asymmetric padding, large typography, or strong whitespace. Choose based on meaning and user request.\n- Treat the whole result as one coherent editorial dashboard: hierarchy, rhythm, whitespace, contrast and relationships matter.\n- If the user asks you to design freely, visibly vary composition, scale and emphasis. Merely changing card colors is NOT sufficient.\n\nGENERATIVE DESIGN REQUIREMENTS:\n- Explicit user design instructions are mandatory. If the user asks for watermark icons, EVERY relevant KPI must include a watermark. If the user asks for icons, include icons. If the user asks for English digits, use numberLocale=\"en-US\".\n- KPI data may include: value, format, numberLocale, currencyLabel, icon, watermark, style, titleStyle, valueStyle, iconStyle, watermarkStyle, layout.\n- style objects are CSS-like safe visual properties only. Prefer intentional contrast, spacing and typography.\n- Prefer MODERN VECTOR ICON OBJECTS rather than emoji strings. Icon object example: {\"name\":\"trend\",\"size\":40,\"strokeWidth\":1.8,\"color\":\"#ffffff\",\"background\":\"rgba(255,255,255,.14)\",\"radius\":\"14px\"}. Supported semantic names: trend, revenue, receipt, return, profit, warning, users, cart, invoice, chart, wallet, check, clock, spark.\n- Watermark object example: {\"name\":\"chart\",\"size\":120,\"strokeWidth\":1.2,\"opacity\":0.09,\"rotation\":-8}. Make it large and subtle.\n- Avoid emoji unless the user explicitly asks for emoji.\n\nKPI hero example data:\n{\"value\":3206106.07,\"format\":\"currency\",\"numberLocale\":\"en-US\",\"currencyLabel\":\"SAR\",\"layout\":{\"span\":2,\"variant\":\"hero\",\"minHeight\":\"220px\",\"align\":\"start\"},\"icon\":{\"name\":\"revenue\",\"size\":46,\"strokeWidth\":1.6,\"color\":\"#ffffff\",\"background\":\"rgba(255,255,255,.13)\",\"radius\":\"16px\"},\"watermark\":{\"name\":\"chart\",\"size\":150,\"strokeWidth\":1.0,\"opacity\":0.07,\"rotation\":-8},\"style\":{\"background\":\"linear-gradient(135deg,#073754,#0b9da6)\",\"color\":\"#ffffff\",\"border\":\"0\",\"borderRadius\":\"28px\",\"boxShadow\":\"0 18px 44px rgba(7,55,84,.16)\",\"padding\":\"26px\"},\"valueStyle\":{\"fontSize\":\"clamp(38px,9vw,68px)\",\"fontWeight\":\"800\"}}\n\nSTRICT CHART CONTRACT — MUST FOLLOW:\n- For bar_chart, line_chart, area_chart and pie_chart, data MUST use this exact shape: {\"categories\":[\"Jan\",\"Feb\"],\"series\":[{\"name\":\"المبيعات\",\"data\":[1200,1500]}],\"layout\":{\"span\":4,\"variant\":\"feature\"}}.\n- categories MUST be an array of strings or numbers only. NEVER put objects inside categories.\n- series MUST be an array of objects with name as text and data as an array of NUMBERS only. NEVER put objects inside series.data.\n- Do not use datasets, points, x/y objects, or arbitrary row objects for bar/line/area/pie charts.\n- For scatter_chart only, use points:[{\"x\":1,\"y\":2,\"label\":\"...\"}] with numeric x/y.\n\nSTRICT TABLE CONTRACT:\n- columns is an array of strings. rows is an array of arrays. Every cell MUST be primitive. layout may be included.\n\nSIZE RULES:\n- Prefer 4-8 components, max 8. Summary max 3 concise Arabic sentences.\n- Charts normally max 12 categories/points. Tables max 10 rows.\n- Avoid repeating the same facts in multiple components unless needed.`;
  if(Array.isArray(body.messages)&&body.messages.length){const last=body.messages[body.messages.length-1];if(typeof last.content==='string')last.content+=extra;}
}

function primitiveLabel(v){
  if(v==null) return '';
  if(['string','number','boolean'].includes(typeof v)) return v;
  if(Array.isArray(v)) return primitiveLabel(v[1] ?? v[0]);
  if(typeof v==='object'){
    for(const k of ['label','name','category','month','period','date','title','x']) if(v[k]!=null) return primitiveLabel(v[k]);
    for(const val of Object.values(v)) if(['string','number','boolean'].includes(typeof val)) return val;
    return JSON.stringify(v);
  }
  return String(v);
}
function numericValue(v){
  if(typeof v==='number' && Number.isFinite(v)) return v;
  if(typeof v==='string') { const n=Number(v.replace(/,/g,'')); if(Number.isFinite(n)) return n; }
  if(v && typeof v==='object'){
    for(const k of ['value','y','amount','total','sales','revenue','expenses','profit','count','qty','quantity']){
      if(v[k]!=null){ const n=numericValue(v[k]); if(Number.isFinite(n)) return n; }
    }
    for(const val of Object.values(v)){ const n=numericValue(val); if(Number.isFinite(n)) return n; }
  }
  return 0;
}
function cleanComponent(c){
  if(!c || typeof c!=='object') return c;
  const type=c.type||'';
  if(c.layout && typeof c.layout==='object'){
    const span=Math.max(1,Math.min(Number(c.layout.span)||1,4));
    const variant=['hero','feature','compact','quiet'].includes(c.layout.variant)?c.layout.variant:'feature';
    const align=['start','center','end'].includes(c.layout.align)?c.layout.align:'start';
    c.layout={span,variant,align,minHeight:typeof c.layout.minHeight==='string'?c.layout.minHeight.slice(0,30):'',order:Number.isFinite(Number(c.layout.order))?Number(c.layout.order):0};
  }
  if(['bar_chart','line_chart','area_chart','pie_chart'].includes(type)){
    if(Array.isArray(c.categories)) c.categories=c.categories.map(primitiveLabel);
    if(Array.isArray(c.series)) c.series=c.series.map((s,i)=>({...s,name:primitiveLabel(s?.name ?? s?.label ?? `Series ${i+1}`),data:Array.isArray(s?.data)?s.data.map(numericValue):[]}));
    if((!Array.isArray(c.categories)||!c.categories.length) && Array.isArray(c.data) && c.data.length && c.data.every(r=>r&&typeof r==='object'&&!Array.isArray(r))){
      const rows=c.data, keys=Object.keys(rows[0]||{}), labelKey=keys.find(k=>['label','name','category','month','period','date','x'].includes(k))||keys.find(k=>typeof rows[0][k]==='string');
      const numberKeys=keys.filter(k=>k!==labelKey && rows.some(r=>Number.isFinite(numericValue(r[k]))));
      c.categories=rows.map(r=>primitiveLabel(r[labelKey]));
      c.series=numberKeys.slice(0,4).map(k=>({name:k,data:rows.map(r=>numericValue(r[k]))}));
    }
  }
  if(type==='scatter_chart' && Array.isArray(c.points)) c.points=c.points.map(p=>({x:numericValue(p?.x),y:numericValue(p?.y),label:primitiveLabel(p?.label??'')}));
  if(type==='table'){
    c.columns=Array.isArray(c.columns)?c.columns.map(v=>String(primitiveLabel(v))):[];
    if(Array.isArray(c.rows)) c.rows=c.rows.map(row=>Array.isArray(row)?row.map(primitiveLabel):(row&&typeof row==='object'?(c.columns.length?c.columns.map(col=>primitiveLabel(row[col])):Object.values(row).map(primitiveLabel)):[primitiveLabel(row)]));
  }
  return c;
}
function inflateUiObject(obj){
  if(!obj||!Array.isArray(obj.components))return obj;
  obj.components=obj.components.map(c=>{let extra={};try{extra=c.data?JSON.parse(c.data):{}}catch(e){throw new Error(`Invalid component data JSON for ${c.type}: ${e.message}`)}return cleanComponent({type:c.type,title:c.title,...extra});});
  obj.generativeUiVersion=2;
  return obj;
}

global.fetch=async function(url,options={}){
  let isPresentation=false;
  try{
    if(String(url).includes('api.anthropic.com/v1/messages')&&options.body){const body=JSON.parse(options.body);isPresentation=body.system===PRESENTATION_SYSTEM;if(isPresentation){body.max_tokens=6000;addCompactSchemaInstruction(body);body.output_config={format:{type:'json_schema',schema:uiSchema}};options={...options,body:JSON.stringify(body)};}}
  }catch(e){console.error('structured-preload request inspection error:',e.message)}
  const response=await originalFetch(url,options);if(!isPresentation||!response.ok)return response;
  try{const payload=await response.clone().json();if(!Array.isArray(payload.content))return response;for(const block of payload.content){if(block&&block.type==='text'&&typeof block.text==='string'){const compact=JSON.parse(block.text);block.text=JSON.stringify(inflateUiObject(compact));}}const headers=new Headers(response.headers);headers.set('content-type','application/json');return new Response(JSON.stringify(payload),{status:response.status,statusText:response.statusText,headers});}catch(e){console.error('structured-preload response inflation error:',e.message);return response;}
};
require('./server.js');
