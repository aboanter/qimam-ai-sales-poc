// Qimam Presentation V4 visible-only chart readability enhancer.
// It never changes factual values or axis scale; it only adds truthful context when a
// linear trend is dominated by one extreme value.
(function(){
  const upstreamRender=window.render;
  if(typeof upstreamRender!=='function')return;

  function formatNumber(v){
    const n=Number(v);
    if(!Number.isFinite(n))return String(v??'');
    return new Intl.NumberFormat('en-US',{maximumFractionDigits:2}).format(n);
  }
  function arabicUi(schema){
    const text=[schema?.title,schema?.summary,...(schema?.components||[]).map(c=>c?.title)].join(' ');
    return /[\u0600-\u06FF]/.test(text);
  }
  function chartComponents(schema){
    return (schema?.components||[]).filter(c=>['bar_chart','line_chart','area_chart','pie_chart'].includes(c?.type));
  }
  function enhanceOne(c,block,isArabic){
    const cfg=c?.componentLayout||{};
    if(!cfg.linearScaleNote||!Array.isArray(c.categories)||!Array.isArray(c.series?.[0]?.data))return;
    if(block.querySelector('.qv4-scale-note'))return;
    const values=c.series[0].data.map(Number);
    const hi=Number(cfg.highIndex),lo=Number(cfg.lowIndex);
    if(!Number.isInteger(hi)||!Number.isInteger(lo)||!Number.isFinite(values[hi])||!Number.isFinite(values[lo]))return;
    const note=document.createElement('div');
    note.className='qv4-scale-note';
    note.setAttribute('role','note');
    const high=`${c.categories[hi]} — ${formatNumber(values[hi])}`;
    const low=`${c.categories[lo]} — ${formatNumber(values[lo])}`;
    note.textContent=isArabic
      ? `أعلى فترة: ${high} · أقل فترة: ${low} · المقياس خطي؛ لذلك القيم الصغيرة قد تبدو قريبة من الصفر.`
      : `Highest: ${high} · Lowest: ${low} · Linear scale; smaller values may appear close to zero.`;
    block.appendChild(note);
  }
  function enhance(schema,host){
    if(!schema?.presentationV4||!host)return;
    const comps=chartComponents(schema);
    const blocks=[...host.querySelectorAll('.block')].filter(b=>b.querySelector('.chart'));
    const isArabic=arabicUi(schema);
    comps.forEach((c,i)=>{if(blocks[i])enhanceOne(c,blocks[i],isArabic)});
    schema.presentationV4.chartEnhancerVersion='1.0';
  }

  window.render=function presentationV4ChartEnhancer(schema,host){
    const result=upstreamRender(schema,host);
    enhance(schema,host);
    return result;
  };

  if(!document.getElementById('qimam-presentation-v4-chart-enhancer-css')){
    const s=document.createElement('style');
    s.id='qimam-presentation-v4-chart-enhancer-css';
    s.textContent=`
.qv4-scale-note{margin-top:10px;padding:10px 12px;border-radius:12px;background:color-mix(in srgb,var(--q-accent,#0b9da6) 7%,var(--q-surface,#fff));border:1px solid color-mix(in srgb,var(--q-accent,#0b9da6) 18%,var(--q-border,#dfeaec));color:var(--q-muted,#52677a);font-size:12px;line-height:1.75}
@media(max-width:620px){.qv4-scale-note{font-size:11.5px;padding:9px 10px}}
`;
    document.head.appendChild(s);
  }
})();
