(() => {
  const originalChart = window.chart;
  if (typeof originalChart !== 'function') return;

  window.chart = function patchedChart(c, host) {
    if (!c || c.type !== 'pie_chart') return originalChart(c, host);

    const cfg = c.componentLayout || c.chartLayout || {};
    const b = add('div', 'block pie-block-v22');
    const h = add('h3', null, c.title || '');
    const w = add('div', 'chart pie-chart-v22');
    const s = se('svg', { viewBox: '0 0 760 430', preserveAspectRatio:'xMidYMid meet' });
    w.append(s); b.append(h, w); host.append(b);

    const cats = Array.isArray(c.categories) ? c.categories : [];
    const vals = Array.isArray(c.series?.[0]?.data) ? c.series[0].data.map(Number) : [];
    const clean = vals.map(v => Number.isFinite(v) && v > 0 ? v : 0);
    const sum = clean.reduce((a,b) => a+b, 0);
    if (!sum) return;

    const palette = Array.isArray(c.palette) && c.palette.length ? c.palette.slice(0,8) : ['#0b9da6','#ffae24','#126b80','#65c9ce','#2aa46f','#7c3aed','#dc2626','#64748b'];
    // Fill the card: donut uses the left/center body while legend deliberately
    // consumes the previously wasted right side on wide screens.
    const cx = 270, cy = 210, r = Math.max(105, Math.min(+cfg.radius || 154, 172));
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
    txt(s,cx,cy-5,fmt(sum,'number',c),'middle',20);
    txt(s,cx,cy+20,c.series?.[0]?.name||'الإجمالي','middle',11);

    cats.slice(0,8).forEach((cat,i)=>{
      const x=500, y=92+i*38;
      s.append(se('circle',{cx:x,cy:y-4,r:7,fill:palette[i%palette.length]}));
      txt(s,x+17,y,String(cat).slice(0,22),'start',11);
    });
  };

  const css=document.createElement('style');
  css.textContent=`
    .pie-block-v22 h3{font-size:clamp(20px,3vw,28px);margin:4px 0 10px}
    .pie-chart-v22{overflow:hidden}
    .pie-chart-v22 svg{min-width:0!important;width:100%;max-width:100%;height:auto}
    @media(max-width:620px){.pie-block-v22 h3{font-size:clamp(20px,5.5vw,27px)}.pie-chart-v22 svg{width:100%;min-height:360px}}
  `;
  document.head.append(css);
})();
