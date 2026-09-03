// Preload wrapper: enforce Anthropic Structured Outputs for the presentation call
// without changing the business/query engine in server.js.

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
      maxItems: 20,
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
          value: { type: ['number','string','null'] },
          format: { type: ['string','null'], enum: ['currency','number','percent',null] },
          trend: { type: ['string','null'], enum: ['good','warn',null] },
          severity: { type: ['string','null'], enum: ['info','warning','positive',null] },
          text: { type: ['string','null'] },
          columns: { type: ['array','null'], items: { type: 'string' } },
          rows: {
            type: ['array','null'],
            items: { type: 'array', items: { type: ['string','number','boolean','null'] } }
          },
          categories: { type: ['array','null'], items: { type: ['string','number'] } },
          series: {
            type: ['array','null'],
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
          horizontal: { type: ['boolean','null'] },
          xLabel: { type: ['string','null'] },
          yLabel: { type: ['string','null'] },
          points: {
            type: ['array','null'],
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
