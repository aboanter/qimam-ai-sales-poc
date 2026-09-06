// Generative Section Design Language V3.2 — lets the presentation model author section hierarchy.
require('./structured-preload.js');

const upstreamFetch = global.fetch;
const PRESENTATION_SYSTEM = 'You output only the JSON object described in the instructions below — no other text.';

const SECTION_INSTRUCTION = `\n\nSECTION DESIGN LANGUAGE V3.2 — GENERATIVE REPORT COMPOSITION:\n- IMPORTANT: section design is an ENRICHMENT layer, never a reason to remove analytical content. Preserve every explicitly requested output and every distinct analysis goal already supported by the supplied evidence.\n- If the user asks for a summary with key KPIs + a trend + a ranking/top customers + analysis/insights, the final report MUST contain distinct components covering those asks. Do not collapse a multi-part dashboard into a single hero KPI.\n- For designed dashboards/reports with multiple analytical goals, normally compose 3-6 meaningful visual sections instead of a flat sequence of components. This is not a fixed template; section count should follow the story.\n- Section composition is authored by YOU, not selected from fixed report templates. Decide hierarchy from the analytical story and the user's design request.\n- Put an optional \"section\" object INSIDE each component's data JSON. Components that belong together repeat the same section id and section metadata.\n- section object: {\"id\":\"executive_overview\",\"title\":\"نظرة تنفيذية\",\"subtitle\":\"أهم مؤشرات الأداء للعام\",\"presentation\":\"hero|editorial|panel|plain|accent\",\"layout\":\"grid|split|stack|strip|wide\",\"columns\":2|3|4,\"ratio\":\"1:1|2:1|1:2|3:2|2:3\",\"order\":1}.\n- Use section titles/subtitles only when they improve hierarchy. Do not repeat component titles verbatim.\n- presentation is visual intent: hero = dominant opening section; editorial = strong narrative section with generous spacing; panel = contained analytical surface; plain = minimal structure; accent = selectively emphasized section.\n- layout is the internal composition of that section. Use wide/stack for dense tables on narrow screens; use split only when both sides remain useful at realistic widths.\n- A KPI hero may dominate a section while supporting KPIs sit beneath or beside it. A dense customer table should NOT be squeezed beside a chart on mobile.\n- Keep section order intentional: executive signal first, supporting analysis next, details later, insights/conclusions last when appropriate. This is a principle, not a mandatory template.\n- Never use section metadata to hide, merge away, or omit a requested chart/table/KPI. The design hierarchy must sit on top of the analytical coverage, not replace it.\n- If the user explicitly asks for a visual hierarchy or page structure, treat it as a hard requirement.\n- For a designed dashboard, section metadata SHOULD normally be present on most components.\n- Do not put executable HTML/CSS/JS in section metadata.`;

function isPresentationBody(body){return body && body.system===PRESENTATION_SYSTEM && Array.isArray(body.messages);}

global.fetch = async function sectionDesignFetch(url, options={}) {
  let isPresentation=false;
  try {
    if(String(url).includes('api.anthropic.com/v1/messages') && options.body){
      const body=JSON.parse(options.body);
      isPresentation=isPresentationBody(body);
      if(isPresentation){
        const msg=body.messages[body.messages.length-1];
        if(msg && typeof msg.content==='string' && !msg.content.includes('SECTION DESIGN LANGUAGE V3.2')) msg.content += SECTION_INSTRUCTION;
        options={...options,body:JSON.stringify(body)};
      }
    }
  } catch(e){ console.error('section-design-v32 request inspection error:',e.message); }
  const response=await upstreamFetch(url,options);
  if(!isPresentation || !response.ok) return response;
  try{
    const payload=await response.clone().json();
    if(Array.isArray(payload.content)){
      for(const block of payload.content){
        if(block && block.type==='text' && typeof block.text==='string'){
          const ui=JSON.parse(block.text);
          ui.sectionDesignLanguageVersion='3.2';
          block.text=JSON.stringify(ui);
        }
      }
    }
    const headers=new Headers(response.headers);headers.set('content-type','application/json');
    return new Response(JSON.stringify(payload),{status:response.status,statusText:response.statusText,headers});
  }catch(e){console.error('section-design-v32 response metadata error:',e.message);return response;}
};
