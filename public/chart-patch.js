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

    if (svg) {
      const mobile = window.matchMedia && window.matchMedia('(max-width:620px)').matches;
      const texts = [...svg.querySelectorAll('text')];
      texts.forEach(t => {
        const old = parseFloat(t.getAttribute('font-size') || '10');
        const next = mobile ? Math.max(old, 15) : Math.max(old, 13);
        t.setAttribute('font-size', String(next));
        t.setAttribute('font-family', 'Tajawal, Segoe UI, Tahoma, Arial, sans-serif');
        t.setAttribute('fill', t.getAttribute('fill') || '#52677a');
      });

      // Adaptive mobile x-axis labels. When there are many categories or long
      // labels, horizontal text collides. Rotate only likely bottom-axis labels
      // and give them extra breathing room; do not alter data or chart geometry.
      if (mobile && ['bar_chart','line_chart','area_chart'].includes(c.type)) {
        const vb = (svg.getAttribute('viewBox') || '').trim().split(/\s+/).map(Number);
        const viewH = vb.length === 4 && Number.isFinite(vb[3]) ? vb[3] : 300;
        const cats = Array.isArray(c.categories) ? c.categories : [];
        const crowded = cats.length >= 6 || cats.some(x => String(x).length >= 10);
        if (crowded) {
          texts.forEach(t => {
            const x = parseFloat(t.getAttribute('x'));
            const y = parseFloat(t.getAttribute('y'));
            if (!Number.isFinite(x) || !Number.isFinite(y)) return;
            if (y < viewH * 0.72) return;
            const label = (t.textContent || '').trim();
            if (!label) return;
            t.setAttribute('text-anchor','end');
            t.setAttribute('transform', `rotate(-48 ${x} ${y})`);
            t.setAttribute('font-size','14');
            t.setAttribute('font-weight','500');
          });
          svg.style.overflow = 'visible';
          if (chartEl) chartEl.style.paddingBottom = '64px';
        }
      }
    }
  }

  function addLegendItem(svg, x, y, label, color, mobile, align='start') {
    const dotX = align === 'end' ? x : x;
    const textX = align === 'end' ? x - 22 : x + 22;
    svg.append(se('circle',{cx:dotX,cy:y-5,r:8,fill:color}));
    const text = txt(svg,textX,y,String(label),'middle',mobile ? 16 : 15);
    if (text) {
      text.setAttribute('text-anchor', align === 'end' ? 'end' : 'start');
      text.setAttribute('direction', /[\u0600-\u06FF]/.test(String(label)) ? 'rtl' : 'ltr');
      text.setAttribute('unicode-bidi','plaintext');
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
    if (mobile && legendPosition === 'right') legendPosition = 'bottom';

    const b = add('div', 'block pie-block-v24');
    const h = add('h3', null, c.title || '');
    const w = add('div', 'chart pie-chart-v24');
    if (cfg.titleSize) h.style.fontSize = cfg.titleSize;
    const requestedHeight = pxNumber(cfg.chartHeight, mobile ? 500 : 380, 320, 680);
    w.style.minHeight = requestedHeight + 'px';

    const cats = Array.isArray(c.categories) ? c.categories : [];
    const shownCount = Math.min(cats.length,8);
    const mobileLegendRows = Math.max(1, shownCount);
    const mobileHeight = 430 + mobileLegendRows * 42;
    const view = mobile
      ? (legendPosition === 'none' ? '0 0 460 410' : `0 0 460 ${Math.max(560,mobileHeight)}`)
      : (legendPosition === 'bottom' ? '0 0 760 540' : '0 0 760 430');
    const s = se('svg', { viewBox:view, preserveAspectRatio:'xMidYMid meet' });
    w.append(s); b.append(h, w); host.append(b);

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
          const y=88+i*42;
          addLegendItem(s,500,y,String(cat).slice(0,28),palette[i%palette.length],false,'start');
        });
      } else if (mobile) {
        // Put marker on the far right and text to its left. This avoids the
        // colored marker sitting on top of Arabic labels.
        const startY = 405;
        shown.forEach((cat,i)=>{
          const y = startY + i*42;
          addLegendItem(s,420,y,String(cat).slice(0,38),palette[i%palette.length],true,'end');
        });
      } else {
        const columns = 2, startY = 410, colWidth = 340, startX = 55;
        shown.forEach((cat,i)=>{
          const col = i % columns, row = Math.floor(i / columns);
          const x = startX + col*colWidth, y = startY + row*38;
          addLegendItem(s,x,y,String(cat).slice(0,28),palette[i%palette.length],false,'start');
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
    .pie-block-v24 h3{font-size:clamp(20px,3vw,28px);line-height:1.45;margin:4px 0 14px}
    .pie-chart-v24{overflow:hidden;display:flex;align-items:center;justify-content:center}
    .pie-chart-v24 svg{min-width:0!important;width:100%;max-width:100%;height:auto;display:block}
    .chart svg text{font-family:Tajawal,"Segoe UI",Tahoma,Arial,sans-serif}
    @media(max-width:620px){
      .pie-block-v24 h3{font-size:clamp(21px,5.5vw,28px);margin-bottom:10px}
      .pie-chart-v24{overflow:hidden!important}
      .pie-chart-v24 svg{width:100%;min-width:0!important;min-height:470px}
      .block:not(.pie-block-v24) .chart{overflow-x:auto;padding-bottom:64px}
      .block:not(.pie-block-v24) .chart svg{overflow:visible}
      .block:not(.pie-block-v24) .chart svg text{font-weight:500}
    }
  `;
  document.head.append(css);
})();
