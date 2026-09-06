// Adaptive Section Composition V3.1 — report hierarchy without fixed templates.
(function(){
  const originalRender=window.render;
  if(typeof originalRender!=='function')return;
  const STYLE_ID='qimam-section-composition-v31-css';
  if(!document.getElementById(STYLE_ID)){
    const s=document.createElement('style');s.id=STYLE_ID;s.textContent=`
.qimam-composition-v31 .q-section-band{position:relative;min-width:0;border-radius:calc(var(--q-radius,22px) * .9)}
.qimam-composition-v31 .q-section-overview{background:transparent}
.qimam-composition-v31 .q-section-trend,.qimam-composition-v31 .q-section-customers,.qimam-composition-v31 .q-section-detail{background:color-mix(in srgb,var(--q-surface,#fff) 94%,transparent);border:1px solid var(--q-border,#dfeaec);padding:clamp(12px,2vw,20px)}
.qimam-composition-v31 .q-section-insights{background:linear-gradient(135deg,color-mix(in srgb,var(--q-accent,#0b9da6) 10%,var(--q-surface2,#f8fafc)),var(--q-surface2,#f8fafc));border:1px solid color-mix(in srgb,var(--q-accent,#0b9da6) 28%,var(--q-border,#dfeaec));padding:clamp(12px,2vw,20px)}
.qimam-composition-v31 .q-section-trend .block,.qimam-composition-v31 .q-section-customers .block,.qimam-composition-v31 .q-section-detail .block{padding:0}
.qimam-composition-v31 .q-section-trend h3,.qimam-composition-v31 .q-section-customers h3,.qimam-composition-v31 .q-section-detail h3{font-size:clamp(15px,2vw,19px);margin-top:0}
.qimam-composition-v31 .q-section-primary{box-shadow:var(--q-shadow,0 8px 28px rgba(0,0,0,.08))}
.qimam-composition-v31 .q-section-primary .chart svg{min-height:300px}
.qimam-composition-v31 .q-section-customers .lay-split{align-items:start}
.qimam-composition-v31 .q-section-customers .tablewrap{max-height:420px}
.qimam-composition-v31 .q-section-insights .insight{background:transparent!important;border:0!important;box-shadow:none!important;padding:4px!important}
@media(max-width:760px){
 .qimam-composition-v31 .q-section-trend,.qimam-composition-v31 .q-section-customers,.qimam-composition-v31 .q-section-detail,.qimam-composition-v31 .q-section-insights{padding:12px}
 .qimam-composition-v31 .q-section-customers .lay-split{display:flex!important;flex-direction:column!important}
 .qimam-composition-v31 .q-section-customers .layout-ref{width:100%}
 .qimam-composition-v31 .q-section-customers .tablewrap{max-height:none}
 .qimam-composition-v31 .q-section-primary .chart svg{min-height:260px}
}
@media(max-width:620px){
 .qimam-composition-v31 .q-section-band{border-radius:16px}
 .qimam-composition-v31 .q-section-trend,.qimam-composition-v31 .q-section-customers,.qimam-composition-v31 .q-section-detail,.qimam-composition-v31 .q-section-insights{padding:10px}
}
`;document.head.appendChild(s);
  }
  function componentMap(schema){return new Map((schema?.components||[]).map(c=>[c.id,c]));}
  function idsIn(node,out=[]){if(!node)return out;if(node.type==='ref'&&node.id)out.push(node.id);for(const ch of node.children||[])idsIn(ch,out);return out;}
  function roleFor(node,map){const comps=idsIn(node).map(id=>map.get(id)).filter(Boolean);if(!comps.length)return'detail';const types=new Set(comps.map(c=>c.type));const text=comps.map(c=>String(c.title||'')).join(' ');
    if(comps.every(c=>c.type==='kpi'))return'overview';
    if(types.has('insight')&&comps.length<=2)return'insights';
    if(/عميل|customer/i.test(text)||types.has('table')&&types.has('bar_chart'))return'customers';
    if(types.has('line_chart')||types.has('area_chart'))return'trend';
    return'detail';
  }
  function decorateNode(node,el,map){if(!node||!el)return;if(node.type!=='ref'){
      const role=roleFor(node,map);el.classList.add('q-section-band','q-section-'+role);
      if(role==='trend'||role==='customers')el.classList.add('q-section-primary');
    }
    const childNodes=(node.children||[]),childEls=[...el.children].filter(x=>x.classList.contains('lay')||x.classList.contains('layout-ref'));
    for(let i=0;i<Math.min(childNodes.length,childEls.length);i++)decorateNode(childNodes[i],childEls[i],map);
  }
  function decorate(schema,host){const tree=Array.isArray(schema?.layoutTree)?schema.layoutTree:[];const root=host.querySelector('.layout-root');if(!tree.length||!root)return;host.classList.add('qimam-composition-v31');const map=componentMap(schema);const roots=[...root.children].filter(x=>x.classList.contains('lay')||x.classList.contains('layout-ref'));for(let i=0;i<Math.min(tree.length,roots.length);i++)decorateNode(tree[i],roots[i],map);schema.sectionCompositionVersion='3.1';}
  window.render=function sectionCompositionRender(schema,host){const r=originalRender(schema,host);decorate(schema,host);return r;};
})();
