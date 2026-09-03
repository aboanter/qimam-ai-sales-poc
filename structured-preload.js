// Preload wrapper: enforce Anthropic Structured Outputs for the presentation call
// without changing the business/query engine in server.js.

const originalFetch = global.fetch;

// Keep the JSON Schema intentionally conservative. Anthropic Structured Outputs
// supports a subset of JSON Schema; avoid unsupported array constraints such as
// maxItems and avoid nullable union types where omission works just as well.
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

          // KPI fields
          value: { type: 'number' },
          format: { type: 'string', enum: ['currency','number','percent'] },
          trend: { type: 'string', enum: ['good','warn'] },

          // Insight fields
          severity: { type: 'string', enum: ['info','warning','positive'] },
          text: { type: 'string' },

          // Table fields. Cells are strings to keep the structured-output schema
          // simple; Claude may format factual numeric values as strings here.
          columns: { type: 'array', items: { type: 'string' } },
          rows: {
            type: 'array',
            items: { type: 'array', items: { type: 'string' } }
          },

          // Categorical chart fields
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

          // Scatter chart fields
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

      // The second call has this exact system prompt in server.js.
      if (body.system === 'You output only the JSON object described in the instructions below — no other text.') {
        body.max_tokens = 6000;
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
    // If the wrapper itself cannot inspect the request, let server.js handle the request normally.
    console.error('structured-preload inspection error:', e.message);
  }
  return originalFetch(url, options);
};

require('./server.js');
