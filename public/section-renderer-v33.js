// Generative Section Renderer V3.3 — makes AI-authored section intent visually authoritative.
(function(){
  const upstreamRender=window.render;
  if(typeof upstreamRender!=='function')return;

  const STYLE_ID='qimam-section-renderer-v33-css';
  if(!document.getElementById(STYLE_ID)){
    const s=document.createElement('style');
    s.id=STYLE_ID;
    s.textContent=`
.qimam-section-v33 .qv32-section{isolation:isolate;overflow:hidden;transition:box-shadow .2s ease,border-color .2s ease,transform .2s ease}
.qimam-section-v33 .qv32-section::before,.qimam-section-v33 .qv32-section::after{pointer-events:none}
.qimam-section-v33 .qv33-index{display:inline-flex;align-items:center;justify-content:center;min-width:34px;height:28px;padding:0 10px;border-radius:999px;font-size:11px;font-weight:800;letter-spacing:.08em;color:var(--q-accent,#0b9da6);background:color-mix(in srgb,var(--q-accent,#0b9da6) 10%,transparent);border:1px solid color-mix(in srgb,var(--q-accent,#0b9da6) 22%,transparent)}
.qimam-section-v33 .qv32-head{position:relative;z-index:2;align-items:center;margin-bottom:clamp(14px,2vw,22px)}
.qimam-section-v33 .qv32-head-copy{display:flex;flex-direction:column;gap:2px}.qimam-section-v33 .qv32-title{font-size:clamp(20px,2.9vw,30px);font-weight:800}.qimam-section-v33 .qv32-subtitle{font-size:13px;line-height:1.8}
.qimam-section-v33 .qv32-hero{padding:clamp(22px,3.4vw,38px);border-radius:calc(var(--q-radius,22px) * 1.18);background:linear-gradient(135deg,color-mix(in srgb,var(--q-accent,#0b9da6) 16%,var(--q-surface,#fff)),color-mix(in srgb,var(--q-accent2,#ffae24) 5%,var(--q-surface,#fff)));border-color:color-mix(in srgb,var(--q-accent,#0b9da6) 34%,var(--q-border,#dfeaec));box-shadow:0 22px 64px color-mix(in srgb,var(--q-accent,#0b9da6) 15%,transparent)}
.qimam-section-v33 .qv32-hero::after{content:"";position:absolute;inset:auto -8% -42% auto;width:320px;height:320px;border-radius:50%;background:radial-gradient(circle,color-mix(in srgb,var(--q-accent,#0b9da6) 22%,transparent),transparent 68%);z-index:-1}
.qimam-section-v33 .qv32-hero .qv32-title{font-size:clamp(25px,3.4vw,38px);letter-spacing:-.035em}.qimam-section-v33 .qv32-hero .qv32-subtitle{max-width:58ch}
.qimam-section-v33 .qv32-hero .kpi{position:relative;z-index:1}.qimam-section-v33 .qv32-hero .kpi:first-of-type{transform:translateZ(0)}
.qimam-section-v33 .qv32-editorial{padding:clamp(18px,2.7vw,30px) 0;border-top:0;border-bottom:0}
.qimam-section-v33 .qv32-editorial::before{content:"";position:absolute;inset:0 auto 0 0;width:4px;border-radius:4px;background:linear-gradient(180deg,var(--q-accent,#0b9da6),var(--q-accent2,#ffae24));opacity:.75}
[dir="rtl"] .qimam-section-v33 .qv32-editorial::before{left:auto;right:0}
.qimam-section-v33 .qv32-panel{padding:clamp(18px,2.5vw,28px);border-radius:var(--q-radius,22px);background:linear-gradient(180deg,var(--q-surface,#fff),color-mix(in srgb,var(--q-surface2,#f8fafc) 72%,var(--q-surface,#fff)));border-color:color-mix(in srgb,var(--q-border,#dfeaec) 80%,var(--q-accent,#0b9da6));box-shadow:0 14px 42px rgba(15,35,55,.07)}
.qimam-section-v33 .qv32-accent{padding:clamp(20px,2.8vw,30px);border-radius:var(--q-radius,22px);background:linear-gradient(135deg,color-mix(in srgb,var(--q-accent2,#ffae24) 15%,var(--q-surface2,#f8fafc)),color-mix(in srgb,var(--q-accent,#0b9da6) 7%,var(--q-surface,#fff)));border-color:color-mix(in srgb,var(--q-accent2,#ffae24) 38%,var(--q-border,#dfeaec));box-shadow:0 16px 46px color-mix(in srgb,var(--q-accent2,#ffae24) 10%,transparent)}
.qimam-section-v33 .qv32-accent::after{content:"";position:absolute;inset:0;border-radius:inherit;background:linear-gradient(90deg,color-mix(in srgb,var(--q-accent2,#ffae24) 8%,transparent),transparent 38%);z-index:-1}
.qimam-section-v33 .qv32-plain{padding-top:4px}
.qimam-section-v33 .qv33-kpi-heavy>.lay-grid{align-items:stretch}.qimam-section-v33 .qv33-kpi-heavy .kpi{height:100%}
.qimam-section-v33 .qv33-charts .block{min-height:100%}.qimam-section-v33 .qv33-tables .tablewrap{box-shadow:none}
.qimam-section-v33 .qv33-insights .insight{border-inline-start:4px solid color-mix(in srgb,var(--q-accent2,#ffae24) 70%,var(--q-border,#dfeaec))}
.qimam-section-v33 .qv32-section[data-layout="split"]>.lay-split{align-items:stretch}.qimam-section-v33 .qv32-section[data-layout="split"]>.lay-split>*{min-width:0}
.qimam-section-v33 .qv32-section[data-ratio="3:2"]>.lay-split{grid-template-columns:minmax(0,3fr) minmax(0,2fr)!important}.qimam-section-v33 .qv32-section[data-ratio="2:3"]>.lay-split{grid-template-columns:minmax(0,2fr) minmax(0,3fr)!important}.qimam-section-v33 .qv32-section[data-ratio="2:1"]>.lay-split{grid-template-columns:minmax(0,2fr) minmax(0,1fr)!important}.qimam-section-v33 .qv32-section[data-ratio="1:2"]>.lay-split{grid-template-columns:minmax(0,1fr) minmax(0,2fr)!important}
.qimam-section-v33 .qv33-section-rule{position:absolute;top:0;inset-inline-start:0;width:72px;height:3px;border-radius:3px;background:linear-gradient(90deg,var(--q-accent,#0b9da6),var(--q-accent2,#ffae24));opacity:.9}
@media(max-width:820px){.qimam-section-v33 .qv32-section[data-layout="split"]>.lay-split{display:flex!important;flex-direction:column!important}.qimam-section-v33 .qv32-hero{padding:20px}.qimam-section-v33 .qv32-editorial{padding-inline:10px}}
@media(max-width:620px){.qimam-section-v33 .qv32-head{align-items:flex-start;gap:10px}.qimam-section-v33 .qv33-index{height:25px;min-width:30px}.qimam-section-v33 .qv32-hero,.qimam-section-v33 .qv32-panel,.qimam-section-v33 .qv32-accent{padding:14px;border-radius:18px}.qimam-section-v33 .qv32-hero .qv32-title{font-size:23px}.qimam-section-v33 .qv32-title{font-size:20px}.qimam-section-v33 .qv32-subtitle{font-size:12px}}
`;
    document.head.appendChild(s);
  }

  const RATIOS=new Set(['1:1','2:1','1:2','3:2','2:3']);
  function sectionGroups(schema){
    const groups=new Map();
    for(const c of Array.isArray(schema?.components)?schema.components:[]){
      const sec=c?.section;
      if(!sec||typeof sec!=='object'||!sec.id)continue;
      const id=String(sec.id).replace(/[^a-zA-Z0-9_-]/g,'_').slice(0,60);
      if(!groups.has(id))groups.set(id,{meta:sec,items:[]});
      groups.get(id).items.push(c);
    }
    return [...groups.values()].sort((a,b)=>(Number(a.meta?.order)||0)-(Number(b.meta?.order)||0));
  }
  function compositionClass(items){
    const types=items.map(x=>x?.type);
    if(types.length&&types.every(x=>x==='kpi'))return'qv33-kpi-heavy';
    if(types.some(x=>['line_chart','bar_chart','area_chart','pie_chart','scatter_chart'].includes(x)))return'qv33-charts';
    if(types.some(x=>x==='table'))return'qv33-tables';
    if(types.some(x=>x==='insight'))return'qv33-insights';
    return'qv33-mixed';
  }
  function enhance(schema,host){
    const sections=[...host.querySelectorAll('.qv32-section')];
    const groups=sectionGroups(schema);
    if(!sections.length||!groups.length)return;
    host.classList.add('qimam-section-v33');
    sections.forEach((el,i)=>{
      const g=groups[i];if(!g)return;
      el.classList.add(compositionClass(g.items));
      const ratio=RATIOS.has(g.meta?.ratio)?g.meta.ratio:'1:1';
      el.dataset.ratio=ratio;
      if(!el.querySelector(':scope > .qv33-section-rule')){const rule=document.createElement('span');rule.className='qv33-section-rule';el.appendChild(rule)}
      const head=el.querySelector(':scope > .qv32-head');
      if(head&&!head.querySelector('.qv33-index')){const badge=document.createElement('span');badge.className='qv33-index';badge.textContent=String(i+1).padStart(2,'0');head.appendChild(badge)}
    });
    schema.sectionRendererVersion='3.3';
  }

  window.render=function sectionRendererV33(schema,host){
    const result=upstreamRender(schema,host);
    enhance(schema,host);
    return result;
  };
})();
