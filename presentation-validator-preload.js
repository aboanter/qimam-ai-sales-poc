// Deterministic post-presentation validator.
// Runs after structured-preload has inflated the UI JSON and before server.js returns it.
require('./structured-preload.js');

const structuredFetch = global.fetch;
const PRESENTATION_SYSTEM = 'You output only the JSON object described in the instructions below — no other text.';

function normLabel(v) {
  return String(v == null ? '' : v).trim().replace(/\s+/g, ' ').toLowerCase();
}

function sameLabelSet(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length || !a.length) return false;
  const as = a.map(normLabel).sort();
  const bs = b.map(normLabel).sort();
  return as.every((v, i) => v === bs[i]);
}

function findTableOrder(chart, tables) {
  const cats = Array.isArray(chart.categories) ? chart.categories : [];
  if (cats.length < 2) return null;
  for (const table of tables) {
    if (!Array.isArray(table.rows) || !table.rows.length) continue;
    const width = Math.max(...table.rows.map(r => Array.isArray(r) ? r.length : 0), 0);
    for (let col = 0; col < width; col++) {
      const labels = table.rows.map(r => Array.isArray(r) ? r[col] : null).filter(v => v != null && String(v).trim() !== '');
      if (!sameLabelSet(cats, labels)) continue;
      return labels;
    }
  }
  return null;
}

function reorderChart(chart, order) {
  const cats = Array.isArray(chart.categories) ? chart.categories.slice() : [];
  if (!Array.isArray(order) || order.length !== cats.length || !sameLabelSet(cats, order)) return false;
  const indexByLabel = new Map();
  cats.forEach((label, i) => indexByLabel.set(normLabel(label), i));
  const indices = order.map(label => indexByLabel.get(normLabel(label)));
  if (indices.some(i => !Number.isInteger(i))) return false;
  chart.categories = order.slice();
  if (Array.isArray(chart.series)) {
    chart.series = chart.series.map(series => ({
      ...series,
      data: Array.isArray(series.data) ? indices.map(i => series.data[i]) : series.data
    }));
  }
  return true;
}

function looksLikeRanking(chart) {
  const t = String(chart.title || '').toLowerCase();
  return /(أبرز|ابرز|أكبر|اكبر|أفضل|افضل|أعلى|اعلى|top|مساهم|عملاء|customers|contributors)/i.test(t);
}

function sortRankingChartDescending(chart) {
  if (!looksLikeRanking(chart) || !Array.isArray(chart.categories) || !Array.isArray(chart.series) || !chart.series.length) return false;
  const first = chart.series[0];
  if (!Array.isArray(first.data) || first.data.length !== chart.categories.length || chart.categories.length < 2) return false;
  const rows = chart.categories.map((label, i) => ({ label, i, value: Number(first.data[i]) }));
  if (rows.some(r => !Number.isFinite(r.value))) return false;
  const sorted = rows.slice().sort((a, b) => b.value - a.value);
  const already = sorted.every((r, i) => r.i === i);
  if (already) return false;
  const indices = sorted.map(r => r.i);
  chart.categories = sorted.map(r => r.label);
  chart.series = chart.series.map(series => ({
    ...series,
    data: Array.isArray(series.data) && series.data.length === indices.length ? indices.map(i => series.data[i]) : series.data
  }));
  return true;
}

function validatePresentation(ui) {
  if (!ui || !Array.isArray(ui.components)) return ui;
  const tables = ui.components.filter(c => c && c.type === 'table');
  for (const chart of ui.components) {
    if (!chart || !['bar_chart', 'pie_chart'].includes(chart.type)) continue;
    const tableOrder = findTableOrder(chart, tables);
    if (tableOrder) reorderChart(chart, tableOrder);
    else sortRankingChartDescending(chart);
  }
  ui.presentationValidationVersion = '1.0';
  return ui;
}

global.fetch = async function validatedPresentationFetch(url, options = {}) {
  let isPresentation = false;
  try {
    if (String(url).includes('api.anthropic.com/v1/messages') && options.body) {
      const body = JSON.parse(options.body);
      isPresentation = body.system === PRESENTATION_SYSTEM;
    }
  } catch {}

  const response = await structuredFetch(url, options);
  if (!isPresentation || !response.ok) return response;

  try {
    const payload = await response.clone().json();
    if (!Array.isArray(payload.content)) return response;
    for (const block of payload.content) {
      if (block && block.type === 'text' && typeof block.text === 'string') {
        const ui = JSON.parse(block.text);
        block.text = JSON.stringify(validatePresentation(ui));
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
    console.error('presentation-validator non-fatal error:', e.message);
    return response;
  }
};
