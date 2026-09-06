// Structured coverage guard V3.2.1 — enforces minimum component breadth only for broad dashboard requests.
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
function clone(v){return JSON.parse(JSON.stringify(v))}

global.fetch = async function coverageSchemaFetch(url,options={}){
  try{
    if(String(url).includes('api.anthropic.com/v1/messages')&&options.body){
      const body=JSON.parse(options.body);
      if(body?.system===PRESENTATION_SYSTEM && coverageScore(originalQuestion(body))>=4){
        const format=body?.output_config?.format;
        if(format?.type==='json_schema'&&format.schema?.properties?.components){
          body.output_config={...body.output_config,format:{...format,schema:clone(format.schema)}};
          const components=body.output_config.format.schema.properties.components;
          components.minItems=6;
          components.maxItems=12;
          const msg=body.messages?.[body.messages.length-1];
          if(msg&&typeof msg.content==='string'&&!msg.content.includes('STRUCTURED COVERAGE GUARD V3.2.1')){
            msg.content+='\n\nSTRUCTURED COVERAGE GUARD V3.2.1 — The JSON schema requires at least 6 components for this broad dashboard request. Use those slots for genuine requested content: executive KPIs, trend analysis, customer/ranking analysis, detail table and insights. Do not create filler or duplicate cards merely to satisfy the count.';
          }
          options={...options,body:JSON.stringify(body)};
        }
      }
    }
  }catch(e){console.error('coverage-schema-preload non-fatal error:',e.message)}
  return upstreamFetch(url,options);
};

require('./structured-preload.js');
