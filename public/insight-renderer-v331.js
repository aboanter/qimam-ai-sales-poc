// Insight Renderer V3.3.1 — renders structured insight arrays returned by the presentation model.
(function(){
  const upstream=window.renderComponent;
  if(typeof upstream!=='function')return;

  function cleanText(v){
    if(typeof v==='string')return v.trim();
    if(v&&typeof v==='object'&&typeof v.text==='string')return v.text.trim();
    return '';
  }
  function kind(v){
    const k=String(v?.type||'info').toLowerCase();
    return ['critical','warning','positive','trend','info'].includes(k)?k:'info';
  }
  function iconFor(k){return k==='critical'?'!':k==='warning'?'!':k==='positive'?'✓':k==='trend'?'↗':'i'}

  function renderStructuredInsight(c,cell){
    if(!Array.isArray(c?.insights)||!c.insights.length)return false;
    const items=c.insights.map(x=>({text:cleanText(x),type:kind(x)})).filter(x=>x.text);
    if(!items.length)return false;

    cell.replaceChildren();
    const box=document.createElement('div');box.className='insight qinsight-v331';
    if(c.title){const h=document.createElement('h3');h.textContent=c.title;box.appendChild(h)}
    const list=document.createElement('div');list.className='qinsight-list-v331';
    for(const item of items){
      const row=document.createElement('div');row.className=`qinsight-item-v331 qinsight-${item.type}`;
      const mark=document.createElement('span');mark.className='qinsight-mark-v331';mark.textContent=iconFor(item.type);
      const text=document.createElement('div');text.className='qinsight-text-v331';text.textContent=item.text;
      row.append(mark,text);list.appendChild(row);
    }
    box.appendChild(list);cell.appendChild(box);return true;
  }

  window.renderComponent=function insightRendererV331(c,cell){
    if(c&&c.type==='insight'&&renderStructuredInsight(c,cell))return;
    return upstream(c,cell);
  };

  if(!document.getElementById('qimam-insight-v331-css')){
    const s=document.createElement('style');s.id='qimam-insight-v331-css';s.textContent=`
.qinsight-v331{background:transparent!important;border:0!important;padding:0!important;box-shadow:none!important}
.qinsight-v331>h3{margin:0 0 14px;font-size:clamp(17px,2.2vw,22px);color:var(--q-text,#102b43)}
.qinsight-list-v331{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
.qinsight-item-v331{display:grid;grid-template-columns:34px minmax(0,1fr);gap:11px;align-items:start;padding:14px 15px;border-radius:16px;background:var(--q-surface,#fff);border:1px solid var(--q-border,#dfeaec);line-height:1.85;min-width:0}
.qinsight-mark-v331{display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:10px;font-size:13px;font-weight:900;background:color-mix(in srgb,var(--q-accent,#0b9da6) 11%,transparent);color:var(--q-accent,#0b9da6)}
.qinsight-text-v331{font-size:13.5px;color:var(--q-text,#102b43);overflow-wrap:anywhere}
.qinsight-critical{border-inline-start:4px solid var(--q-negative,#dc2626)}.qinsight-critical .qinsight-mark-v331{background:color-mix(in srgb,var(--q-negative,#dc2626) 12%,transparent);color:var(--q-negative,#dc2626)}
.qinsight-warning{border-inline-start:4px solid var(--q-warning,#f59e0b)}.qinsight-warning .qinsight-mark-v331{background:color-mix(in srgb,var(--q-warning,#f59e0b) 12%,transparent);color:var(--q-warning,#f59e0b)}
.qinsight-positive{border-inline-start:4px solid var(--q-positive,#059669)}.qinsight-positive .qinsight-mark-v331{background:color-mix(in srgb,var(--q-positive,#059669) 12%,transparent);color:var(--q-positive,#059669)}
.qinsight-trend{border-inline-start:4px solid var(--q-accent2,#0ea5e9)}.qinsight-trend .qinsight-mark-v331{background:color-mix(in srgb,var(--q-accent2,#0ea5e9) 12%,transparent);color:var(--q-accent2,#0ea5e9)}
@media(max-width:720px){.qinsight-list-v331{grid-template-columns:1fr}.qinsight-item-v331{padding:13px}.qinsight-text-v331{font-size:13px}}
`;
    document.head.appendChild(s);
  }
})();
