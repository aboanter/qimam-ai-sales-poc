// Insight Renderer V3.3.4 — post-render enhancement for structured insight arrays.
// Supports both legacy `insights` and current `items` payloads and resolves untitled
// components by their layoutTree ref id/order instead of relying only on <h3> text.
(function(){
  const upstream=window.render;
  if(typeof upstream!=='function')return;

  function cleanText(v){
    if(typeof v==='string')return v.trim();
    if(v&&typeof v==='object'&&typeof v.text==='string')return v.text.trim();
    return '';
  }
  function kind(v){
    const raw=String(v?.type||v?.icon||'info').toLowerCase();
    if(['critical','warning'].includes(raw))return 'warning';
    if(['positive','check','profit'].includes(raw))return 'positive';
    if(['trend','chart'].includes(raw))return 'trend';
    return 'info';
  }
  function iconFor(k,source){
    const raw=String(source?.icon||'').toLowerCase();
    if(raw==='revenue'||raw==='wallet')return 'ر.س';
    if(raw==='users')return '●';
    if(raw==='trend'||raw==='chart')return '↗';
    if(raw==='warning'||k==='warning')return '!';
    if(raw==='check'||k==='positive')return '✓';
    return 'i';
  }
  function sourceItems(c){
    if(Array.isArray(c?.items)&&c.items.length)return c.items;
    if(Array.isArray(c?.insights)&&c.insights.length)return c.insights;
    if(Array.isArray(c?.bullets)&&c.bullets.length)return c.bullets;
    return [];
  }
  function refOrder(tree){
    const ids=[];
    function walk(node){
      if(Array.isArray(node)){node.forEach(walk);return}
      if(!node||typeof node!=='object')return;
      if(node.type==='ref'&&node.id){ids.push(String(node.id));return}
      if(Array.isArray(node.children))node.children.forEach(walk);
    }
    walk(tree);
    return ids;
  }

  function buildInsight(c){
    const items=sourceItems(c).map(x=>({text:cleanText(x),type:kind(x),source:x})).filter(x=>x.text);
    if(!items.length&&c?.text){items.push({text:cleanText(c.text),type:'info',source:null})}
    if(!items.length)return null;
    const box=document.createElement('div');box.className='insight qinsight-v334';
    if(c.title){const h=document.createElement('h3');h.textContent=c.title;box.appendChild(h)}
    const list=document.createElement('div');list.className='qinsight-list-v334';
    for(const item of items){
      const row=document.createElement('div');row.className=`qinsight-item-v334 qinsight-${item.type}`;
      const mark=document.createElement('span');mark.className='qinsight-mark-v334';mark.textContent=iconFor(item.type,item.source);
      const text=document.createElement('div');text.className='qinsight-text-v334';text.textContent=item.text;
      row.append(mark,text);list.appendChild(row);
    }
    box.appendChild(list);return box;
  }

  function resolveCell(c,schema,host,candidates,refs){
    // 1) Prefer a stable layout ref id -> rendered .layout-ref order mapping.
    const refIndex=refs.indexOf(String(c.id||''));
    if(refIndex>=0&&candidates[refIndex])return candidates[refIndex];

    // 2) Legacy title matching when a visible title exists.
    const title=String(c.title||'').trim();
    if(title){
      const byTitle=candidates.find(el=>{
        const h=el.querySelector('.insight h3, .block h3, h3');
        return h&&h.textContent.trim()===title;
      });
      if(byTitle)return byTitle;
    }

    // 3) Component-order fallback for schemas without layoutTree.
    const componentIndex=(Array.isArray(schema?.components)?schema.components:[]).findIndex(x=>String(x?.id||'')===String(c.id||''));
    if(componentIndex>=0&&candidates[componentIndex])return candidates[componentIndex];

    // 4) Single-component section legacy fallback.
    const secId=String(c.section?.id||'');
    if(secId){
      const groups=(Array.isArray(schema.components)?schema.components:[]).filter(x=>String(x?.section?.id||'')===secId);
      if(groups.length===1){
        const sections=[...host.querySelectorAll('.qv32-section')];
        const orderedIds=[...new Set(schema.components.map(x=>x?.section?.id).filter(Boolean))];
        const idx=orderedIds.indexOf(secId),sec=idx>=0?sections[idx]:null;
        if(sec)return sec.querySelector('.layout-ref, .gen-item');
      }
    }
    return null;
  }

  function enhance(schema,host){
    const insights=(Array.isArray(schema?.components)?schema.components:[])
      .filter(c=>c&&c.type==='insight'&&c.id&&(sourceItems(c).length||c.text));
    const candidates=[...host.querySelectorAll('.layout-ref')];
    // layoutTree is authoritative for V4 visible. When absent, component order is used.
    const refs=refOrder(schema?.layoutTree);
    for(const c of insights){
      const cell=resolveCell(c,schema,host,candidates,refs);
      if(!cell)continue;
      const box=buildInsight(c);if(!box)continue;
      cell.replaceChildren(box);
    }
    schema.insightRendererVersion='3.3.4';
  }

  window.render=function insightRenderV334(schema,host){const result=upstream(schema,host);enhance(schema,host);return result;};

  if(!document.getElementById('qimam-insight-v334-css')){
    const s=document.createElement('style');s.id='qimam-insight-v334-css';s.textContent=`
.qinsight-v334{background:transparent!important;border:0!important;padding:0!important;box-shadow:none!important;height:auto!important}
.qinsight-v334>h3{margin:0 0 14px;font-size:clamp(17px,2.2vw,22px);color:var(--q-text,#102b43)}
.qinsight-list-v334{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
.qinsight-item-v334{display:grid;grid-template-columns:34px minmax(0,1fr);gap:11px;align-items:start;padding:14px 15px;border-radius:16px;background:var(--q-surface,#fff);border:1px solid var(--q-border,#dfeaec);line-height:1.85;min-width:0}
.qinsight-mark-v334{display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:10px;font-size:12px;font-weight:900;background:color-mix(in srgb,var(--q-accent,#0b9da6) 11%,transparent);color:var(--q-accent,#0b9da6)}
.qinsight-text-v334{font-size:13.5px;color:var(--q-text,#102b43);overflow-wrap:anywhere}
.qinsight-warning{border-inline-start:4px solid var(--q-warning,#f59e0b)}.qinsight-warning .qinsight-mark-v334{background:color-mix(in srgb,var(--q-warning,#f59e0b) 12%,transparent);color:var(--q-warning,#f59e0b)}
.qinsight-positive{border-inline-start:4px solid var(--q-positive,#059669)}.qinsight-positive .qinsight-mark-v334{background:color-mix(in srgb,var(--q-positive,#059669) 12%,transparent);color:var(--q-positive,#059669)}
.qinsight-trend{border-inline-start:4px solid var(--q-accent2,#0ea5e9)}.qinsight-trend .qinsight-mark-v334{background:color-mix(in srgb,var(--q-accent2,#0ea5e9) 12%,transparent);color:var(--q-accent2,#0ea5e9)}
@media(max-width:720px){.qinsight-list-v334{grid-template-columns:1fr}.qinsight-item-v334{padding:13px}.qinsight-text-v334{font-size:13px}}
`;document.head.appendChild(s);
  }
})();
