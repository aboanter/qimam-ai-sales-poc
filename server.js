const express = require('express');
const path = require('path');

const app = express();
app.use(express.json({ limit: '256kb' }));
app.use(express.static(path.join(__dirname, 'public')));

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const ODOO_MCP_URL = process.env.ODOO_MCP_URL || '';
const ODOO_MCP_KEY = process.env.ODOO_MCP_KEY || '';
const MCP_PROTOCOL = '2025-11-25';

const PLAN_SYSTEM_PROMPT = `You are the query planner for a live Odoo 17 sales analytics system in Saudi Arabia. Currency is SAR. You do not answer the user and you do not choose visualizations. Convert the user's natural-language question into 1-6 safe READ-ONLY Odoo MCP operations that gather exactly the factual evidence needed.

Available MCP operations:
1) search_count: {"name":"...","tool":"search_count","arguments":{"model":"...","domain":"JSON-encoded Odoo domain string","context":{...}}}
2) search_read: {"name":"...","tool":"search_read","arguments":{"model":"...","domain":"JSON-encoded Odoo domain string","fields":[...],"limit":1-100,"order":"...","context":{...}}}
3) read_group: {"name":"...","tool":"read_group","arguments":{"model":"...","domain":"JSON-encoded Odoo domain string","fields":[...],"groupby":[...],"limit":1-100,"order":"...","context":{...}}}

Primary Odoo models/fields:
- sale.order: id,name,date_order,state,partner_id,user_id,company_id,currency_id,amount_untaxed,amount_tax,amount_total,invoice_status,order_line. Confirmed sales normally use state='sale'. Exclude draft/cancel unless the question explicitly asks for them. Date grouping supports date_order:month, date_order:quarter, date_order:year.
- sale.order.line: id,order_id,product_id,product_uom_qty,price_unit,discount,price_subtotal,price_tax,price_total,company_id,currency_id. For product analysis, filter order_id.state='sale'.
- account.move: id,name,invoice_date,date,state,move_type,partner_id,company_id,amount_untaxed,amount_tax,amount_total,amount_residual,payment_state. Customer invoices use move_type='out_invoice' and posted invoices normally state='posted'.
- res.partner: id,name,customer_rank,city,state_id,country_id,company_id.
- product.product: id,name,product_tmpl_id,default_code.
- product.template: id,name,categ_id,list_price,standard_price.

Rules:
- Domains MUST be JSON-encoded strings, e.g. "[[\\\"state\\\",\\\"=\\\",\\\"sale\\\"]]" in the final JSON value; after parsing it must be a normal string such as [["state","=","sale"]].
- Use Odoo relational traversal in domains when useful, e.g. order_id.state.
- Prefer read_group for totals, rankings and time series; do not fetch raw records just to aggregate them yourself.
- For "sales" without another definition, use confirmed sale.order records (state='sale') and amount_total.
- For product sales, use sale.order.line and price_total/product_uom_qty with order_id.state='sale'.
- For invoices, use account.move, not sale.order.
- For "latest/last" use search_read with order and a small limit.
- Respect dates exactly when the user specifies them. Current date is 2026-09-05.
- Never request create_records, update_records, delete_records, print_report, or any write action.
- Never invent a field/model outside the catalog above unless it is an obvious standard Odoo field and essential.
- Each operation needs a distinct snake_case name.

Return ONLY JSON: {"operations":[{"name":"...","tool":"read_group","arguments":{...}}]}. No markdown.`;

const PRESENT_SYSTEM_PROMPT = `You are the presentation layer for Qimam AI Sales. The query planner requested read-only operations from live Odoo and the MCP server returned the factual results. Answer the user's question in Arabic and freely choose the best UI components.

Supported components:
- {"type":"kpi","title":"...","value":number,"format":"currency"|"number"|"percent","trend":"good"|"warn"|null}
- {"type":"table","title":"...","columns":[...],"rows":[[cell,...],...]}
- {"type":"bar_chart","title":"...","categories":[...],"series":[{"name":"...","data":[numbers]}],"horizontal":true|false}
- {"type":"line_chart","title":"...","categories":[...],"series":[{"name":"...","data":[numbers]}]}
- {"type":"area_chart","title":"...","categories":[...],"series":[{"name":"...","data":[numbers]}]}
- {"type":"pie_chart","title":"...","categories":[...],"series":[{"name":"...","data":[numbers]}]}
- {"type":"scatter_chart","title":"...","xLabel":"...","yLabel":"...","points":[{"x":number,"y":number,"label":"..."}]}
- {"type":"insight","severity":"info"|"warning"|"positive","text":"..."}

Grounding is mandatory: every factual number must come from the MCP results or a trivial calculation directly from them. Never invent data. Odoo many2one values may appear as [id,"display name"]; present the display name. Keys like amount_total:sum are sums. Keys ending _count are counts. If an MCP operation returned an error, explain the limitation rather than fabricate an answer.

Return ONLY JSON: {"title":"...","summary":"...","components":[...]}.`;

async function callAnthropic(system, userText) {
  if (!ANTHROPIC_API_KEY) throw Object.assign(new Error('ANTHROPIC_API_KEY is not configured.'), { status: 503 });
  const r = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {'content-type':'application/json','x-api-key':ANTHROPIC_API_KEY,'anthropic-version':'2023-06-01'},
    body: JSON.stringify({model:MODEL,max_tokens:2500,system,messages:[{role:'user',content:userText}]})
  });
  if (!r.ok) throw Object.assign(new Error(`Anthropic API returned HTTP ${r.status}`), {status:502, detail:(await r.text()).slice(0,800)});
  const data = await r.json();
  return {text:(data.content||[]).map(x=>x.text||'').join('').trim(),model:data.model||MODEL};
}

function parseJsonLoose(text) {
  return JSON.parse(text.replace(/^```json\s*/i,'').replace(/^```\s*/,'').replace(/```\s*$/,'').trim());
}

async function mcpPost(body, sessionId='') {
  if (!ODOO_MCP_URL || !ODOO_MCP_KEY) throw Object.assign(new Error('Odoo MCP is not configured on the server.'), {status:503});
  const headers = {'Authorization':`Bearer ${ODOO_MCP_KEY}`,'Content-Type':'application/json','Accept':'application/json','MCP-Protocol-Version':MCP_PROTOCOL};
  if (sessionId) headers['Mcp-Session-Id'] = sessionId;
  const r = await fetch(ODOO_MCP_URL,{method:'POST',headers,body:JSON.stringify(body)});
  const text = await r.text();
  if (!r.ok) throw Object.assign(new Error(`Odoo MCP returned HTTP ${r.status}`),{status:502,detail:text.slice(0,800)});
  let data = null;
  if (text.trim()) { try { data=JSON.parse(text); } catch { data={raw:text}; } }
  return {data,sessionId:r.headers.get('mcp-session-id')||sessionId};
}

async function createMcpSession() {
  const init = await mcpPost({jsonrpc:'2.0',id:1,method:'initialize',params:{}});
  if (!init.sessionId) throw Object.assign(new Error('Odoo MCP did not return a session id.'),{status:502});
  await mcpPost({jsonrpc:'2.0',method:'notifications/initialized'},init.sessionId);
  return init.sessionId;
}

const ALLOWED_TOOLS = new Set(['search_count','search_read','read_group','read_records']);
const ALLOWED_MODELS = new Set(['sale.order','sale.order.line','account.move','res.partner','product.product','product.template']);

function validatePlan(plan) {
  if (!plan || !Array.isArray(plan.operations) || !plan.operations.length || plan.operations.length>6) throw new Error('Invalid or empty query plan.');
  for (const op of plan.operations) {
    if (!op.name || !ALLOWED_TOOLS.has(op.tool)) throw new Error(`Unsafe/unsupported MCP tool: ${op.tool}`);
    if (!op.arguments || !ALLOWED_MODELS.has(op.arguments.model)) throw new Error(`Unsafe/unsupported Odoo model: ${op.arguments && op.arguments.model}`);
    if (op.arguments.limit && op.arguments.limit>100) op.arguments.limit=100;
  }
}

function unpackMcpToolResult(data) {
  if (!data) return null;
  if (data.error) return {error:data.error};
  const blocks=data.result && data.result.content;
  if (!Array.isArray(blocks)) return data.result || data;
  const text=blocks.filter(x=>x.type==='text').map(x=>x.text||'').join('\n').trim();
  if (!text) return data.result;
  try { return JSON.parse(text); } catch { return text; }
}

async function executeOdooPlan(plan) {
  const sessionId=await createMcpSession();
  const results={};
  let id=10;
  for (const op of plan.operations) {
    const response=await mcpPost({jsonrpc:'2.0',id:id++,method:'tools/call',params:{name:op.tool,arguments:op.arguments}},sessionId);
    results[op.name]=unpackMcpToolResult(response.data);
  }
  return results;
}

app.post('/api/plan', async (req,res)=>{
  const {question,previousPlan}=req.body||{};
  if (!question || typeof question!=='string' || question.length>500) return res.status(400).json({error:'A question string (max 500 chars) is required.'});
  try {
    const userText=(previousPlan?`Previous plan for conversational context:\n${JSON.stringify(previousPlan)}\n\n`:'')+`User question:\n${question}`;
    const {text,model}=await callAnthropic(PLAN_SYSTEM_PROMPT,userText);
    const plan=parseJsonLoose(text); validatePlan(plan);
    return res.json({plan,rawText:text,model});
  } catch(err) { return res.status(err.status||502).json({error:err.message,detail:err.detail}); }
});

app.post('/api/execute', async (req,res)=>{
  try { const {plan}=req.body||{}; validatePlan(plan); const results=await executeOdooPlan(plan); return res.json({results,source:'live_odoo_mcp'}); }
  catch(err) { return res.status(err.status||502).json({error:err.message,detail:err.detail}); }
});

const VALID_COMPONENT_TYPES=['kpi','table','bar_chart','line_chart','area_chart','pie_chart','scatter_chart','insight'];
function validateSchema(s){if(!s||typeof s!=='object'||typeof s.title!=='string'||!Array.isArray(s.components))return false;return s.components.every(c=>c&&VALID_COMPONENT_TYPES.includes(c.type));}

app.post('/api/present', async (req,res)=>{
  const {question,plan,results}=req.body||{};
  if(!question||!plan||!results)return res.status(400).json({error:'question, plan and results are required'});
  try {
    const prompt=`Original question:\n${question}\n\nExecuted Odoo MCP plan:\n${JSON.stringify(plan)}\n\nLIVE factual Odoo results:\n${JSON.stringify(results)}`;
    const {text,model}=await callAnthropic('You output only the JSON object described in the instructions below — no other text.',PRESENT_SYSTEM_PROMPT+'\n\n'+prompt);
    const schema=parseJsonLoose(text); if(!validateSchema(schema))throw new Error('Claude returned an invalid UI schema.');
    return res.json({schema,rawText:text,model});
  } catch(err){return res.status(err.status||502).json({error:err.message,detail:err.detail});}
});

app.get('/healthz',(req,res)=>res.json({ok:true,aiConfigured:!!ANTHROPIC_API_KEY,odooMcpConfigured:!!(ODOO_MCP_URL&&ODOO_MCP_KEY),model:MODEL,dataSource:'live_odoo_mcp'}));
const PORT=process.env.PORT||3000;
app.listen(PORT,()=>console.log(`Qimam AI Sales — LIVE Odoo MCP — listening on :${PORT}`));
