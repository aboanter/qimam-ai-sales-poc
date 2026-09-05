(() => {
  const originalChart = window.chart;
  if (typeof originalChart !== 'function') return;

  function pxNumber(v, fallback, min, max) {
    const n = parseFloat(String(v ?? ''));
    return Number.isFinite(n) ? Math.max(min, Math.min(n, max)) : fallback;
  }

  function enhanceStandardChart(c, host, beforeCount) {
    const block = host.children[beforeCount] || host.lastElementChild;
    if (!block) return;
    const cfg = c.componentLayout || c.chartLayout || {};
    const title = block.querySelector('h3');
    const chartEl = block.querySelector('.chart');
    const svg = block.querySelector('svg');

    if (title) {
      title.style.fontSize = cfg.titleSize || 'clamp(19px,2.8vw,26px)';
      title.style.lineHeight = '1.5';
      title.style.marginBottom = '14px';
    }
    if (chartEl && cfg.chartHeight) {
      const h = pxNumber(cfg.chartHeight, 340, 280, 620);
      chartEl.style.minHeight = h + 'px';
    }

    // The original SVG renderer uses very small 10px labels. Because the SVG
    // scales down on phones those labels become nearly unreadable. Increase
    // semantic chart text without changing the data or chart geometry.
    if (svg) {
      const mobile = window.matchMedia && window.matchMedia('(max-width:620px)').matches;
      svg.querySelectorAll('text').forEach(t => {
        const old = parseFloat(t.getAttribute('font-size') || '10');
        const next = mobile ? Math.max(old, 16) : Math.max(old, 13);
        t.setAttribute('font-size', String(next));
        t.setAttribute('font-family', 'Tajawal, Segoe UI, Tahoma, Arial, sans-serif');
        t.setAttribute('fill', t.getAttribute('fill') || '#52677a');
      });
    }
  }

  window.chart = function patchedChart(c, host) {
    const beforeCount = host?.children?.length || 0;
    if (!c || c.type !== 'pie_chart') {
      const result = originalChart(c, host);
      enhanceStandardChart(c || {}, host, beforeCount);
      return result;
    }

    const cfg = c.componentLayout || c.chartLayout || {};
    const mobile = window.matchMedia && window.matchMedia('(max-width:620px)').matches;
    let legendPosition = ['right','bottom','none'].includes(cfg.legendPosition) ? cfg.legendPosition : 'right';
    // A right-side legend is too compressed on phones. Preserve the semantic
    // intent while adapting the composition to the available width.
    if (mobile && legendPosition === 'right') legendPosition = 'bottom';

    const b = add('div', 'block pie-block-v23');
    const h = add('h3', null, c.title || '');
    const w = add('div', 'chart pie-chart-v23');
    if (cfg.titleSize) h.style.fontSize = cfg.titleSize;
    const requestedHeight = pxNumber(cfg.chartHeight, mobile ? 470 : 380, 320, 650);
    w.style.minHeight = requestedHeight + 'px';

    const view = mobile
      ? (legendPosition === 'none' ? '0 0 460 410' : '0 0 460 560')
      : (legendPosition === 'bottom' ? '0 0 760 540' : '0 0 760 430');
    const s = se('svg', { viewBox:view, preserveAspectRatio:'xMidYMid meet' });
    w.append(s); b.append(h, w); host.append(b);

    const cats = Array.isArray(c.categories) ? c.categories : [];
    const vals = Array.isArray(c.series?.[0]?.data) ? c.series[0].data.map(Number) : [];
    const clean = vals.map(v => Number.isFinite(v) && v > 0 ? v : 0);
    const sum = clean.reduce((a,b) => a+b, 0);
    if (!sum) return;

    const palette = Array.isArray(c.palette) && c.palette.length ? c.palette.slice(0,8) : ['#0b9da6','#ffae24','#126b80','#65c9ce','#2aa46f','#7c3aed','#dc2626','#64748b'];

    let cx, cy, r;
    if (mobile) {
      cx = 230; cy = 190;
      r = Math.max(112, Math.min(+cfg.radius || 145, 158));
    } else if (legendPosition === 'right') {
      cx = 255; cy = 210;
      r = Math.max(112, Math.min(+cfg.radius || 158, 175));
    } else {
      cx = 380; cy = 205;
      r = Math.max(112, Math.min(+cfg.radius || 158, 175));
    }
    const hole = Math.max(48, Math.min(+cfg.innerRadius || 82, r-35));
    let start = -Math.PI/2;

    clean.forEach((v, i) => {
      if (!v) return;
      const angle = v / sum * Math.PI * 2, end = start + angle;
      const x1 = cx + r*Math.cos(start), y1 = cy + r*Math.sin(start);
      const x2 = cx + r*Math.cos(end), y2 = cy + r*Math.sin(end);
      s.append(se('path',{d:`M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${angle>Math.PI?1:0} 1 ${x2} ${y2} Z`,fill:palette[i%palette.length]}));
      start=end;
    });
    s.append(se('circle',{cx,cy,r:hole,fill:'#ffffff'}));
    txt(s,cx,cy-5,fmt(sum,'number',c),'middle',mobile ? 21 : 20);
    txt(s,cx,cy+23,c.series?.[0]?.name||'الإجمالي','middle',mobile ? 15 : 13);

    if (legendPosition !== 'none') {
      const shown = cats.slice(0,8);
      if (legendPosition === 'right' && !mobile) {
        shown.forEach((cat,i)=>{
          const x=485, y=88+i*42;
          s.append(se('circle',{cx:x,cy:y-5,r:8,fill:palette[i%palette.length]}));
          txt(s,x+20,y,String(cat).slice(0,28),'start',15);
        });
      } else {
        const columns = mobile ? 1 : 2;
        const startY = mobile ? 390 : 410;
        const colWidth = mobile ? 400 : 340;
        const startX = mobile ? 30 : 55;
        shown.forEach((cat,i)=>{
          const col = i % columns, row = Math.floor(i / columns);
          const x = startX + col*colWidth, y = startY + row*(mobile ? 34 : 38);
          s.append(se('circle',{cx:x,cy:y-5,r:8,fill:palette[i%palette.length]}));
          txt(s,x+20,y,String(cat).slice(0,mobile ? 36 : 28),'start',mobile ? 16 : 15);
        });
      }
    }

    s.querySelectorAll('text').forEach(t => {
      t.setAttribute('font-family','Tajawal, Segoe UI, Tahoma, Arial, sans-serif');
      if (!t.getAttribute('fill')) t.setAttribute('fill','#52677a');
    });
  };

  const css=document.createElement('style');
  css.textContent=`
    .pie-block-v23 h3{font-size:clamp(20px,3vw,28px);line-height:1.45;margin:4px 0 14px}
    .pie-chart-v23{overflow:hidden;display:flex;align-items:center;justify-content:center}
    .pie-chart-v23 svg{min-width:0!important;width:100%;max-width:100%;height:auto;display:block}
    .chart svg text{font-family:Tajawal,"Segoe UI",Tahoma,Arial,sans-serif}
    @media(max-width:620px){
      .pie-block-v23 h3{font-size:clamp(21px,5.5vw,28px);margin-bottom:10px}
      .pie-chart-v23{overflow:hidden!important}
      .pie-chart-v23 svg{width:100%;min-width:0!important;min-height:430px}
      .block:not(.pie-block-v23) .chart{overflow-x:auto;padding-bottom:6px}
      .block:not(.pie-block-v23) .chart svg text{font-weight:500}
    }
  `;
  document.head.append(css);
})();
