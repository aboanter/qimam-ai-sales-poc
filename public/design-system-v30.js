// Generative report Design System V3.0 — report-level visual direction.
(function(){
  const originalRender=window.render;
  if(typeof originalRender!=='function')return;
  const STYLE_ID='qimam-design-system-v30-css';
  if(!document.getElementById(STYLE_ID)){
    const s=document.createElement('style');s.id=STYLE_ID;s.textContent=`
.qimam-design-v30{--q-bg:#ffffff;--q-surface:#ffffff;--q-surface2:#f8fafc;--q-text:#102b43;--q-muted:#64748b;--q-accent:#0b9da6;--q-accent2:#ffae24;--q-positive:#059669;--q-negative:#dc2626;--q-warning:#f59e0b;--q-border:#dfeaec;--q-radius:22px;--q-shadow:0 8px 28px rgba(18,57,75,.06);--q-gap:14px;--q-section-gap:22px;--q-pad:20px;--q-font:"Segoe UI",Tahoma,Arial,sans-serif;background:var(--q-bg);color:var(--q-text);font-family:var(--q-font);border-radius:var(--q-radius);padding:var(--q-pad)}
.qimam-design-v30 .summary{color:var(--q-muted)}
.qimam-design-v30 .layout-root{gap:var(--q-section-gap)}
.qimam-design-v30 .gap-sm{gap:calc(var(--q-gap) * .65)}.qimam-design-v30 .gap-md{gap:var(--q-gap)}.qimam-design-v30 .gap-lg{gap:calc(var(--q-gap) * 1.55)}
.qimam-design-v30 .block,.qimam-design-v30 .insight{border-radius:var(--q-radius)}
.qimam-design-v30 .block h3,.qimam-design-v30 .insight h3{color:var(--q-text);letter-spacing:-.01em}
.qimam-design-v30 .tablewrap{border:1px solid var(--q-border);border-radius:calc(var(--q-radius) * .72);background:var(--q-surface);overflow:auto}
.qimam-design-v30 .tablewrap th{background:var(--q-surface2);color:var(--q-text)}
.qimam-design-v30 .tablewrap td{color:var(--q-text);border-bottom-color:var(--q-border)}
.qimam-design-v30 .insight:not([style*="background"]){background:var(--q-surface2);color:var(--q-text);border:1px solid var(--q-border)}
.qimam-design-v30 .lay-section.soft{background:var(--q-surface2);border-color:var(--q-border);border-radius:var(--q-radius)}
.qimam-design-v30 .lay-section.accent{background:linear-gradient(135deg,color-mix(in srgb,var(--q-accent) 10%,var(--q-surface)),var(--q-surface));border-color:color-mix(in srgb,var(--q-accent) 25%,var(--q-border));border-radius:var(--q-radius)}
.qimam-design-v30.qimam-density-compact{--q-gap:10px;--q-section-gap:15px;--q-pad:14px}.qimam-design-v30.qimam-density-spacious{--q-gap:18px;--q-section-gap:30px;--q-pad:26px}
.qimam-design-v30.qimam-surface-flat .kpi,.qimam-design-v30.qimam-surface-flat .tablewrap,.qimam-design-v30.qimam-surface-flat .insight{box-shadow:none!important}
.qimam-design-v30.qimam-surface-elevated .kpi,.qimam-design-v30.qimam-surface-elevated .tablewrap,.qimam-design-v30.qimam-surface-elevated .insight{box-shadow:var(--q-shadow)}
.qimam-design-v30.qimam-heading-strong h2{font-size:clamp(26px,4vw,40px);letter-spacing:-.03em}.qimam-design-v30.qimam-heading-editorial h2{font-size:clamp(30px,5vw,48px);line-height:1.15;letter-spacing:-.04em}
@media(max-width:620px){.qimam-design-v30{padding:14px;border-radius:18px}.qimam-design-v30.qimam-density-spacious{--q-pad:18px;--q-gap:14px;--q-section-gap:20px}}
`;document.head.appendChild(s);
  }
  function safeColor(v,f){return typeof v==='string'&&v.length<80&&!/url\s*\(|javascript:|expression\s*\(/i.test(v)?v:f}
  function safeLen(v,f,min,max){if(typeof v!=='string')return f;const m=v.match(/^([0-9.]+)(px|rem)$/);if(!m)return f;const n=Number(m[1]);return n>=min&&n<=max?v:f}
  function safeFont(v,f){return typeof v==='string'&&v.length<120&&!/[{};]|url\s*\(|javascript:/i.test(v)?v:f}
  function applyDesign(schema,host){const d=schema&&schema.designSystem;if(!d||typeof d!=='object')return;host.classList.add('qimam-design-v30');host.classList.toggle('qimam-density-compact',d.density==='compact');host.classList.toggle('qimam-density-spacious',d.density==='spacious');host.classList.toggle('qimam-surface-flat',d.surfaceStyle==='flat');host.classList.toggle('qimam-surface-elevated',d.surfaceStyle==='elevated');host.classList.toggle('qimam-heading-strong',d.headingStyle==='strong');host.classList.toggle('qimam-heading-editorial',d.headingStyle==='editorial');
    const st=host.style,vars={
      '--q-bg':safeColor(d.background,'#ffffff'),'--q-surface':safeColor(d.surface,'#ffffff'),'--q-surface2':safeColor(d.surfaceAlt,'#f8fafc'),'--q-text':safeColor(d.textColor,'#102b43'),'--q-muted':safeColor(d.mutedColor,'#64748b'),'--q-accent':safeColor(d.accent,'#0b9da6'),'--q-accent2':safeColor(d.accent2,'#ffae24'),'--q-positive':safeColor(d.positive,'#059669'),'--q-negative':safeColor(d.negative,'#dc2626'),'--q-warning':safeColor(d.warning,'#f59e0b'),'--q-border':safeColor(d.borderColor,'#dfeaec'),'--q-radius':safeLen(d.radius,'22px',8,40),'--q-gap':safeLen(d.gap,'14px',6,32),'--q-section-gap':safeLen(d.sectionGap,'22px',8,48),'--q-pad':safeLen(d.padding,'20px',8,40),'--q-font':safeFont(d.fontFamily,'"Segoe UI",Tahoma,Arial,sans-serif')
    };Object.entries(vars).forEach(([k,v])=>st.setProperty(k,v));if(typeof d.maxWidth==='string'&&/^([6-9][0-9]{2}|1[0-4][0-9]{2})px$/.test(d.maxWidth)){host.style.maxWidth=d.maxWidth;host.style.marginInline='auto'}
    const card=host.closest('.card');if(card){card.style.background=safeColor(d.cardBackground,d.background||'#ffffff');card.style.borderColor=safeColor(d.borderColor,'#dfeaec');card.style.borderRadius=safeLen(d.outerRadius,d.radius||'22px',10,44);if(d.surfaceStyle==='flat')card.style.boxShadow='none';else if(typeof d.shadow==='string'&&d.shadow.length<160&&!/url\s*\(|javascript:|expression\s*\(/i.test(d.shadow))card.style.boxShadow=d.shadow}
  }
  window.render=function designSystemRender(schema,host){applyDesign(schema,host);return originalRender(schema,host)};
  if(!document.querySelector('script[data-qimam-section-v31]')){const sc=document.createElement('script');sc.src='/section-composition-v31.js';sc.dataset.qimamSectionV31='1';document.head.appendChild(sc)}
})();
