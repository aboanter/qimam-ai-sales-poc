(() => {
  const originalChart = window.chart;
  if (typeof originalChart !== 'function') return;

  window.chart = function patchedChart(c, host) {
    if (!c || c.type !== 'pie_chart') return originalChart(c, host);

    const b = add('div', 'block');
    const h = add('h3', null, c.title || '');
    const w = add('div', 'chart');
    const s = se('svg', { viewBox: '0 0 760 340' });
    w.append(s); b.append(h, w); host.append(b);

    const cats = Array.isArray(c.categories) ? c.categories : [];
    const vals = Array.isArray(c.series?.[0]?.data) ? c.series[0].data.map(Number) : [];
    const clean = vals.map(v => Number.isFinite(v) && v > 0 ? v : 0);
    const sum = clean.reduce((a,b) => a+b, 0);
    if (!sum) return;

    const palette = ['#0b9da6','#ffae24','#126b80','#65c9ce','#2aa46f','#7c3aed','#dc2626','#64748b'];
    const cx = 380, cy = 150, r = 100;
    let start = -Math.PI/2;

    clean.forEach((v, i) => {
      if (!v) return;
      const angle = v / sum * Math.PI * 2;
      const end = start + angle;
      const x1 = cx + r * Math.cos(start), y1 = cy + r * Math.sin(start);
      const x2 = cx + r * Math.cos(end), y2 = cy + r * Math.sin(end);
      const large = angle > Math.PI ? 1 : 0;
      s.append(se('path', {
        d: `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`,
        fill: palette[i % palette.length]
      }));
      start = end;
    });

    // clean donut center
    s.append(se('circle', { cx, cy, r: 54, fill: '#ffffff' }));
    txt(s, cx, cy-4, fmt(sum, 'number', c), 'middle', 18);
    txt(s, cx, cy+18, c.series?.[0]?.name || 'الإجمالي', 'middle', 10);

    const legendStartY = 275;
    cats.slice(0, 8).forEach((cat, i) => {
      const col = i % 4, row = Math.floor(i / 4);
      const x = 95 + col * 165, y = legendStartY + row * 28;
      s.append(se('circle', { cx:x, cy:y-3, r:6, fill:palette[i % palette.length] }));
      const label = String(cat).slice(0, 16);
      txt(s, x+12, y, label, 'start', 10);
    });
  };
})();
