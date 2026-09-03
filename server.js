const express = require('express');
const path = require('path');
const { KNOWN_DIMENSIONS, KNOWN_METRICS, MONTHS_LIST, CITIES_LIST, SEGMENTS_LIST } = require('./public/engine.js');

const app = express();
app.use(express.json({ limit: '256kb' }));
app.use(express.static(path.join(__dirname, 'public')));

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5';
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';

const PLAN_SYSTEM_PROMPT = `You are the analytical query planner for a Saudi B2B SaaS sales dataset (year 2025, currency SAR, one row = one invoice line item). You do NOT answer the user's question and you do NOT decide any visualization — you only decide what factual computations a deterministic engine should run in order to gather the evidence needed to answer the question. You have full freedom in how many operations to request (1 to 6) and what they cover — reason about what this specific, possibly unanticipated, question actually needs. There is no fixed template of question types.

Dataset fields per row: date, month (Arabic name), quarter (1-4), customer_id, customer_name, customer_segment (صغيرة جداً|صغيرة|متوسطة), product_id, product_name, product_category (الاشتراكات|الأجهزة والبرمجيات|الخدمات|الامتثال), quantity, unit_price, subtotal, discount, tax, total (=revenue), cost, gross_profit, payment_status (مدفوعة|جزئية|متأخرة), salesperson, city (${JSON.stringify(CITIES_LIST)}), region, payment_method.

Groupable dimensions (use for "groupBy"): ${JSON.stringify(KNOWN_DIMENSIONS)}, or null for no grouping.
Available metrics (engine computes these; you just name them): ${JSON.stringify(KNOWN_METRICS)}.
  - discount_pct and margin_pct and overdue_ratio are fractions between 0 and 1.
Optional filters object: { "city": one of ${JSON.stringify(CITIES_LIST)}, "segment": one of ${JSON.stringify(SEGMENTS_LIST)}, "month": one of ${JSON.stringify(MONTHS_LIST)}, "quarter": 1-4, "payment_status": "متأخرة" }. Omit any key you don't need. Never invent values outside these lists.

Operation types the engine can execute — pick whichever combination genuinely helps:
1. "aggregate": { "name", "type":"aggregate", "groupBy": dimension-or-null, "metrics": [...], "filters": {...}, "sort": {"by":metric,"dir":"asc"|"desc"} (optional), "limit": integer (optional) } — group rows and compute metrics per group (or one overall row if groupBy is null).
2. "points": { "name", "type":"points", "groupBy": dimension-or-null, "x_metric", "y_metric", "filters": {...}, "limit": integer (optional, engine caps at 300) } — produces (x,y) coordinate pairs for correlation/relationship analysis. groupBy=an entity (e.g. "customer") gives one point per entity; groupBy=null gives one point per raw invoice line.
3. "segment": { "name", "type":"segment", "groupBy": dimension (required, e.g. "customer"), "x_metric", "y_metric", "buckets": 4 (or 2), "filters": {...} } — splits entities into quadrant/tertile groups by two metrics using median splits. Use this for "group/segment/cluster X by two measures" questions.

For open-ended or investigative questions (e.g. "find anything unusual"), request several complementary aggregate/points operations across different dimensions so there's enough real evidence to reason over afterward — you don't need to know in advance what you'll find.

If previous-plan context is given for a follow-up message, decide yourself whether to extend, modify, or replace it, and return a complete new operations array either way (not a diff).

Respond with ONLY a JSON object: {"operations":[{...}, {...}]}. No prose, no markdown fences. Give each operation a short distinct snake_case "name" — results will be returned to you later keyed by these names.`;

const PRESENT_SYSTEM_PROMPT = `You are the presentation layer for a Saudi B2B sales analytics tool. A deterministic engine has just executed the query plan you designed and returned the actual factual results below. Your job now is to decide, completely freely, how to present the answer: how many KPIs (zero or more), which chart types, chart titles, axis/series data, tables, written insights/warnings, and their order. There is no fixed template — decide based on what the data actually shows and what genuinely answers the question. An unexpected question deserves an unexpected layout if that's what fits.

Supported component types (the renderer can draw any of these, in any order, any combination — choosing is entirely up to you):
- {"type":"kpi","title":"...","value":<number>,"format":"currency"|"number"|"percent","trend":"good"|"warn"|null}
- {"type":"table","title":"...","columns":[...],"rows":[[cell,...],...]}
- {"type":"bar_chart","title":"...","categories":[...],"series":[{"name":"...","data":[numbers]}],"horizontal":true|false}
- {"type":"line_chart","title":"...","categories":[...],"series":[{"name":"...","data":[numbers]}]}
- {"type":"area_chart","title":"...","categories":[...],"series":[{"name":"...","data":[numbers]}]}
- {"type":"pie_chart","title":"...","categories":[...],"series":[{"name":"...","data":[numbers]}]}
- {"type":"scatter_chart","title":"...","xLabel":"...","yLabel":"...","points":[{"x":num,"y":num,"label":"..."}]}
- {"type":"insight","severity":"info"|"warning"|"positive","text":"..."}

CRITICAL — grounding: every number you place in a KPI, chart, or table MUST come from the factual results provided below. Never invent, estimate, or silently recompute a number that isn't directly present in (or a trivial sum/percentage-of-total derived from) the provided data. If the data doesn't support a claim, say so plainly in an insight instead of fabricating a figure.

Respond with ONLY a JSON object: {"title":"...", "summary":"2-5 sentence written analysis in Arabic that actually answers the question", "components":[...]}. No prose outside the JSON, no markdown fences.

Original question: {{QUESTION}}

Your own query plan from the previous step:
{{PLAN}}

Factual results returned by the deterministic engine (the ONLY numbers you may use):
{{RESULTS}}`;

async function callAnthropic(system, userText) {
  if (!ANTHROPIC_API_KEY) {
    const err = new Error('ANTHROPIC_API_KEY is not configured on the server.');
    err.status = 503;
    throw err;
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  let r;
  try {
    r = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: MODEL, max_tokens: 2000, system, messages: [{ role: 'user', content: userText }] }),
      signal: controller.signal,
    });
  } catch (e) {
    clearTimeout(timeout);
    const err = new Error(e.name === 'AbortError' ? 'Anthropic API request timed out.' : (e.message || 'Network error calling Anthropic.'));
    err.status = e.name === 'AbortError' ? 504 : 502;
    throw err;
  }
  clearTimeout(timeout);
  if (!r.ok) {
    const detail = await r.text();
    const err = new Error(`Anthropic API returned HTTP ${r.status}`);
    err.status = 502;
    err.detail = detail.slice(0, 500);
    throw err;
  }
  const data = await r.json();
  const text = (data.content || []).map((b) => b.text || '').join('').trim();
  return { text, model: data.model || MODEL, usage: data.usage || null };
}

function parseJsonLoose(text) {
  const stripped = text.replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/```\s*$/, '').trim();
  return JSON.parse(stripped);
}

app.post('/api/plan', async (req, res) => {
  const { question, previousPlan } = req.body || {};
  if (!question || typeof question !== 'string' || question.length > 500) {
    return res.status(400).json({ error: 'A question string (max 500 chars) is required.' });
  }
  const userText = previousPlan
    ? `Previous plan (JSON, for follow-up context):\n${JSON.stringify(previousPlan)}\n\nNew user message:\n${question}`
    : `User question:\n${question}`;

  try {
    const { text, model } = await callAnthropic(PLAN_SYSTEM_PROMPT, userText);
    let plan;
    try {
      plan = parseJsonLoose(text);
    } catch (e) {
      return res.status(502).json({ error: 'Claude did not return valid JSON for the query plan.', raw: text.slice(0, 800) });
    }
    if (!plan || !Array.isArray(plan.operations) || !plan.operations.length) {
      return res.status(502).json({ error: 'Claude returned a plan with no operations.', raw: text.slice(0, 800) });
    }
    return res.json({ plan, rawText: text, model });
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message, detail: err.detail });
  }
});

const VALID_COMPONENT_TYPES = ['kpi', 'table', 'bar_chart', 'line_chart', 'area_chart', 'pie_chart', 'scatter_chart', 'insight'];

function validateSchema(schema) {
  if (!schema || typeof schema !== 'object') return 'not an object';
  if (typeof schema.title !== 'string') return 'missing "title" string';
  if (!Array.isArray(schema.components)) return 'missing "components" array';
  for (const c of schema.components) {
    if (!c || typeof c !== 'object' || !VALID_COMPONENT_TYPES.includes(c.type)) {
      return `component has invalid/unsupported type "${c && c.type}"`;
    }
  }
  return null;
}

app.post('/api/present', async (req, res) => {
  const { question, plan, results } = req.body || {};
  if (!question || typeof question !== 'string') return res.status(400).json({ error: 'question is required' });
  if (!plan || typeof plan !== 'object') return res.status(400).json({ error: 'plan is required' });
  if (!results || typeof results !== 'object') return res.status(400).json({ error: 'results is required' });

  const userText = PRESENT_SYSTEM_PROMPT
    .replace('{{QUESTION}}', question)
    .replace('{{PLAN}}', JSON.stringify(plan))
    .replace('{{RESULTS}}', JSON.stringify(results));

  try {
    const { text, model } = await callAnthropic(
      'You output only the JSON object described in the instructions below — no other text.',
      userText
    );
    let schema;
    try {
      schema = parseJsonLoose(text);
    } catch (e) {
      return res.status(502).json({ error: 'Claude did not return valid JSON for the presentation.', raw: text.slice(0, 1200) });
    }
    const err = validateSchema(schema);
    if (err) return res.status(502).json({ error: `Claude returned an invalid UI schema: ${err}`, raw: text.slice(0, 1200) });

    return res.json({ schema, rawText: text, model });
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message, detail: err.detail });
  }
});

app.get('/healthz', (req, res) => {
  res.json({ ok: true, aiConfigured: !!ANTHROPIC_API_KEY, model: MODEL });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Qimam AI Sales (two-stage) server listening on :${PORT}`));
