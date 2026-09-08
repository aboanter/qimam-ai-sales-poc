// Structured coverage guard V3.3.1 — final compact breadth contract after structured prompt expansion.
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

const FINAL_COMPACT_V33 = `\n\nFINAL COMPACT DASHBOARD CONTRACT V3.3.1 — HIGHEST PRIORITY:\n- Earlier instructions that describe verbose per-component CSS, gradients, watermark objects, titleStyle/valueStyle, icon objects, palettes, or decorative details are OPTIONAL examples only. For this request, DO NOT emit them unless the user explicitly asked for that exact component-level detail.\n- COVERAGE COMES BEFORE DECORATION. Before adding any styling, allocate the complete component manifest. For a broad executive dashboard supported by evidence, return 8-10 useful components in ONE response: normally 3-4 KPIs + one monthly/time trend + one customer/ranking chart + one detail table + one insight component; add another useful chart only when evidence supports it.\n- NEVER return only one KPI for a broad dashboard. If output budget is tight, omit decorative styling first, then optional extra charts; never omit the required analytical classes.\n- Prefer bindings for chart/table/KPI data when one exact MCP operation can supply the component. A bound component should contain only its id, binding, compact format/icon/layout/section metadata — NOT copied categories, series, rows or values.\n- Use exact plan operation names and exact result field keys. If binding is unsafe for a component, use compact literal data only for that component.\n- Use short semantic icon strings (revenue, receipt, users, chart, profit) rather than icon objects.\n- Use ONE compact top-level designSystem. No per-KPI style/titleStyle/valueStyle/watermark by default.\n- Keep section metadata compact. Do not generate layoutTree when sections are enough.\n- Produce the full component manifest first and keep the JSON concise. Return JSON only.`;

global.fetch = async function coverageSchemaFetch(url,options={}){
  try{
    if(String(url).includes('api.anthropic.com/v1/messages')&&options.body){
      const body=JSON.parse(options.body);
      if(body?.system===PRESENTATION_SYSTEM){
        const score=coverageScore(originalQuestion(body));
        const msg=body.messages?.[body.messages.length-1];
        const isV33=typeof msg?.content==='string' && msg.content.includes('SECTION DESIGN LANGUAGE V3.3');
        if(score>=4 && msg&&typeof msg.content==='string'){
          if(!msg.content.includes('STRUCTURED COVERAGE GUARD V3.3.1')){
            msg.content+='\n\nSTRUCTURED COVERAGE GUARD V3.3.1 — This is a broad dashboard request. Preserve distinct requested outputs: executive KPIs, time trend, customer/ranking analysis, detailed table, and insights. Do not collapse the report into one hero KPI and do not create filler or duplicate cards.';
          }
          if(isV33 && !msg.content.includes('FINAL COMPACT DASHBOARD CONTRACT V3.3.1')){
            msg.content+=FINAL_COMPACT_V33;
            // Compact bound dashboards should fit comfortably in this budget. Keeping a
            // finite budget discourages verbose decoration while leaving room for breadth.
            body.max_tokens=Math.min(Number(body.max_tokens)||4500,4500);
          }
          options={...options,body:JSON.stringify(body)};
        }
      }
    }
  }catch(e){console.error('coverage-schema-preload non-fatal error:',e.message)}
  return upstreamFetch(url,options);
};

require('./structured-preload.js');
