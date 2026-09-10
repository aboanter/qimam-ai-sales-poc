'use strict';

/**
 * Qimam Generative Presentation V4 core.
 * Pure deterministic materializer: Design Manifest + factual datasets => current UI schema.
 * No LLM calls, no DOM, no Odoo access.
 */

const CHART_TYPES = new Set(['bar_chart','line_chart','area_chart','pie_chart','donut_chart']);
const COMPONENT_TYPES = new Set(['kpi','table','bar_chart','line_chart','area_chart','pie_chart','donut_chart','insight']);
const LAYOUTS = new Set(['wide','grid','split','stack','strip']);
const SUPPORTED_ICONS = new Set(['trend','revenue','receipt','return','profit','warning','users','cart','invoice','chart','wallet','check','clock','spark']);
const ICON_ALIASES = {
  'trending-up':'trend','trending_up':'trend','arrow-up-right':'trend','growth':'trend',
  'shopping-cart':'cart','shopping_cart':'cart','basket':'cart',
  'dollar-sign':'revenue','dollar':'revenue','money':'revenue','sales':'revenue',
  'file-text':'invoice','file_invoice':'invoice','document':'invoice',
  'bar-chart':'chart','bar_chart':'chart','analytics':'chart',
  'credit-card':'wallet','credit_card':'wallet',
  'user':'users','customers':'users',
  'alert-triangle':'warning','alert':'warning',
  'check-circle':'check','check_circle':'check',
  'time':'clock'
};
const AR_MONTHS=['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];

function clone(v){ return v == null ? v : JSON.parse(JSON.stringify(v)); }
function isObj(v){ return !!v && typeof v === 'object' && !Array.isArray(v); }
function num(v){
  if(typeof v === 'number' && Number.isFinite(v)) return v;
  if(typeof v === 'string'){
    const n = Number(v.replace(/,/g,''));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}
function label(v){
  if(v == null) return '';
  if(Array.isArray(v)) return String(v[1] ?? v[0] ?? '');
  if(isObj(v)) return String(v.display_name ?? v.name ?? v.label ?? v.value ?? '');
  return String(v);
}
function normalizeIcon(icon){
  if(!icon) return null;
  if(isObj(icon)){
    const out=clone(icon);
    if(out.name){
      const raw=String(out.name).toLowerCase();
      out.name=SUPPORTED_ICONS.has(raw)?raw:(ICON_ALIASES[raw]||'spark');
    }
    return out;
  }
  const raw=String(icon).trim().toLowerCase();
  const name=SUPPORTED_ICONS.has(raw)?raw:(ICON_ALIASES[raw]||'spark');
  return {name};
}
function displayCategory(v,labelField){
  const raw=label(v).trim();
  if(!raw) return '';
  const fieldName=String(labelField||'').toLowerCase();
  if(fieldName.includes(':month') || fieldName.endsWith('_month') || /^\d{4}-\d{2}-01(?:[ t].*)?$/.test(raw)){
    const m=raw.match(/^(\d{4})-(\d{2})-/);
    if(m){
      const month=Number(m[2]);
      if(month>=1&&month<=12)return `${AR_MONTHS[month-1]} ${m[1]}`;
    }
  }
  return raw;
}
function field(row,key){
  if(!isObj(row) || !key) return undefined;
  if(Object.prototype.hasOwnProperty.call(row,key)) return row[key];
  if(String(key).endsWith(':sum')){
    const base = String(key).slice(0,-4);
    if(Object.prototype.hasOwnProperty.call(row,base)) return row[base];
  }
  if(String(key).endsWith('_count') && Object.prototype.hasOwnProperty.call(row,'__count')) return row.__count;
  return undefined;
}
function rowsOf(value){
  if(Array.isArray(value)) return value;
  if(!isObj(value)) return [];
  for(const k of ['records','rows','data','result','results','items']) if(Array.isArray(value[k])) return value[k];
  return [];
}
function datasetRows(datasets,name){
  if(!name) return [];
  if(Array.isArray(datasets)){
    const exact = datasets.find((x,i)=>String(x?.name ?? x?.operation ?? x?.id ?? `operation_${i+1}`) === String(name));
    return rowsOf(exact);
  }
  if(isObj(datasets)) return rowsOf(datasets[name]);
  return [];
}
function aggregate(rows,key,mode='sum'){
  if(mode === 'count'){
    if(key) return rows.reduce((s,r)=>s + (num(field(r,key)) ?? 0),0);
    return rows.length;
  }
  const vals = rows.map(r=>num(field(r,key))).filter(Number.isFinite);
  if(!vals.length) return null;
  if(mode === 'first') return vals[0];
  if(mode === 'avg' || mode === 'average') return vals.reduce((a,b)=>a+b,0)/vals.length;
  if(mode === 'min') return Math.min(...vals);
  if(mode === 'max') return Math.max(...vals);
  return vals.reduce((a,b)=>a+b,0);
}
function sortRows(rows,spec={}){
  const out = rows.slice();
  const direction = spec.sort === 'asc' || spec.sort === 'desc' ? spec.sort : 'none';
  const key = spec.sortField || spec.valueField || spec.y || spec.x;
  if(direction !== 'none' && key){
    out.sort((a,b)=>{
      const av=field(a,key), bv=field(b,key), an=num(av), bn=num(bv);
      if(an !== null || bn !== null) return direction === 'asc' ? (an ?? 0)-(bn ?? 0) : (bn ?? 0)-(an ?? 0);
      const as=label(av), bs=label(bv);
      return direction === 'asc' ? as.localeCompare(bs) : bs.localeCompare(as);
    });
  }
  const limit = Math.max(1,Math.min(Number(spec.limit)||100,500));
  return out.slice(0,limit);
}
function groupPairs(rows,labelField,valueField,aggregateMode='sum'){
  const grouped = new Map();
  for(const r of rows){
    const l = label(field(r,labelField)).trim();
    if(!l) continue;
    const v = aggregateMode === 'count' ? (num(field(r,valueField || '__count')) ?? 1) : num(field(r,valueField));
    if(v === null) continue;
    grouped.set(l,(grouped.get(l)||0)+v);
  }
  return [...grouped.entries()].map(([label,value])=>({label,value}));
}
function resolveSection(component,sectionIndex){
  const s = component.section || {};
  const layout = LAYOUTS.has(s.layout) ? s.layout : 'wide';
  return {
    id: String(s.id || `section_${sectionIndex+1}`),
    title: s.title ? String(s.title) : undefined,
    presentation: String(s.presentation || 'panel'),
    layout,
    order: Number.isFinite(Number(s.order)) ? Number(s.order) : sectionIndex+1,
    ...(s.columns ? {columns:Math.max(1,Math.min(Number(s.columns)||1,6))} : {})
  };
}
function baseComponent(spec,index){
  const type = String(spec.type||'');
  if(!COMPONENT_TYPES.has(type)) throw new Error(`Unsupported component type: ${type || '(missing)'}`);
  return {
    type,
    title:String(spec.title || ''),
    id:String(spec.id || `v4_${type}_${index+1}`),
    section:resolveSection(spec,index),
    ...(isObj(spec.componentLayout) ? {componentLayout:clone(spec.componentLayout)} : {})
  };
}
function buildKpi(spec,rows,index){
  const out = baseComponent(spec,index);
  const value = spec.value != null ? num(spec.value) : aggregate(rows,spec.field || spec.valueField,spec.aggregate || 'sum');
  if(value === null) throw new Error(`KPI ${out.id} produced no numeric value`);
  out.value=value;
  out.format=spec.format || 'number';
  if(spec.currencyLabel) out.currencyLabel=String(spec.currencyLabel);
  if(spec.numberLocale) out.numberLocale=String(spec.numberLocale);
  if(spec.icon) out.icon=normalizeIcon(spec.icon);
  return out;
}
function buildChart(spec,rows,index){
  const out = baseComponent(spec,index);
  const labelField = spec.labelField || spec.categoryField || spec.x;
  const valueField = spec.valueField || spec.seriesField || spec.y;
  if(!labelField || !valueField) throw new Error(`Chart ${out.id} requires label/category and value/series fields`);
  let pairs;
  if(spec.group === true || spec.aggregateByLabel === true){
    pairs = groupPairs(rows,labelField,valueField,spec.aggregate || 'sum');
    if(spec.sort === 'asc') pairs.sort((a,b)=>a.value-b.value);
    if(spec.sort === 'desc') pairs.sort((a,b)=>b.value-a.value);
    pairs = pairs.slice(0,Math.max(1,Math.min(Number(spec.limit)||100,500)));
  }else{
    pairs = sortRows(rows,{...spec,sortField:spec.sortField || (spec.sortBy === 'label' ? labelField : spec.sortField)}).map(r=>({label:displayCategory(field(r,labelField),labelField),value:num(field(r,valueField))})).filter(p=>p.label && Number.isFinite(p.value));
  }
  if(!pairs.length) throw new Error(`Chart ${out.id} produced no plottable data`);
  out.categories=pairs.map(p=>p.label);
  out.series=[{name:String(spec.seriesLabel || spec.seriesName || out.title || 'القيمة'),data:pairs.map(p=>p.value)}];
  return out;
}
function buildTable(spec,rows,index){
  const out=baseComponent(spec,index);
  if(!Array.isArray(spec.columns) || !spec.columns.length) throw new Error(`Table ${out.id} requires columns`);
  const rr=sortRows(rows,spec);
  out.columns=spec.columns.map(c=>typeof c === 'string' ? c : String(c.title || c.label || c.field || ''));
  out.rows=rr.map(r=>spec.columns.map(c=>{
    if(typeof c === 'string') return field(r,c) ?? '';
    const v=field(r,c.field);
    return Array.isArray(v) || isObj(v) ? label(v) : (v ?? '');
  }));
  return out;
}
function buildInsight(spec,index){
  const out=baseComponent(spec,index);
  const items = Array.isArray(spec.items) ? spec.items : [];
  out.items=items.map(x=>typeof x === 'string' ? {text:x} : {text:String(x.text || ''), ...(x.icon ? {icon:x.icon} : {})}).filter(x=>x.text);
  if(spec.text && !out.items.length) out.text=String(spec.text);
  return out;
}
function materializeComponent(spec,datasets,index){
  const rows = spec.dataset ? datasetRows(datasets,spec.dataset) : [];
  if(spec.dataset && !rows.length) throw new Error(`Dataset not found or empty: ${spec.dataset}`);
  if(spec.type === 'kpi') return buildKpi(spec,rows,index);
  if(CHART_TYPES.has(spec.type)){
    const normalized={...spec,type:spec.type === 'donut_chart' ? 'pie_chart' : spec.type};
    return buildChart(normalized,rows,index);
  }
  if(spec.type === 'table') return buildTable(spec,rows,index);
  if(spec.type === 'insight') return buildInsight(spec,index);
  throw new Error(`Unsupported component type: ${spec.type}`);
}
function flattenManifest(manifest){
  if(Array.isArray(manifest?.components)) return manifest.components.map(clone);
  const out=[];
  for(const [si,section] of (manifest?.sections || []).entries()){
    for(const component of (section?.components || [])){
      out.push({
        ...clone(component),
        section:{
          id:section.id || `section_${si+1}`,
          title:section.title,
          layout:section.layout || 'wide',
          presentation:section.presentation || 'panel',
          order:section.order ?? si+1,
          columns:section.columns
        }
      });
    }
  }
  return out;
}
function validateManifest(manifest,datasets){
  const errors=[];
  if(!isObj(manifest)) return {ok:false,errors:['manifest must be an object']};
  const components=flattenManifest(manifest);
  if(!components.length) errors.push('manifest contains no components');
  components.forEach((c,i)=>{
    if(!COMPONENT_TYPES.has(String(c.type||''))) errors.push(`component[${i}] unsupported type ${String(c.type||'(missing)')}`);
    if(c.dataset && !datasetRows(datasets,c.dataset).length) errors.push(`component[${i}] missing dataset ${c.dataset}`);
    if(CHART_TYPES.has(c.type) && !(c.labelField||c.categoryField||c.x)) errors.push(`component[${i}] chart missing label field`);
    if(CHART_TYPES.has(c.type) && !(c.valueField||c.seriesField||c.y)) errors.push(`component[${i}] chart missing value field`);
    if(c.type==='table' && (!Array.isArray(c.columns)||!c.columns.length)) errors.push(`component[${i}] table missing columns`);
  });
  return {ok:!errors.length,errors};
}
function buildPresentation(manifest,datasets,{strict=true}={}){
  const validation=validateManifest(manifest,datasets);
  if(strict && !validation.ok) throw new Error(`Invalid presentation manifest: ${validation.errors.join('; ')}`);
  const specs=flattenManifest(manifest);
  const components=[], failures=[];
  specs.forEach((spec,i)=>{
    try{ components.push(materializeComponent(spec,datasets,i)); }
    catch(e){ failures.push({index:i,id:spec.id||null,error:e.message}); if(strict) throw e; }
  });
  return {
    title:String(manifest.title || ''),
    summary:String(manifest.summary || ''),
    components,
    designSystem:isObj(manifest.designSystem) ? clone(manifest.designSystem) : {},
    generativeUiVersion:4,
    presentationBuilderVersion:'4.0.0-alpha.2',
    presentationManifestVersion:'1.0',
    materialization:{components:components.length,failures}
  };
}

module.exports={
  COMPONENT_TYPES:[...COMPONENT_TYPES],
  validateManifest,
  buildPresentation,
  materializeComponent,
  datasetRows,
  field,
  label,
  num,
  normalizeIcon,
  displayCategory
};
