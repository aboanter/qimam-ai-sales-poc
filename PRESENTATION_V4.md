# Qimam Generative Presentation V4

This branch is intentionally isolated from `main`. The production/startup chain is unchanged.

## Goal

Separate intelligence from mechanical rendering:

- Odoo/MCP: factual data
- Analyst: semantic analysis
- Art Director LLM: compact design decisions only
- Local Presentation Builder: deterministic data binding and materialization into the existing UI schema

The Art Director must not copy Odoo rows, chart series, or tables into its answer. It references named datasets and fields.

## V4 flow

```text
Question
  -> Planner / MCP / Analyst
  -> dataset catalog + semantic summary
  -> Art Director returns compact Presentation Manifest
  -> presentation-v4-core validates the manifest
  -> presentation-v4-core binds real datasets locally
  -> existing Qimam renderer receives ordinary components
```

## Example manifest

```json
{
  "title": "لوحة المبيعات التنفيذية",
  "sections": [
    {
      "id": "overview",
      "layout": "grid",
      "presentation": "hero",
      "components": [
        {
          "type": "kpi",
          "title": "إجمالي المبيعات",
          "dataset": "sales_summary",
          "field": "amount_total:sum",
          "aggregate": "sum",
          "format": "currency",
          "currencyLabel": "ر.س"
        }
      ]
    },
    {
      "id": "trend",
      "layout": "wide",
      "components": [
        {
          "type": "area_chart",
          "title": "الاتجاه الشهري",
          "dataset": "monthly_sales",
          "labelField": "date_order:month",
          "valueField": "amount_total:sum",
          "sort": "asc",
          "sortField": "date_order:month"
        }
      ]
    }
  ]
}
```

The builder converts that manifest plus raw datasets to the current UI shape (`value`, `categories`, `series`, `columns`, `rows`, `section`, etc.). This means the current frontend renderer can be reused instead of replaced.

## Current alpha scope

Supported components:

- KPI
- Table
- Bar chart
- Line chart
- Area chart
- Pie / Donut chart
- Insight

Supported layouts:

- wide
- grid
- split
- stack
- strip

The core supports Odoo-style many2one labels, `:sum` fields, `__count`, sorting, limiting, grouping duplicate categories, and local aggregation.

## Implemented alpha layers

1. `presentation-v4-core.js` — deterministic manifest validation and materialization.
2. `presentation-v4-catalog.js` — converts Planner/MCP operations and results into named datasets plus a compact field catalog.
3. `presentation-v4-contract.js` — compact Art Director contract; the LLM references datasets instead of copying data.
4. `presentation-v4-art-director.js` — builds a small prompt, parses JSON manifests and estimates prompt size.
5. `presentation-v4-shadow.js` — isolated shadow harness with injected Art Director function; validates and materializes V4 without affecting V3.

## Internal tests

Run locally with:

```bash
node tests/run-v4-tests.js
```

The suite currently covers:

- KPI local aggregation
- chronological charts
- categorical rankings
- duplicate status aggregation for pie charts
- Odoo many2one labels
- tables
- dataset catalog field/type inference
- compact prompt generation
- malformed/missing dataset rejection
- same factual datasets rendered through different manifests (charts vs tables)
- shadow orchestration end-to-end with a mocked Art Director

All deterministic tests passed during development before these files were committed.

## Safety / migration strategy

Nothing in this branch changes `package.json`, the current preload chain, the current Render startup command, or the V3.5.1 fallback. V4 stays dark until a real Art Director call and Render shadow integration are tested.

The rollout remains gradual:

1. Pure local core + unit tests. **Done.**
2. Dataset catalog generator from the existing Planner/MCP envelope. **Done.**
3. Small Art Director V4 prompt returning manifests only. **Done (adapter + contract).**
4. Shadow orchestration that can run beside V3 without replacing it. **Core harness done; real Anthropic/Render wiring intentionally not enabled yet.**
5. Optional feature flag for V4.
6. Only after repeated successful live tests, consider making V4 the default while retaining V3 fallback.
