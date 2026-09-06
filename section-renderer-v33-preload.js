// Section Renderer V3.3 presentation contract — makes section intent deliberate without changing factual analysis.
require('./section-design-v32-preload.js');

const upstreamFetch=global.fetch;
const PRESENTATION_SYSTEM='You output only the JSON object described in the instructions below — no other text.';
const V33_INSTRUCTION=`\n\nSECTION RENDERER V3.3 — VISUAL HIERARCHY CONTRACT:\n- The renderer now gives section.presentation a strong visual meaning. Choose it deliberately from hero|editorial|panel|plain|accent; do not assign hero to every section.\n- hero is reserved for the dominant executive opening and should normally appear at most once.\n- editorial is for a narrative/trend section that benefits from breathing room and a stronger heading.\n- panel is for contained analytical groups such as customer analysis, comparisons, or operational breakdowns.\n- accent is for conclusions, warnings, recommendations, or a selectively emphasized closing section.\n- plain is for detail-heavy content where decoration would distract.\n- section.layout and ratio are authoritative desktop composition hints; use split only for two compatible components. Use wide/stack for tables and dense detail.\n- On mobile, split/grid sections collapse safely. Design for both desktop and mobile without omitting content.\n- Keep visual hierarchy semantically meaningful: strongest signal first, supporting evidence next, dense detail later, insights/conclusion last when appropriate. This is not a fixed template.\n- Do not change or invent facts to improve the design. Presentation remains subordinate to the authoritative MCP/Analyst evidence.`;

function isPresentation(body){return body&&body.system===PRESENTATION_SYSTEM&&Array.isArray(body.messages)}

global.fetch=async function sectionRendererV33Fetch(url,options={}){
  let presentation=false;
  try{
    if(String(url).includes('api.anthropic.com/v1/messages')&&options.body){
      const body=JSON.parse(options.body);presentation=isPresentation(body);
      if(presentation){const msg=body.messages[body.messages.length-1];if(msg&&typeof msg.content==='string'&&!msg.content.includes('SECTION RENDERER V3.3'))msg.content+=V33_INSTRUCTION;options={...options,body:JSON.stringify(body)}}
    }
  }catch(e){console.error('section-renderer-v33 request inspection error:',e.message)}
  const response=await upstreamFetch(url,options);
  if(!presentation||!response.ok)return response;
  try{
    const payload=await response.clone().json();
    if(Array.isArray(payload.content))for(const block of payload.content){if(block&&block.type==='text'&&typeof block.text==='string'){try{const ui=JSON.parse(block.text);ui.sectionRendererVersion='3.3';block.text=JSON.stringify(ui)}catch{}}}
    const headers=new Headers(response.headers);headers.set('content-type','application/json');
    return new Response(JSON.stringify(payload),{status:response.status,statusText:response.statusText,headers});
  }catch(e){console.error('section-renderer-v33 response metadata error:',e.message);return response}
};
