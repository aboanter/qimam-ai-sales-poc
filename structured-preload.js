// Runtime wrapper for the live Claude POC.
// 1) Use Claude Sonnet 4.6 by default for lower latency.
// 2) Extend server.js's effective Anthropic timeout.
// 3) Enforce a deliberately SIMPLE Structured Output schema on the presentation call.
//    Each component carries its type/title plus a JSON-encoded `data` string.
//    We inflate that string back into the flat component object expected by the
//    existing renderer before server.js sees the Anthropic response.

if (!process.env.ANTHROPIC_MODEL) {
  process.env.ANTHROPIC_MODEL = 'claude-sonnet-4-6';
}

const NativeAbortController = global.AbortController;
if (NativeAbortController) {
  global.AbortController = class RelaxedAbortController extends NativeAbortController {
    abort(reason) {
      // server.js asks to abort after 30s; delay the actual abort by another 90s.
      setTimeout(() => super.abort(reason), 90000);
    }
  };
}

const originalFetch = global.fetch;

const uiSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'summary', 'components'],
  properties: {
    title: { type: 'string' },
    summary: { type: 'string' },
    components: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['type', 'title', 'data'],
        properties: {
          type: {
            type: 'string',
            enum: ['kpi','table','bar_chart','line_chart','area_chart','pie_chart','scatter_chart','insight']
          },
          title: { type: 'string' },
          data: { type: 'string' }
        }
      }
    }
  }
};

const PRESENTATION_SYSTEM = 'You output only the JSON object described in the instructions below — no other text.';

function addCompactSchemaInstruction(body) {
  const extra = `\n\nIMPORTANT STRUCTURED-OUTPUT ADAPTER:\nThe response schema represents each UI component as exactly {type, title, data}. Put ALL component-specific fields inside \"data\" as a JSON-encoded string. Do not duplicate type/title inside data.\n\nSTRICT SIZE RULES FOR THIS INTERACTIVE POC:\n- Prefer 4 to 8 total components; never exceed 8.\n- Summary: maximum 3 concise Arabic sentences.\n- A chart should normally contain at most 12 categories/points. Use top-N or monthly/quarterly aggregation rather than dumping raw rows.\n- Tables: maximum 10 rows and only columns needed to answer the question.\n- Do not repeat the same factual information in multiple components unless comparison genuinely needs it.\n- Choose the smallest useful set of visualizations. Dynamic does NOT mean large.\n\nExamples of data strings:\n- KPI: {\"value\":12345,\"format\":\"currency\",\"trend\":\"good\"}\n- insight: {\"severity\":\"warning\",\"text\":\"...\"}\n- bar/line/area/pie: {\"categories\":[\"A\",\"B\"],\"series\":[{\"name\":\"المبيعات\",\"data\":[1,2]}],\"horizontal\":false}\n- scatter: {\"xLabel\":\"...\",\"yLabel\":\"...\",\"points\":[{\"x\":1,\"y\":2,\"label\":\"...\"}]}\n- table: {\"columns\":[\"العميل\",\"المبيعات\"],\"rows\":[[\"أ\",\"1000\"],[\"ب\",\"800\"]]}\nThe analytical choices remain fully dynamic; these are only output-size constraints.`;

  if (Array.isArray(body.messages) && body.messages.length) {
    const last = body.messages[body.messages.length - 1];
    if (typeof last.content === 'string') last.content += extra;
  }
}

function inflateUiObject(obj) {
  if (!obj || !Array.isArray(obj.components)) return obj;
  obj.components = obj.components.map((c) => {
    let extra = {};
    try {
      extra = c.data ? JSON.parse(c.data) : {};
    } catch (e) {
      throw new Error(`Invalid component data JSON for ${c.type}: ${e.message}`);
    }
    return { type: c.type, title: c.title, ...extra };
  });
  return obj;
}

global.fetch = async function(url, options = {}) {
  let isPresentation = false;
  try {
    if (String(url).includes('api.anthropic.com/v1/messages') && options.body) {
      const body = JSON.parse(options.body);
      isPresentation = body.system === PRESENTATION_SYSTEM;

      if (isPresentation) {
        // The previous 3000-token cap truncated a valid structured JSON response.
        // Give enough headroom while the prompt-level size rules keep normal output compact.
        body.max_tokens = 6000;
        addCompactSchemaInstruction(body);
        body.output_config = {
          format: {
            type: 'json_schema',
            schema: uiSchema
          }
        };
        options = { ...options, body: JSON.stringify(body) };
      }
    }
  } catch (e) {
    console.error('structured-preload request inspection error:', e.message);
  }

  const response = await originalFetch(url, options);
  if (!isPresentation || !response.ok) return response;

  try {
    const payload = await response.clone().json();
    if (!Array.isArray(payload.content)) return response;

    for (const block of payload.content) {
      if (block && block.type === 'text' && typeof block.text === 'string') {
        const compact = JSON.parse(block.text);
        const inflated = inflateUiObject(compact);
        block.text = JSON.stringify(inflated);
      }
    }

    const headers = new Headers(response.headers);
    headers.set('content-type', 'application/json');
    return new Response(JSON.stringify(payload), {
      status: response.status,
      statusText: response.statusText,
      headers
    });
  } catch (e) {
    console.error('structured-preload response inflation error:', e.message);
    return response;
  }
};

require('./server.js');
