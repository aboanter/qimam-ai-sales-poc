// Runtime wrapper for the live Claude POC.
// 1) Use Claude Sonnet 4.6 by default for lower latency (thinking is not on by default).
// 2) Extend server.js's effective Anthropic timeout from 30s to ~90s.
// 3) Enforce Structured Outputs on the presentation call.

if (!process.env.ANTHROPIC_MODEL) {
  process.env.ANTHROPIC_MODEL = 'claude-sonnet-4-6';
}

const NativeAbortController = global.AbortController;
if (NativeAbortController) {
  global.AbortController = class RelaxedAbortController extends NativeAbortController {
    abort(reason) {
      // server.js asks to abort after 30s; delay the actual abort by another 60s.
      setTimeout(() => super.abort(reason), 60000);
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
        required: ['type', 'title'],
        properties: {
          type: {
            type: 'string',
            enum: ['kpi','table','bar_chart','line_chart','area_chart','pie_chart','scatter_chart','insight']
          },
          title: { type: 'string' },
          value: { type: 'number' },
          format: { type: 'string', enum: ['currency','number','percent'] },
          trend: { type: 'string', enum: ['good','warn'] },
          severity: { type: 'string', enum: ['info','warning','positive'] },
          text: { type: 'string' },
          columns: { type: 'array', items: { type: 'string' } },
          rows: { type: 'array', items: { type: 'array', items: { type: 'string' } } },
          categories: { type: 'array', items: { type: 'string' } },
          series: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['name','data'],
              properties: {
                name: { type: 'string' },
                data: { type: 'array', items: { type: 'number' } }
              }
            }
          },
          horizontal: { type: 'boolean' },
          xLabel: { type: 'string' },
          yLabel: { type: 'string' },
          points: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['x','y','label'],
              properties: {
                x: { type: 'number' },
                y: { type: 'number' },
                label: { type: 'string' }
              }
            }
          }
        }
      }
    }
  }
};

global.fetch = async function(url, options = {}) {
  try {
    if (String(url).includes('api.anthropic.com/v1/messages') && options.body) {
      const body = JSON.parse(options.body);

      // Presentation call only: make Claude return a schema-valid UI object.
      if (body.system === 'You output only the JSON object described in the instructions below — no other text.') {
        body.max_tokens = 3000;
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
    console.error('structured-preload inspection error:', e.message);
  }
  return originalFetch(url, options);
};

require('./server.js');
