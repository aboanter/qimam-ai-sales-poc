(() => {
  const oldRender = window.renderComponent;
  if (typeof oldRender !== 'function') return;

  function applyKpiInternal(c, cell) {
    const k = cell.querySelector('.kpi');
    if (!k) return;
    const ic = k.querySelector('.kpi-icon');
    const title = k.querySelector('.kpi-title');
    const value = k.querySelector('.kpi-value');
    if (!title || !value) return;

    // Modern default: icon and title share one header row. The model can override
    // through componentLayout/headerLayout/iconPosition/titleSize/valueAlign.
    const cfg = c.componentLayout || c.internalLayout || {};
    const mode = cfg.headerLayout || 'inline';
    if (mode === 'inline' && ic) {
      const head = document.createElement('div');
      head.className = 'kpi-head-v22';
      const end = cfg.iconPosition !== 'start';
      if (end) head.append(title, ic); else head.append(ic, title);
      k.insertBefore(head, value);
    }
    if (cfg.titleSize) title.style.fontSize = cfg.titleSize;
    if (cfg.titleWeight) title.style.fontWeight = String(cfg.titleWeight);
    if (cfg.valueAlign) value.style.textAlign = cfg.valueAlign;
    if (cfg.contentAlign === 'center') k.style.textAlign = 'center';
  }

  window.renderComponent = function renderComponentV22(c, cell) {
    oldRender(c, cell);
    if (c && c.type === 'kpi') applyKpiInternal(c, cell);
  };

  const css = document.createElement('style');
  css.textContent = `
    .kpi-head-v22{position:relative;z-index:2;display:flex;align-items:center;justify-content:space-between;gap:16px;width:100%;margin-bottom:14px}
    .kpi-head-v22 .kpi-icon{margin:0;flex:0 0 auto}
    .kpi-head-v22 .kpi-title{font-size:clamp(18px,3vw,26px);font-weight:750;line-height:1.45;flex:1}
    .kpi-head-v22 + .kpi-value{margin-top:2px}
    @media(max-width:620px){.kpi-head-v22{gap:12px;margin-bottom:12px}.kpi-head-v22 .kpi-title{font-size:clamp(19px,5.4vw,25px)}}
  `;
  document.head.append(css);
})();
