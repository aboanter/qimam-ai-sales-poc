// Section Design Language V3.2 — turns AI-authored component section metadata into page composition.
(function(){
  const originalRender=window.render;
  if(typeof originalRender!=='function')return;
  const STYLE_ID='qimam-section-design-v32-css';
  if(!document.getElementById(STYLE_ID)){
    const s=document.createElement('style');s.id=STYLE_ID;s.textContent=`
.qimam-section-v32 .qv32-section{position:relative;min-width:0;border-radius:calc(var(--q-radius,22px) * .95)}
.qimam-section-v32 .qv32-head{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;margin:0 0 14px;padding:0 2px}
.qimam-section-v32 .qv32-head-copy{min-width:0}.qimam-section-v32 .qv32-title{margin:0;color:var(--q-text,#102b43);font-size:clamp(18px,2.7vw,27px);line-height:1.25;letter-spacing:-.025em}.qimam-section-v32 .qv32-subtitle{margin:6px 0 0;color:var(--q-muted,#64748b);font-size:13px;line-height:1.7;max-width:72ch}
.qimam-section-v32 .qv32-hero{padding:clamp(16px,2.5vw,28px);background:linear-gradient(135deg,color-mix(in srgb,var(--q-accent,#0b9da6) 9%,var(--q-surface,#fff)),var(--q-surface,#fff));border:1px solid color-mix(in srgb,var(--q-accent,#0b9da6) 30%,var(--q-border,#dfeaec));box-shadow:var(--q-shadow,0 10px 30px rgba(0,0,0,.08))}
.qimam-section-v32 .qv32-editorial{padding-block:clamp(12px,2vw,24px);border-top:1px solid var(--q-border,#dfeaec);border-bottom:1px solid var(--q-border,#dfeaec)}
.qimam-section-v32 .qv32-panel{padding:clamp(14px,2vw,22px);background:var(--q-surface,#fff);border:1px solid var(--q-border,#dfeaec);box-shadow:var(--q-shadow,0 8px 28px rgba(0,0,0,.06))}
.qimam-section-v32 .qv32-accent{padding:clamp(14px,2vw,22px);background:linear-gradient(135deg,color-mix(in srgb,var(--q-accent2,#ffae24) 10%,var(--q-surface2,#f8fafc)),var(--q-surface2,#f8fafc));border:1px solid color-mix(in srgb,var(--q-accent2,#ffae24) 30%,var(--q-border,#dfeaec))}
.qimam-section-v32 .qv32-plain{padding:0}
.qimam-section-v32 .qv32-section>.lay-grid,.qimam-section-v32 .qv32-section>.lay-split,.qimam-section-v32 .qv32-section>.lay-stack,.qimam-section-v32 .qv32-section>.lay-strip{margin:0}
.qimam-section-v32 .qv32-section[data-layout="wide"]>.lay-stack>.layout-ref,.qimam-section-v32 .qv32-section[data-layout="stack"]>.lay-stack>.layout-ref{width:100%}
@media(max-width:820px){.qimam-section-v32 .qv32-section[data-layout="split"]>.lay-split{display:flex!important;flex-direction:column!important}.qimam-section-v32 .qv32-section[data-layout="split"]>.lay-split>.layout-ref{width:100%}.qimam-section-v32 .qv32-section .tablewrap{max-height:none!important}}
@media(max-width:620px){.qimam-section-v32 .qv32-head{align-items:flex-start;flex-direction:column;margin-bottom:10px}.qimam-section-v32 .qv32-title{font-size:20px}.qimam-section-v32 .qv32-hero,.qimam-section-v32 .qv32-panel,.qimam-section-v32 .qv32-accent{padding:12px;border-radius:16px}.qimam-section-v32 .qv32-section[data-layout="grid"]>.lay-grid{display:flex!important;flex-direction:column!important}}
`;document.head.appendChild(s);
  }
  const PRESENTATIONS=new Set(['hero','editorial','panel','plain','accent']);
  const LAYOUTS=new Set(['grid','split','stack','strip','wide']);
  const RATIOS=new Set(['1:1','2:1','1:2','3:2','2:3']);
  function safeText(v,max=120){return typeof v==='string'?v.trim().slice(0,max):''}
  function sectionMeta(c,index){const s=c&&c.section;if(!s||typeof s!=='object')return null;const id=safeText(s.id,60).replace(/[^a-zA-Z0-9_-]/g,'_');if(!id)return null;return{id,title:safeText(s.title,100),subtitle:safeText(s.subtitle,220),presentation:PRESENTATIONS.has(s.presentation)?s.presentation:'plain',layout:LAYOUTS.has(s.layout)?s.layout:'stack',columns:Math.max(2,Math.min(Number(s.columns)||2,4)),ratio:RATIOS.has(s.ratio)?s.ratio:'1:1',order:Number.isFinite(Number(s.order))?Number(s.order):index}}
  function buildSections(schema){const comps=Array.isArray(schema?.components)?schema.components:[];const groups=new Map(),loose=[];comps.forEach((c,i)=>{const m=sectionMeta(c,i);if(!m){loose.push(c);return}if(!groups.has(m.id))groups.set(m.id,{meta:m,items:[]});groups.get(m.id).items.push(c)});if(groups.size<2)return null;const sections=[...groups.values()].sort((a,b)=>a.meta.order-b.meta.order);const tree=[];for(const g of sections){const refs=g.items.map(c=>({type:'ref',id:c.id}));let inner;if(g.meta.layout==='grid')inner={type:'grid',columns:g.meta.columns,gap:'md',children:refs};else if(g.meta.layout==='split')inner={type:'split',ratio:g.meta.ratio,gap:'md',children:refs.slice(0,2)};else if(g.meta.layout==='strip')inner={type:'strip',gap:'md',children:refs};else inner={type:'stack',gap:'md',children:refs};tree.push({type:'section',variant:'plain',gap:'md',children:[inner],__qv32:g.meta});}
    if(loose.length)tree.push({type:'section',variant:'plain',gap:'md',children:[{type:'stack',gap:'md',children:loose.map(c=>({type:'ref',id:c.id}))}],__qv32:{id:'other',title:'',subtitle:'',presentation:'plain',layout:'stack',order:999}});
    return tree;
  }
  function decorate(schema,host,tree){const root=host.querySelector('.layout-root');if(!root||!Array.isArray(tree))return;host.classList.add('qimam-section-v32');const rootEls=[...root.children].filter(x=>x.classList.contains('lay')||x.classList.contains('layout-ref'));tree.forEach((node,i)=>{const el=rootEls[i],m=node&&node.__qv32;if(!el||!m)return;el.classList.add('qv32-section','qv32-'+m.presentation);el.dataset.layout=m.layout;if(m.title||m.subtitle){const head=document.createElement('div');head.className='qv32-head';const copy=document.createElement('div');copy.className='qv32-head-copy';if(m.title){const h=document.createElement('h3');h.className='qv32-title';h.textContent=m.title;copy.appendChild(h)}if(m.subtitle){const p=document.createElement('p');p.className='qv32-subtitle';p.textContent=m.subtitle;copy.appendChild(p)}head.appendChild(copy);el.prepend(head)}});schema.sectionCompositionVersion='3.2';}
  window.render=function sectionDesignRender(schema,host){const generated=buildSections(schema);let treeForDecorate=null,originalTree=schema&&schema.layoutTree;if(generated){treeForDecorate=generated;schema.layoutTree=generated.map(n=>{const x={...n};delete x.__qv32;return x})}const r=originalRender(schema,host);if(generated){schema.layoutTree=originalTree;decorate(schema,host,treeForDecorate)}return r;};
})();
