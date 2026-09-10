'use strict';

const AR_MONTHS=['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
const AR_MONTH_INDEX=new Map(AR_MONTHS.map((m,i)=>[m,i]));
const ICON_ALIASES={
  'trending-up':'trend','trending_up':'trend','arrow-up-right':'trend','growth':'trend',
  'shopping-cart':'cart','shopping_cart':'cart','basket':'cart',
  'dollar-sign':'revenue','dollar':'revenue','money':'revenue','sales':'revenue',
  'file-text':'invoice','file_invoice':'invoice','document':'invoice',
  'bar-chart':'chart','bar_chart':'chart','analytics':'chart',
  'credit-card':'wallet','credit_card':'wallet','user':'users','customers':'users'
};
const SUPPORTED_ICONS=new Set(['trend','revenue','receipt','return','profit','warning','users','cart','invoice','chart','wallet','check','clock','spark']);

function clone(v){return v==null?v:JSON.parse(JSON.stringify(v))}
function hasArabic(v){return /[\u0600-\u06FF]/.test(String(v||''))}
function isArabicUi(presentation){
  return hasArabic([presentation?.title,presentation?.summary,...(presentation?.components||[]).map(c=>c?.title)].join(' '));
}
function normalizeIcon(icon){
  if(!icon)return icon;
  if(typeof icon==='string'){
    const raw=icon.toLowerCase();
    return {name:SUPPORTED_ICONS.has(raw)?raw:(ICON_ALIASES[raw]||'spark')};
  }
  if(icon&&typeof icon==='object'){
    const out=clone(icon),raw=String(out.name||'spark').toLowerCase();
    out.name=SUPPORTED_ICONS.has(raw)?raw:(ICON_ALIASES[raw]||'spark');
    return out;
  }
  return icon;
}
function temporalKey(v){
  const s=String(v||'').trim();
  let m=s.match(/^(\d{4})-(\d{2})(?:-(\d{2}))?/);
  if(m){const y=Number(m[1]),mo=Number(m[2]),d=Number(m[3]||1);if(mo>=1&&mo<=12)return y*10000+mo*100+d}
  m=s.match(/^([^\s]+)\s+(\d{4})$/);
  if(m&&AR_MONTH_INDEX.has(m[1]))return Number(m[2])*10000+(AR_MONTH_INDEX.get(m[1])+1)*100+1;
  return null;
}
function formatTemporal(v,arabic){
  const s=String(v||'').trim(),k=temporalKey(s);
  if(k==null||!arabic)return s;
  const y=Math.floor(k/10000),mo=Math.floor((k%10000)/100);
  return mo>=1&&mo<=12?`${AR_MONTHS[mo-1]} ${y}`:s;
}
function recomputeSkew(c){
  if(!['line_chart','area_chart'].includes(c?.type))return;
  const vals=Array.isArray(c.series?.[0]?.data)?c.series[0].data.map(Number):[];
  const positives=vals.map((value,i)=>({value,i})).filter(x=>Number.isFinite(x.value)&&x.value>0);
  const base={...(c.componentLayout||{})};
  for(const k of ['linearScaleNote','highlightExtremes','highIndex','lowIndex','skewRatio'])delete base[k];
  if(positives.length>=3){
    const ranked=positives.slice().sort((a,b)=>b.value-a.value);
    const ratio=ranked[1].value>0?ranked[0].value/ranked[1].value:Infinity;
    if(ratio>=8){
      const low=positives.slice().sort((a,b)=>a.value-b.value)[0];
      Object.assign(base,{linearScaleNote:true,highlightExtremes:true,highIndex:ranked[0].i,lowIndex:low.i,skewRatio:Math.round(ratio*10)/10});
    }
  }
  c.componentLayout=Object.keys(base).length?base:undefined;
}
function normalizeTemporalChart(c,arabic){
  if(!['line_chart','area_chart'].includes(c?.type)||!Array.isArray(c.categories)||c.categories.length<2)return;
  const keyed=c.categories.map((cat,i)=>({i,key:temporalKey(cat)}));
  if(keyed.some(x=>x.key==null))return;
  keyed.sort((a,b)=>a.key-b.key);
  c.categories=keyed.map(x=>formatTemporal(c.categories[x.i],arabic));
  if(Array.isArray(c.series)){
    c.series=c.series.map(s=>({...s,data:keyed.map(x=>Array.isArray(s.data)?s.data[x.i]:undefined)}));
  }
  recomputeSkew(c);
}
function normalizeVisiblePresentation(input){
  const out=clone(input||{}),arabic=isArabicUi(out);
  out.components=(out.components||[]).map(c=>{
    const x=clone(c);
    if(x.type==='kpi'){
      if(x.icon)x.icon=normalizeIcon(x.icon);
      if(x.format==='currency'&&arabic&&(!x.currencyLabel||String(x.currencyLabel).toUpperCase()==='SAR'))x.currencyLabel='ر.س';
    }
    normalizeTemporalChart(x,arabic);
    return x;
  });
  return out;
}

module.exports={normalizeVisiblePresentation,temporalKey,formatTemporal,normalizeIcon,recomputeSkew};
