// Insight Renderer V3.3.2 — post-render enhancement for structured insight arrays.
// The base page renderer calls its lexical renderComponent directly, so patching
// window.renderComponent is not sufficient. This wrapper works at window.render level.
(function(){
  const upstream=window.render;
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

  function buildInsight(c){
    const items=(Array.isArray(c?.insights)?c.insights:[])
      .map(x=>({text:cleanText(x),type:kind(x)})).filter(x=>x.text);
    if(!items.length)return null;
    const box=document.createElement('div');box.className='insight qinsight-v332';
    if(c.title){const h=document.createElement('h3');h.textContent=c.title;box.appendChild(h)}
    const list=document.createElement('div');list.className='qinsight-list-v332';
    for(const item of items){
      const row=document.createElement('div');row.className=`qinsight-item-v332 qinsight-${item.type}`;
      const mark=document.createElement('span');mark.className='qinsight-mark-v332';mark.textContent=iconFor(item.type);
      const text=document.createElement('div');text.className='qinsight-text-v332';text.textContent=item.text;
      row.append(mark,text);list.appendChild(row);
    }
    box.appendChild(list);return box;
  }

  function enhance(schema,host){
    const insights=(Array.isArray(schema?.components)?schema.components:[])
      .filter(c=>c&&c.type==='insight'&&c.id&&Array.isArray(c.insights)&&c.insights.length);
    for(const c of insights){
      // Layout refs are rendered in component order, but id is not stored in DOM.
      // Find the existing insight block by its unique component title.
      const candidates=[...host.querySelectorAll('.layout-ref, .gen-item')];
      let cell=candidates.find(el=>{
        const h=el.querySelector('.insight h3, .block h3, h3');
        return h&&h.textContent.trim()===String(c.title||'').trim();
      });
      if(!cell){
        // Empty legacy insight has no title/body. Use section metadata as an anchor.
        const secId=String(c.section?.id||'');
        if(secId){
          const groups=(Array.isArray(schema.components)?schema.components:[]).filter(x=>String(x?.section?.id||'')===secId);
          if(groups.length===1){
            const sections=[...host.querySelectorAll('.qv32-section')];
            const orderedIds=[...new Set(schema.components.map(x=>x?.section?.id).filter(Boolean))];
            const idx=orderedIds.indexOf(secId);
            const sec=idx>=0?sections[idx]:null;
            if(sec)cell=sec.querySelector('.layout-ref, .gen-item');
          }
        }
      }
      if(!cell)continue;
      const box=buildInsight(c);if(!box)continue;
      cell.replaceChildren(box);
    }
    schema.insightRendererVersion='3.3.2';
  }

  window.render=function insightRenderV332(schema,host){
    const result=upstream(schema,host);
    enhance(schema,host);
    return result;
  };

  if(!document.getElementById('qimam-insight-v332-css')){
    const s=document.createElement('style');s.id='qimam-insight-v332-css';s.textContent=`
.qinsight-v332{background:transparent!important;border:0!important;padding:0!important;box-shadow:none!important;height:auto!important}
.qinsight-v332>h3{margin:0 0 14px;font-size:clamp(17px,2.2vw,22px);color:var(--q-text,#102b43)}
.qinsight-list-v332{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
.qinsight-item-v332{display:grid;grid-template-columns:34px minmax(0,1fr);gap:11px;align-items:start;padding:14px 15px;border-radius:16px;background:var(--q-surface,#fff);border:1px solid var(--q-border,#dfeaec);line-height:1.85;min-width:0}
.qinsight-mark-v332{display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:10px;font-size:13px;font-weight:900;background:color-mix(in srgb,var(--q-accent,#0b9da6) 11%,transparent);color:var(--q-accent,#0b9da6)}
.qinsight-text-v332{font-size:13.5px;color:var(--q-text,#102b43);overflow-wrap:anywhere}
.qinsight-critical{border-inline-start:4px solid var(--q-negative,#dc2626)}.qinsight-critical .qinsight-mark-v332{background:color-mix(in srgb,var(--q-negative,#dc2626) 12%,transparent);color:var(--q-negative,#dc2626)}
.qinsight-warning{border-inline-start:4px solid var(--q-warning,#f59e0b)}.qinsight-warning .qinsight-mark-v332{background:color-mix(in srgb,var(--q-warning,#f59e0b) 12%,transparent);color:var(--q-warning,#f59e0b)}
.qinsight-positive{border-inline-start:4px solid var(--q-positive,#059669)}.qinsight-positive .qinsight-mark-v332{background:color-mix(in srgb,var(--q-positive,#059669) 12%,transparent);color:var(--q-positive,#059669)}
.qinsight-trend{border-inline-start:4px solid var(--q-accent2,#0ea5e9)}.qinsight-trend .qinsight-mark-v332{background:color-mix(in srgb,var(--q-accent2,#0ea5e9) 12%,transparent);color:var(--q-accent2,#0ea5e9)}
@media(max-width:720px){.qinsight-list-v332{grid-template-columns:1fr}.qinsight-item-v332{padding:13px}.qinsight-text-v332{font-size:13px}}
`;
    document.head.appendChild(s);
  }
})();
