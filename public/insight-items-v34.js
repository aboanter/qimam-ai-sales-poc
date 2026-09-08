// Insight Items Renderer V3.4 — adds support for structured {icon,text} insight items.
(function(){
  const previous = window.renderComponent;
  if (typeof previous !== 'function') return;

  const ICON_PATHS = {
    trend:'M4 17l6-6 4 4 6-8 M15 7h5v5', revenue:'M5 7h14v10H5z M8 11h8 M12 9v4',
    receipt:'M6 3h12v18l-3-2-3 2-3-2-3 2z M9 8h6 M9 12h6', warning:'M12 4l9 16H3z M12 9v5 M12 17v.1',
    users:'M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6 M3 20c0-4 3-6 5-6s5 2 5 6',
    wallet:'M4 7h14a2 2 0 0 1 2 2v9H6a2 2 0 0 1-2-2z M16 11h5v4h-5',
    chart:'M4 20V10 M10 20V4 M16 20v-7 M22 20H2', check:'M5 12l4 4L19 6',
    spark:'M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2z'
  };
  function el(tag, cls, text){const e=document.createElement(tag);if(cls)e.className=cls;if(text!=null)e.textContent=String(text);return e}
  function icon(name){
    const wrap=el('span','q-insight-icon');
    const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');
    const p=document.createElementNS('http://www.w3.org/2000/svg','path');p.setAttribute('d',ICON_PATHS[String(name||'spark').toLowerCase()]||ICON_PATHS.spark);p.setAttribute('fill','none');p.setAttribute('stroke','currentColor');p.setAttribute('stroke-width','1.8');p.setAttribute('stroke-linecap','round');p.setAttribute('stroke-linejoin','round');svg.appendChild(p);wrap.appendChild(svg);return wrap;
  }
  function ensureCss(){if(document.getElementById('qimam-insight-items-v34-css'))return;const s=document.createElement('style');s.id='qimam-insight-items-v34-css';s.textContent=`
.q-insight-v34{padding:18px;border-radius:18px;background:var(--q-surface2,#f8fafc);border:1px solid var(--q-border,#dfeaec);height:100%}
.q-insight-v34 h3{margin:0 0 14px;color:var(--q-text,#102b43);font-size:18px}
.q-insight-list{display:flex;flex-direction:column;gap:10px}.q-insight-item{display:flex;align-items:flex-start;gap:11px;padding:12px 13px;border-radius:14px;background:var(--q-surface,#fff);border:1px solid color-mix(in srgb,var(--q-border,#dfeaec) 75%,transparent);line-height:1.8;color:var(--q-text,#102b43)}
.q-insight-icon{display:flex;align-items:center;justify-content:center;flex:0 0 34px;width:34px;height:34px;border-radius:10px;background:color-mix(in srgb,var(--q-accent,#0b9da6) 12%,transparent);color:var(--q-accent,#0b9da6);margin-top:1px}.q-insight-icon svg{width:19px;height:19px;display:block}.q-insight-text{min-width:0;flex:1}
@media(max-width:620px){.q-insight-v34{padding:13px;border-radius:15px}.q-insight-item{padding:10px;gap:9px}.q-insight-icon{flex-basis:31px;width:31px;height:31px}.q-insight-icon svg{width:17px;height:17px}}
`;document.head.appendChild(s)}

  window.renderComponent=function insightItemsRender(c,cell){
    if(c?.type!=='insight'||!Array.isArray(c.items)||!c.items.length)return previous(c,cell);
    ensureCss();const box=el('div','insight q-insight-v34 '+(c.severity||''));if(c.title)box.appendChild(el('h3',null,c.title));const list=el('div','q-insight-list');
    c.items.forEach(item=>{const text=typeof item==='string'?item:item?.text;if(!text)return;const row=el('div','q-insight-item');if(typeof item==='object'&&item.icon)row.appendChild(icon(item.icon));row.appendChild(el('div','q-insight-text',text));list.appendChild(row)});
    box.appendChild(list);cell.appendChild(box);c.insightRendererVersion='3.4';
  };
})();
