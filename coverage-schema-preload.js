// Structured coverage guard V3.2.2 — broad-dashboard coverage guidance without unsupported JSON Schema constraints.
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

global.fetch = async function coverageSchemaFetch(url,options={}){
  try{
    if(String(url).includes('api.anthropic.com/v1/messages')&&options.body){
      const body=JSON.parse(options.body);
      if(body?.system===PRESENTATION_SYSTEM && coverageScore(originalQuestion(body))>=4){
        // Anthropic structured output currently accepts array minItems only as 0 or 1.
        // Do NOT mutate the JSON schema to minItems=6/maxItems=12. Coverage is enforced
        // by explicit generation requirements plus the deterministic thin-dashboard retry
        // in section-design-v32-preload.js.
        const msg=body.messages?.[body.messages.length-1];
        if(msg&&typeof msg.content==='string'&&!msg.content.includes('STRUCTURED COVERAGE GUARD V3.2.2')){
          msg.content+='\n\nSTRUCTURED COVERAGE GUARD V3.2.2 — This is a broad dashboard request. Return a complete report with genuine breadth, normally 6-10 useful components when evidence supports it. Preserve distinct requested outputs: executive KPIs, time trend, customer/ranking analysis, detailed table, and insights. Do not collapse the report into one hero KPI, and do not create filler or duplicate cards.';
        }
        options={...options,body:JSON.stringify(body)};
      }
    }
  }catch(e){console.error('coverage-schema-preload non-fatal error:',e.message)}
  return upstreamFetch(url,options);
};

require('./structured-preload.js');
