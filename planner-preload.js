// Planner reliability wrapper. Loaded before structured-preload/server.js.
const nativeFetch = global.fetch;
const PLANNER_MARK = 'You are the query planner for a live Odoo 17 sales analytics system';

function plannerGuidance(body) {
  const extra = `\n\nPLANNER RELIABILITY RULES — IMPORTANT:\n- Every operation must be executable independently. NEVER make a later MCP operation depend on IDs, values, placeholders, variables, or outputs from an earlier operation. Do not use placeholders such as $top5, {{ids}}, <partner_ids>, or similar inside domains.\n- TIME SCOPE IS A HARD CONSTRAINT: when the user specifies a year, quarter, month, date range, or other explicit period, EVERY operation supporting that answer must use the SAME requested period unless the user explicitly asks for a comparison outside it. Do not let trend/detail/supporting queries leak into later or earlier periods. Example: for 2025 sale.order analysis, every sale.order operation must include date_order >= 2025-01-01 00:00:00 and date_order < 2026-01-01 00:00:00. For account.move use invoice_date/date as appropriate; for sale.order.line use order_id.date_order.\n- If the user's wording contains an explicit year and one operation has the correct date domain, copy the same semantic period to all sibling operations on the same business facts. Charts, rankings, tables, KPIs and supporting evidence must agree on scope.\n- For customer rankings use sale.order read_group with domain confirmed sales, fields [\"partner_id\",\"amount_total\"], groupby [\"partner_id\"]. A safe example is: {\"model\":\"sale.order\",\"domain\":\"[[\\\"state\\\",\\\"=\\\",\\\"sale\\\"]]\",\"fields\":[\"partner_id\",\"amount_total\"],\"groupby\":[\"partner_id\"],\"limit\":100}. Presentation can sort the returned groups itself.\n- If the user wants both top customers AND a monthly trend for those customers, gather the evidence with TWO independent operations: (1) customer ranking grouped only by partner_id; (2) customer/month evidence grouped by [\"partner_id\",\"date_order:month\"] over the SAME confirmed-sales/date domain WITHOUT trying to inject the top customer IDs from operation 1. The presentation layer will cross-filter the top customers.\n- For date grouping, include the base date field in fields (e.g. \"date_order\") and the grouped form only in groupby (e.g. \"date_order:month\").\n- For read_group numeric sums, prefer plain numeric field names in fields such as \"amount_total\"; Odoo will return aggregate keys such as amount_total:sum.\n- Avoid read_group order clauses unless truly necessary. If ranking can be sorted by the presentation layer, omit order. This avoids Odoo order-by limitations on grouped aggregates.\n- Never request non-existent aliases such as partner_id_count, amount_total_sum, monthly_total, customer_name, or computed pseudo-fields. Use only real Odoo fields listed in the system prompt.\n- When a user requests a visual form (line/pie/etc.), that affects what evidence you gather, but you still do NOT choose the final visualization. Gather enough rows/groups for the presentation layer to satisfy it.\n`;
  const last = body.messages?.[body.messages.length - 1];
  if (last && typeof last.content === 'string') last.content += extra;
}

function normalizePlan(plan) {
  if (!plan || !Array.isArray(plan.operations)) return plan;
  for (const op of plan.operations) {
    const a = op && op.arguments;
    if (!a || typeof a !== 'object') continue;
    if (Array.isArray(a.domain)) a.domain = JSON.stringify(a.domain);
    if (a.domain == null) a.domain = '[]';
    if (op.tool === 'read_group') {
      if (!Array.isArray(a.groupby) || !a.groupby.length) a.groupby = ['company_id'];
      if (!Array.isArray(a.fields)) a.fields = [];
      for (const g of a.groupby) {
        const base = String(g).split(':')[0];
        if (base && !a.fields.includes(base)) a.fields.unshift(base);
      }
      if (typeof a.order === 'string') {
        a.order = a.order.replace(/:(sum|avg|min|max|count|count_distinct)(?=\s|,|$)/g, '');
        if (!a.order.trim()) delete a.order;
      }
    }
    if (Number(a.limit) > 100) a.limit = 100;
  }
  return plan;
}

global.fetch = async function plannerSafeFetch(url, options = {}) {
  let isPlanner = false;
  try {
    if (String(url).includes('api.anthropic.com/v1/messages') && options.body) {
      const body = JSON.parse(options.body);
      isPlanner = typeof body.system === 'string' && body.system.includes(PLANNER_MARK);
      if (isPlanner) {
        plannerGuidance(body);
        options = {...options, body: JSON.stringify(body)};
      }
    }
  } catch (e) {
    console.error('planner-preload request inspection error:', e.message);
  }

  const response = await nativeFetch(url, options);
  if (!isPlanner || !response.ok) return response;

  try {
    const payload = await response.clone().json();
    if (Array.isArray(payload.content)) {
      for (const block of payload.content) {
        if (block?.type === 'text' && typeof block.text === 'string') {
          const cleaned = block.text.replace(/^```json\s*/i,'').replace(/^```\s*/,'').replace(/```\s*$/,'').trim();
          const plan = normalizePlan(JSON.parse(cleaned));
          block.text = JSON.stringify(plan);
        }
      }
    }
    const headers = new Headers(response.headers);
    headers.set('content-type','application/json');
    return new Response(JSON.stringify(payload), {status:response.status,statusText:response.statusText,headers});
  } catch (e) {
    console.error('planner-preload response normalization error:', e.message);
    return response;
  }
};

require('./structured-preload.js');
