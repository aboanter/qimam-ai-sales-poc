// Generative Section Design Language V3.2 — lets the presentation model author section hierarchy.
require('./coverage-schema-preload.js');

const upstreamFetch = global.fetch;
const PRESENTATION_SYSTEM = 'You output only the JSON object described in the instructions below — no other text.';

const SECTION_INSTRUCTION = `\n\nSECTION DESIGN LANGUAGE V3.2 — GENERATIVE REPORT COMPOSITION:\n- IMPORTANT: section design is an ENRICHMENT layer, never a reason to remove analytical content. Preserve every explicitly requested output and every distinct analysis goal already supported by the supplied evidence.\n- If the user asks for a summary with key KPIs + a trend + a ranking/top customers + analysis/insights, the final report MUST contain distinct components covering those asks. Do not collapse a multi-part dashboard into a single hero KPI.\n- For designed dashboards/reports with multiple analytical goals, normally compose 3-6 meaningful visual sections instead of a flat sequence of components. This is not a fixed template; section count should follow the story.\n- Section composition is authored by YOU, not selected from fixed report templates. Decide hierarchy from the analytical story and the user's design request.\n- Put an optional \"section\" object INSIDE each component's data JSON. Components that belong together repeat the same section id and section metadata.\n- section object: {\"id\":\"executive_overview\",\"title\":\"نظرة تنفيذية\",\"subtitle\":\"أهم مؤشرات الأداء للعام\",\"presentation\":\"hero|editorial|panel|plain|accent\",\"layout\":\"grid|split|stack|strip|wide\",\"columns\":2|3|4,\"ratio\":\"1:1|2:1|1:2|3:2|2:3\",\"order\":1}.\n- Use section titles/subtitles only when they improve hierarchy. Do not repeat component titles verbatim.\n- presentation is visual intent: hero = dominant opening section; editorial = strong narrative section with generous spacing; panel = contained analytical surface; plain = minimal structure; accent = selectively emphasized section.\n- layout is the internal composition of that section. Use wide/stack for dense tables on narrow screens; use split only when both sides remain useful at realistic widths.\n- A KPI hero may dominate a section while supporting KPIs sit beneath or beside it. A dense customer table should NOT be squeezed beside a chart on mobile.\n- Keep section order intentional: executive signal first, supporting analysis next, details later, insights/conclusions last when appropriate. This is a principle, not a mandatory template.\n- Never use section metadata to hide, merge away, or omit a requested chart/table/KPI. The design hierarchy must sit on top of the analytical coverage, not replace it.\n- If the user explicitly asks for a visual hierarchy or page structure, treat it as a hard requirement.\n- For a designed dashboard, section metadata SHOULD normally be present on most components.\n- Do not put executable HTML/CSS/JS in section metadata.`;

const CORRECTION_INSTRUCTION = `\n\nSECTION DESIGN COVERAGE CORRECTION — REQUIRED:\nThe previous draft failed the dashboard coverage check. Rebuild the COMPLETE report from the same supplied evidence.\n- This is not a request for one summary KPI. Return the full dashboard.\n- Include distinct components for every requested class that evidence supports: multiple KPI cards, time trend chart, top-customer/ranking chart, detailed table, and insight/analysis component.\n- For a broad executive dashboard, target 7-11 meaningful components, with at least 3 KPI cards plus the requested analytical components.\n- Do not merge a requested table, chart, ranking, or insight into prose.\n- Organize components into meaningful section metadata.\n- Keep all facts grounded in the supplied MCP evidence. Do not invent values.\n- Return the complete JSON report only.`;

function isPresentationBody(body){return body && body.system===PRESENTATION_SYSTEM && Array.isArray(body.messages);}
function lastMessage(body){return Array.isArray(body?.messages)?body.messages[body.messages.length-1]:null;}
function requestedCoverage(text){
  const s=String(text||'').toLowerCase();
  const groups=[
    /(kpi|مؤشر|مؤشرات|إجمالي المبيعات|عدد الطلبات|متوسط قيمة الطلب)/i,
    /(اتجاه|شهري|الشهرية|trend|monthly)/i,
    /(أعلى العملاء|افضل العملاء|أفضل العملاء|top customers|ranking|ترتيب العملاء)/i,
    /(جدول|تفصيلي|table|details)/i,
    /(ملاحظات|تحليل|تحليلات|insight|analysis|استراتيجي)/i
  ];
  return groups.reduce((n,re)=>n+(re.test(s)?1:0),0);
}
function uiFromPayload(payload){
  if(!Array.isArray(payload?.content))return null;
  for(const block of payload.content){if(block&&block.type==='text'&&typeof block.text==='string'){try{return JSON.parse(block.text)}catch{}}}
  return null;
}
function semanticScore(ui){
  const comps=Array.isArray(ui?.components)?ui.components:[];
  const types=comps.map(c=>String(c?.type||''));
  let score=Math.min(comps.length,12);
  const kpis=types.filter(t=>t==='kpi').length;
  if(kpis>=3)score+=6;else score+=kpis;
  if(comps.some(c=>['line_chart','area_chart','bar_chart'].includes(c?.type)&&/(شهري|اتجاه|monthly|trend|month)/i.test(String(c?.title||''))))score+=5;
  if(comps.some(c=>['bar_chart','pie_chart','table'].includes(c?.type)&&/(أعلى|اعلى|أفضل|افضل|عميل|عملاء|customer|top|ranking)/i.test(String(c?.title||''))))score+=5;
  if(types.includes('table'))score+=5;
  if(types.includes('insight'))score+=5;
  const sections=new Set(comps.map(c=>c?.section?.id).filter(Boolean));
  score+=Math.min(sections.size,5);
  return score;
}
function isThinDashboard(ui,body){
  const msg=lastMessage(body),coverage=requestedCoverage(msg?.content);
  if(coverage<3)return false;
  const comps=Array.isArray(ui?.components)?ui.components:[];
  const kpis=comps.filter(c=>c?.type==='kpi').length;
  const hasTrend=comps.some(c=>['line_chart','area_chart','bar_chart'].includes(c?.type)&&/(شهري|اتجاه|monthly|trend|month)/i.test(String(c?.title||'')));
  const hasRanking=comps.some(c=>['bar_chart','pie_chart','table'].includes(c?.type)&&/(أعلى|اعلى|أفضل|افضل|عميل|عملاء|customer|top|ranking)/i.test(String(c?.title||'')));
  const hasTable=comps.some(c=>c?.type==='table');
  const hasInsight=comps.some(c=>c?.type==='insight');
  return comps.length<6 || kpis<3 || !hasTrend || !hasRanking || !hasTable || !hasInsight;
}
function addMetadataToPayload(payload){
  if(!Array.isArray(payload?.content))return payload;
  for(const block of payload.content){
    if(block&&block.type==='text'&&typeof block.text==='string'){
      try{const ui=JSON.parse(block.text);ui.sectionDesignLanguageVersion='3.2';ui.structuredCoverageGuardVersion='3.2.3';block.text=JSON.stringify(ui);}catch{}
    }
  }
  return payload;
}
function responseFromPayload(payload,response){
  const headers=new Headers(response.headers);headers.set('content-type','application/json');
  return new Response(JSON.stringify(payload),{status:response.status,statusText:response.statusText,headers});
}

global.fetch = async function sectionDesignFetch(url, options={}) {
  let isPresentation=false,preparedBody=null;
  try {
    if(String(url).includes('api.anthropic.com/v1/messages') && options.body){
      const body=JSON.parse(options.body);
      isPresentation=isPresentationBody(body);
      if(isPresentation){
        const msg=lastMessage(body);
        if(msg && typeof msg.content==='string' && !msg.content.includes('SECTION DESIGN LANGUAGE V3.2')) msg.content += SECTION_INSTRUCTION;
        preparedBody=body;
        options={...options,body:JSON.stringify(body)};
      }
    }
  } catch(e){ console.error('section-design-v32 request inspection error:',e.message); }

  let response=await upstreamFetch(url,options);
  if(!isPresentation || !response.ok) return response;

  try{
    let payload=await response.clone().json();
    let ui=uiFromPayload(payload);
    let best={response,payload,ui,score:semanticScore(ui)};
    if(preparedBody && isThinDashboard(ui,preparedBody)){
      for(let attempt=1;attempt<=3;attempt++){
        const retryBody=JSON.parse(JSON.stringify(preparedBody));
        const msg=lastMessage(retryBody);
        if(msg&&typeof msg.content==='string'){
          msg.content+=CORRECTION_INSTRUCTION+`\n\nCOVERAGE RETRY ${attempt}/3 — The candidate must pass all coverage checks before returning.`;
          if(best.ui)msg.content+=`\nPrevious thin candidate had ${Array.isArray(best.ui.components)?best.ui.components.length:0} components. Expand the report rather than shortening it.`;
        }
        const retry=await upstreamFetch(url,{...options,body:JSON.stringify(retryBody)});
        if(!retry.ok)continue;
        const retryPayload=await retry.clone().json();
        const retryUi=uiFromPayload(retryPayload);
        const score=semanticScore(retryUi);
        if(score>best.score)best={response:retry,payload:retryPayload,ui:retryUi,score};
        if(retryUi && !isThinDashboard(retryUi,preparedBody)){best={response:retry,payload:retryPayload,ui:retryUi,score};break;}
      }
      response=best.response;payload=best.payload;ui=best.ui;
    }
    addMetadataToPayload(payload);
    return responseFromPayload(payload,response);
  }catch(e){console.error('section-design-v32 response metadata/retry error:',e.message);return response;}
};
