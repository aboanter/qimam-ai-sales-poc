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
  const extra=`\n\nIMPORTANT STRUCTURED-OUTPUT ADAPTER:\nEach component is exactly {type,title,data}. Put ALL component-specific properties inside data as a JSON-encoded string.\n\nGENERATIVE DESIGN REQUIREMENTS:\n- Explicit user design instructions are mandatory, not optional. If the user asks for watermark icons, EVERY relevant KPI must include a watermark plus watermarkStyle. If the user asks for icons, include icon plus iconStyle. If the user asks for English digits, use numberLocale=\"en-US\".\n- Do not fall back to identical generic KPI cards. Generate visual decisions from meaning and user wording.\n- KPI data may include: value, format, numberLocale, currencyLabel, icon, watermark, style, titleStyle, valueStyle, iconStyle, watermarkStyle.\n- style objects are CSS-like safe visual properties only. Prefer tasteful gradients/background colors, adequate contrast, borders/shadows/radius, and responsive-friendly sizes.\n- A watermark should be visually obvious but subtle: usually fontSize 58px-96px, opacity .06-.16, positioned by the renderer. Use a different meaningful glyph from the normal icon when useful.\n\nKPI data example:\n{\"value\":3206106.07,\"format\":\"currency\",\"numberLocale\":\"en-US\",\"currencyLabel\":\"SAR\",\"icon\":\"💰\",\"watermark\":\"↗\",\"style\":{\"background\":\"linear-gradient(135deg,#e9fbf8,#ffffff)\",\"color\":\"#073754\",\"border\":\"1px solid #bde7e4\",\"borderRadius\":\"22px\",\"boxShadow\":\"0 10px 26px rgba(8,83,92,.10)\"},\"valueStyle\":{\"fontSize\":\"clamp(26px,7vw,42px)\",\"fontWeight\":\"800\"},\"watermarkStyle\":{\"fontSize\":\"82px\",\"opacity\":\"0.10\"}}\n\nSIZE RULES:\n- Prefer 4-8 components, max 8. Summary max 3 concise Arabic sentences.\n- Charts normally max 12 categories/points. Tables max 10 rows.\n- Avoid repeating the same facts in multiple components unless needed.`;
  if(Array.isArray(body.messages)&&body.messages.length){const last=body.messages[body.messages.length-1];if(typeof last.content==='string')last.content+=extra;}
}
function inflateUiObject(obj){if(!obj||!Array.isArray(obj.components))return obj;obj.components=obj.components.map(c=>{let extra={};try{extra=c.data?JSON.parse(c.data):{}}catch(e){throw new Error(`Invalid component data JSON for ${c.type}: ${e.message}`)}return{type:c.type,title:c.title,...extra}});return obj;}

global.fetch=async function(url,options={}){
  let isPresentation=false;
  try{
    if(String(url).includes('api.anthropic.com/v1/messages')&&options.body){const body=JSON.parse(options.body);isPresentation=body.system===PRESENTATION_SYSTEM;if(isPresentation){body.max_tokens=6000;addCompactSchemaInstruction(body);body.output_config={format:{type:'json_schema',schema:uiSchema}};options={...options,body:JSON.stringify(body)};}}
  }catch(e){console.error('structured-preload request inspection error:',e.message)}
  const response=await originalFetch(url,options);if(!isPresentation||!response.ok)return response;
  try{const payload=await response.clone().json();if(!Array.isArray(payload.content))return response;for(const block of payload.content){if(block&&block.type==='text'&&typeof block.text==='string'){const compact=JSON.parse(block.text);block.text=JSON.stringify(inflateUiObject(compact));}}const headers=new Headers(response.headers);headers.set('content-type','application/json');return new Response(JSON.stringify(payload),{status:response.status,statusText:response.statusText,headers});}catch(e){console.error('structured-preload response inflation error:',e.message);return response;}
};
require('./server.js');
