# Qimam AI Sales Analytics — Live Claude (two-stage) architecture

Every answer requires two real, sequential Anthropic API calls. There is no
local fallback of any kind — if either call fails, the UI shows an explicit
error, never a locally-guessed substitute.

## Architecture

    User question
      -> POST /api/plan          (Claude call #1: decides WHAT to compute)
      -> deterministic engine.js  (pure arithmetic: filter/group/aggregate/
                                    scatter-points/quadrant-segment — no
                                    presentation logic of any kind)
      -> POST /api/present        (Claude call #2: given the real computed
                                    results, decides the ENTIRE presentation —
                                    which KPIs, which charts, chart type,
                                    axes, tables, insights, and their order)
      -> generic renderer         (knows how to draw kpi/table/bar/line/area/
                                    pie/scatter/insight; has no say in which
                                    ones are used or how many)

`public/engine.js` is the single source of truth for the mock dataset and
the executor, loaded both by the server (`require`) and the browser
(`<script src="engine.js">`) so there's exactly one implementation to
maintain.

The developer panel on every answer shows, verbatim: the model used for
call #1, the query plan Claude returned, the actual factual results the
engine computed, the model used for call #2, Claude's raw presentation
response, the final UI JSON, and an explicit "no fallback was used" line.
A pulsing "AI MODE: LIVE CLAUDE" badge only appears once both calls have
genuinely succeeded.

## Local run
    npm install
    ANTHROPIC_API_KEY=sk-ant-... npm start
    open http://localhost:3000

## Deploy
Push this repo anywhere Render (or similar) can clone it, create a Node web
service (build: `npm install`, start: `npm start`), and set
`ANTHROPIC_API_KEY` directly in the host's dashboard — never in code, never
in chat.
