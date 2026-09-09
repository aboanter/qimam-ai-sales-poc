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

## Safety / migration strategy

Nothing in this branch changes `package.json`, the current preload chain, the current Render startup command, or the V3.5.1 fallback. V4 stays dark until its manifest generation and compatibility adapter are tested.

The intended rollout is gradual:

1. Pure local core + unit tests. **Current stage.**
2. Dataset catalog generator from the existing Planner/MCP envelope.
3. Small Art Director V4 prompt returning manifests only.
4. Shadow mode: generate V4 beside V3 but do not show it to users; compare correctness and latency.
5. Optional feature flag for V4.
6. Only after repeated successful tests, consider making V4 the default while retaining V3 fallback.
