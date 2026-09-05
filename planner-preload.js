// Planner reliability wrapper. Loaded before analyst/structured-preload/server.js.
const nativeFetch = global.fetch;
const PLANNER_MARK = 'You are the query planner for a live Odoo 17 sales analytics system';

function plannerGuidance(body) {
  const extra = `\n\nANALYTICAL INTENT V2.3 — BUILD THE ANALYSIS SPEC BEFORE THE ODOO OPERATIONS:\nBefore selecting MCP tools, translate the user's request into a compact declarative analyticalIntent. This is NOT chain-of-thought and must not contain hidden reasoning. It is only the explicit analysis specification that the rest of the system can inspect and reuse.\nReturn the normal operations PLUS this top-level object:\n{\n  \"analyticalIntent\": {\n    \"questionType\": \"summary|ranking|trend|comparison|diagnostic|lookup|mixed\",\n    \"metrics\": [{\"name\":\"sales\",\"model\":\"sale.order\",\"field\":\"amount_total\",\"aggregation\":\"sum\"}],\n    \"dimensions\": [\"customer\",\"month\"],\n    \"filters\": [\"confirmed sales\"],\n    \"timeScope\": {\"explicit\":true,\"label\":\"2025\",\"start\":\"2025-01-01\",\"endExclusive\":\"2026-01-01\"},\n    \"ranking\": {\"dimension\":\"customer\",\"metric\":\"sales\",\"direction\":\"desc\",\"limit\":10},\n    \"comparison\": null,\n    \"analysisGoals\": [\"rank customers\",\"show monthly trend for top 5\",\"calculate share of top 5\"],\n    \"requestedOutputs\": [\"line_chart\",\"pie_chart\"]\n  },\n  \"operations\": [...]\n}\nRules for analyticalIntent:\n- Describe WHAT is being analyzed, not HOW you reasoned about it. Keep it compact and factual.\n- metrics are business measures requested or directly required for the answer. Use real Odoo model/field names when known.\n- dimensions are semantic analysis dimensions such as customer, product, salesperson, company, month, quarter, year.\n- filters describe business filters semantically; executable domains still belong in operations.\n- timeScope must reflect exactly what the user requested. If no period was specified, set explicit:false and do NOT invent start/end dates.\n- ranking is null when there is no ranking. comparison is null unless the user asks for or clearly requires a comparison.\n- analysisGoals describe the requested analytical outputs in short phrases; do not include implementation steps.\n- requestedOutputs contains only explicitly requested visual/output forms such as line_chart, pie_chart, table, kpi. Do not claim a visual was requested when the user did not request it.\n- The MCP operations MUST be sufficient to satisfy analyticalIntent. Every operation should map to one or more intent fields/goals. Do not fetch unrelated data.\n\nPLANNER RELIABILITY RULES — IMPORTANT:\n- Every operation must be executable independently. NEVER make a later MCP operation depend on IDs, values, placeholders, variables, or outputs from an earlier operation. Do not use placeholders such as $top5, {{ids}}, <partner_ids>, or similar inside domains.\n- TIME SCOPE IS A HARD CONSTRAINT: when the user specifies a year, quarter, month, date range, or other explicit period, EVERY operation supporting that answer must use the SAME requested period unless the user explicitly asks for a comparison outside it. Do not let trend/detail/supporting queries leak into later or earlier periods. Example: for 2025 sale.order analysis, every sale.order operation must include date_order >= 2025-01-01 00:00:00 and date_order < 2026-01-01 00:00:00. For account.move use invoice_date/date as appropriate; for sale.order.line use order_id.date_order.\n- If the user's wording contains an explicit year and one operation has the correct date domain, copy the same semantic period to all sibling operations on the same business facts. Charts, rankings, tables, KPIs and supporting evidence must agree on scope.\n- For customer rankings use sale.order read_group with domain confirmed sales, fields [\"partner_id\",\"amount_total\"], groupby [\"partner_id\"]. A safe example is: {\"model\":\"sale.order\",\"domain\":\"[[\\\"state\\\",\\\"=\\\",\\\"sale\\\"]]\",\"fields\":[\"partner_id\",\"amount_total\"],\"groupby\":[\"partner_id\"],\"limit\":100}. Presentation can sort the returned groups itself.\n- If the user wants both top customers AND a monthly trend for those customers, gather the evidence with TWO independent operations: (1) customer ranking grouped only by partner_id; (2) customer/month evidence grouped by [\"partner_id\",\"date_order:month\"] over the SAME confirmed-sales/date domain WITHOUT trying to inject the top customer IDs from operation 1. The presentation layer will cross-filter the top customers.\n- For date grouping, include the base date field in fields (e.g. \"date_order\") and the grouped form only in groupby (e.g. \"date_order:month\").\n- For read_group numeric sums, prefer plain numeric field names in fields such as \"amount_total\"; Odoo will return aggregate keys such as amount_total:sum.\n- Avoid read_group order clauses unless truly necessary. If ranking can be sorted by the presentation layer, omit order. This avoids Odoo order-by limitations on grouped aggregates.\n- Never request non-existent aliases such as partner_id_count, amount_total_sum, monthly_total, customer_name, or computed pseudo-fields. Use only real Odoo fields listed in the system prompt.\n- When a user requests a visual form (line/pie/etc.), that affects what evidence you gather, but you still do NOT choose the final visualization. Gather enough rows/groups for the presentation layer to satisfy it.\n`;
  const last = body.messages?.[body.messages.length - 1];
  if (last && typeof last.content === 'string') last.content += extra;
}

function normalizeIntent(intent) {
  if (!intent || typeof intent !== 'object') return null;
  const allowedTypes = new Set(['summary','ranking','trend','comparison','diagnostic','lookup','mixed']);
  const out = {};
  out.questionType = allowedTypes.has(intent.questionType) ? intent.questionType : 'mixed';
  out.metrics = Array.isArray(intent.metrics) ? intent.metrics.slice(0,10).map(m => ({
    name: String(m?.name || '').slice(0,60), model: String(m?.model || '').slice(0,80), field: String(m?.field || '').slice(0,80), aggregation: String(m?.aggregation || '').slice(0,30)
  })).filter(m => m.name || m.field) : [];
  out.dimensions = Array.isArray(intent.dimensions) ? intent.dimensions.map(x => String(x).slice(0,50)).slice(0,12) : [];
  out.filters = Array.isArray(intent.filters) ? intent.filters.map(x => String(x).slice(0,100)).slice(0,12) : [];
  const ts = intent.timeScope && typeof intent.timeScope === 'object' ? intent.timeScope : {};
  out.timeScope = { explicit: !!ts.explicit, label: ts.label == null ? '' : String(ts.label).slice(0,80), start: ts.start == null ? null : String(ts.start).slice(0,32), endExclusive: ts.endExclusive == null ? null : String(ts.endExclusive).slice(0,32) };
  if (!out.timeScope.explicit) { out.timeScope.start = null; out.timeScope.endExclusive = null; }
  const r = intent.ranking;
  out.ranking = r && typeof r === 'object' ? { dimension:String(r.dimension||'').slice(0,50), metric:String(r.metric||'').slice(0,50), direction:r.direction==='asc'?'asc':'desc', limit:Math.max(1,Math.min(Number(r.limit)||10,100)) } : null;
  out.comparison = intent.comparison && typeof intent.comparison === 'object' ? intent.comparison : null;
  out.analysisGoals = Array.isArray(intent.analysisGoals) ? intent.analysisGoals.map(x=>String(x).slice(0,120)).slice(0,12) : [];
  out.requestedOutputs = Array.isArray(intent.requestedOutputs) ? intent.requestedOutputs.map(x=>String(x).slice(0,40)).slice(0,10) : [];
  return out;
}

function normalizePlan(plan) {
  if (!plan || !Array.isArray(plan.operations)) return plan;
  if (plan.analyticalIntent) plan.analyticalIntent = normalizeIntent(plan.analyticalIntent);
  for (const op of plan.operations) {
    const a = op && op.arguments; if (!a || typeof a !== 'object') continue;
    if (Array.isArray(a.domain)) a.domain = JSON.stringify(a.domain); if (a.domain == null) a.domain='[]';
    if (op.tool === 'read_group') {
      if (!Array.isArray(a.groupby) || !a.groupby.length) a.groupby=['company_id']; if (!Array.isArray(a.fields)) a.fields=[];
      for (const g of a.groupby) { const base=String(g).split(':')[0]; if(base&&!a.fields.includes(base))a.fields.unshift(base); }
      if (typeof a.order==='string') { a.order=a.order.replace(/:(sum|avg|min|max|count|count_distinct)(?=\s|,|$)/g,''); if(!a.order.trim())delete a.order; }
    }
    if (Number(a.limit)>100)a.limit=100;
  }
  return plan;
}

global.fetch = async function plannerSafeFetch(url, options={}) {
  let isPlanner=false;
  try {
    if (String(url).includes('api.anthropic.com/v1/messages') && options.body) {
      const body=JSON.parse(options.body); isPlanner=typeof body.system==='string'&&body.system.includes(PLANNER_MARK);
      if(isPlanner){plannerGuidance(body);options={...options,body:JSON.stringify(body)}}
    }
  } catch(e){console.error('planner-preload request inspection error:',e.message)}
  const response=await nativeFetch(url,options); if(!isPlanner||!response.ok)return response;
  try {
    const payload=await response.clone().json();
    if(Array.isArray(payload.content))for(const block of payload.content)if(block?.type==='text'&&typeof block.text==='string'){const cleaned=block.text.replace(/^```json\s*/i,'').replace(/^```\s*/,'').replace(/```\s*$/,'').trim();block.text=JSON.stringify(normalizePlan(JSON.parse(cleaned)))}
    const headers=new Headers(response.headers);headers.set('content-type','application/json');return new Response(JSON.stringify(payload),{status:response.status,statusText:response.statusText,headers});
  } catch(e){console.error('planner-preload response normalization error:',e.message);return response}
};

require('./analyst-preload.js');
