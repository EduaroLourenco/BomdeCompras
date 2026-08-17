/* ============================================================
   Motor de gráficos — canvas puro
   ============================================================ */
const CHARTS = new Map();
const tipEl = (() => { const d = document.createElement('div'); d.className = 'tip'; d.style.opacity = '0'; d.style.pointerEvents = 'none'; document.body.appendChild(d); return d; })();
function hideTip() { tipEl.style.opacity = '0'; }

function chart(id, spec) {
  const c = document.getElementById(id);
  if (!c) return;
  CHARTS.set(id, spec);
  draw(c, spec, -1);
  if (spec.interactive === false) { c.onmousemove = null; c.onmouseleave = null; return; }
  c.onmousemove = ev => {
    const r = c.getBoundingClientRect();
    const g = geom(c, spec);
    const n = spec.labels.length;
    let k = spec.type === 'line'
      ? Math.round(((ev.clientX - r.left) - g.pl) / g.pw * (n - 1))
      : Math.floor(((ev.clientX - r.left) - g.pl) / (g.pw / n));
    k = Math.max(0, Math.min(n - 1, k));
    
    if (c._lastK !== k) {
      c._lastK = k;
      draw(c, spec, k);
      const rows = spec.series.filter(s => s.inTip !== false).map(s => {
        const v = s.data[k];
        const f = s.fmt || spec.tipFmt || (x => brl(x));
        let html = `<div class="tr"><span><i style="background:${s.color}"></i>${esc(s.name)}</span><b>${v == null ? '—' : f(v)}</b></div>`;
        if (k > 0 && v != null) {
          const pv = s.data[k - 1];
          if (pv != null && pv !== 0) {
            const d = (v - pv) / Math.abs(pv);
            const inv = s.name.toLowerCase().includes('cancel') || s.name.toLowerCase().includes('tacos');
            const good = inv ? d <= 0 : d >= 0;
            const cCls = Math.abs(d) < 0.005 ? 'z' : (good ? 'up' : 'dn');
            html += `<div class="tr" style="margin-top:2px;padding-top:2px;border-top:1px solid var(--line-2)">
              <span style="font-size:9.5px;color:var(--ink-3);padding-left:14px">vs. anterior</span>
              <b class="${cCls}" style="font-size:10px">${d > 0 ? '+' : ''}${pct(d, 1)}</b>
            </div>`;
          }
        }
        return html;
      }).join('');
      const extra = spec.tipExtra ? spec.tipExtra(k) : '';
      tipEl.innerHTML = `<div class="tt">${esc(spec.tipTitle ? spec.tipTitle(k) : spec.labels[k])}</div>${rows}${extra}`;
    }
    
    tipEl.style.opacity = '1';
    const tw = tipEl.offsetWidth;
    const x = Math.max(tw / 2 + 6, Math.min(document.documentElement.clientWidth - tw / 2 - 6, ev.clientX));
    tipEl.style.left = x + 'px';
    tipEl.style.top = ev.clientY + 'px';
  };
  c.onmouseleave = () => { hideTip(); c._lastK = -1; draw(c, spec, -1); c.style.cursor = ''; };
  if (spec.onPick) {
    c.style.cursor = 'pointer';
    c.onclick = ev => {
      const r = c.getBoundingClientRect();
      const g = geom(c, spec);
      const n = spec.labels.length;
      let k = spec.type === 'line'
        ? Math.round(((ev.clientX - r.left) - g.pl) / g.pw * (n - 1))
        : Math.floor(((ev.clientX - r.left) - g.pl) / (g.pw / n));
      k = Math.max(0, Math.min(n - 1, k));
      hideTip();
      spec.onPick(k);
    };
  } else { c.onclick = null; c.style.cursor = ''; }
}
function geom(c, spec) {
  const w = c.clientWidth || c.parentElement.clientWidth;
  /* Lê a altura CSS pretendida, NÃO o atributo canvas.height (que é o buffer em px
     físicos e é escalado por devicePixelRatio). Guarda num data-attr na 1ª vez. */
  if (!c.dataset.cssH) c.dataset.cssH = c.getAttribute('height') || '200';
  const h = +c.dataset.cssH;
  const pl = spec.padL ?? 52, pr = spec.padR ?? (spec.series.some(s => s.axis === 'r') ? 48 : 14);
  const pt = 12, pb = spec.hideX ? 8 : 26;
  return { w, h, pl, pr, pt, pb, pw: w - pl - pr, ph: h - pt - pb };
}
function draw(c, spec, hover) {
  const g = geom(c, spec);
  const ratio = Math.min(devicePixelRatio || 1, 2);
  const nw = Math.max(1, Math.round(g.w * ratio));
  const nh = Math.round(g.h * ratio);
  if (c.width !== nw || c.height !== nh) {
    c.width = nw; c.height = nh;
    c.style.height = g.h + 'px';
  }
  const x = c.getContext('2d');
  x.setTransform(ratio, 0, 0, ratio, 0, 0);
  x.clearRect(0, 0, g.w, g.h);
  const n = spec.labels.length;
  if (!n) return;

  const L = spec.series.filter(s => s.axis !== 'r');
  const R = spec.series.filter(s => s.axis === 'r');
  const stacked = spec.type === 'stack';

  function bounds(list, forceZero) {
    let mx = -Infinity, mn = Infinity;
    if (stacked) {
      for (let i = 0; i < n; i++) {
        let p = 0, ng = 0;
        list.forEach(s => { const v = s.data[i] || 0; v >= 0 ? p += v : ng += v; });
        mx = Math.max(mx, p); mn = Math.min(mn, ng);
      }
    } else {
      list.forEach(s => s.data.forEach(v => { if (v != null && isFinite(v)) { mx = Math.max(mx, v); mn = Math.min(mn, v); } }));
    }
    if (!isFinite(mx)) { mx = 1; mn = 0; }
    if (forceZero !== false) { mn = Math.min(0, mn); mx = Math.max(0, mx); }
    if (mx === mn) mx = mn + 1;
    mx += (mx - mn) * 0.08;
    return [mn, mx];
  }
  const [lmn, lmx] = bounds(L, spec.zeroBase);
  const [rmn, rmx] = R.length ? bounds(R, spec.zeroBaseR) : [0, 1];
  const yL = v => g.pt + g.ph - ((v - lmn) / (lmx - lmn)) * g.ph;
  const yR = v => g.pt + g.ph - ((v - rmn) / (rmx - rmn)) * g.ph;
  const bandW = g.pw / n;
  const xAt = i => spec.type === 'line' ? g.pl + (n <= 1 ? g.pw / 2 : (i / (n - 1)) * g.pw) : g.pl + bandW * (i + 0.5);

  /* grid + eixo Y */
  x.font = '10.5px ' + cvar('--f-num');
  x.strokeStyle = cvar('--grid'); x.lineWidth = 1;
  const TICKS = 4;
  for (let t = 0; t <= TICKS; t++) {
    const v = lmn + (lmx - lmn) * t / TICKS, yy = Math.round(yL(v)) + .5;
    x.strokeStyle = (Math.abs(v) < 1e-9 && lmn < 0) ? cvar('--line-2') : cvar('--grid');
    x.beginPath(); x.moveTo(g.pl, yy); x.lineTo(g.w - g.pr, yy); x.stroke();
    x.fillStyle = cvar('--ink-3'); x.textAlign = 'right'; x.textBaseline = 'middle';
    x.fillText((spec.yFmt || axisK)(v), g.pl - 7, yy);
  }
  if (R.length) {
    x.textAlign = 'left';
    for (let t = 0; t <= TICKS; t++) {
      const v = rmn + (rmx - rmn) * t / TICKS;
      x.fillStyle = cvar('--ink-3');
      x.fillText((spec.y2Fmt || axisK)(v), g.w - g.pr + 7, Math.round(yR(v)) + .5);
    }
  }
  /* eixo X */
  if (!spec.hideX) {
    x.textAlign = 'center'; x.textBaseline = 'top'; x.fillStyle = cvar('--ink-3');
    x.font = '10.5px ' + cvar('--f-ui');
    const target = spec.maxXTicks || Math.max(2, Math.floor(g.pw / 58));
    const step = Math.max(1, Math.ceil(n / target));
    for (let i = 0; i < n; i += step) x.fillText(spec.labels[i], xAt(i), g.h - g.pb + 7);
  }

  /* hover: banda/linha */
  if (hover >= 0) {
    x.fillStyle = cvar('--grid-2');
    if (spec.type === 'line') {
      const hx = Math.round(xAt(hover)) + .5;
      x.strokeStyle = cvar('--line-2'); x.setLineDash([3, 3]);
      x.beginPath(); x.moveTo(hx, g.pt); x.lineTo(hx, g.pt + g.ph); x.stroke(); x.setLineDash([]);
    } else {
      x.fillRect(g.pl + bandW * hover, g.pt, bandW, g.ph);
    }
  }

  /* barras */
  const bars = spec.series.filter(s => s.type === 'bar' || (spec.type === 'bar' || stacked) && !s.type);
  if (stacked) {
    for (let i = 0; i < n; i++) {
      let accP = 0, accN = 0;
      const bw = bandW * 0.68, bx = g.pl + bandW * i + (bandW - bw) / 2;
      bars.forEach(s => {
        const v = s.data[i] || 0; if (!v) return;
        const from = v >= 0 ? accP : accN, to = from + v;
        const y0 = yL(from), y1 = yL(to);
        x.fillStyle = s.color;
        x.fillRect(bx, Math.min(y0, y1), bw, Math.abs(y1 - y0));
        v >= 0 ? accP = to : accN = to;
      });
    }
  } else if (bars.length) {
    const grp = bars.length;
    const bw = Math.max(2, (bandW * 0.72) / grp);
    bars.forEach((s, si) => {
      s.data.forEach((v, i) => {
        if (v == null || !isFinite(v) || v === 0) return;
        const bx = g.pl + bandW * i + (bandW - bw * grp) / 2 + bw * si;
        const yy = s.axis === 'r' ? yR : yL;
        const y0 = yy(0), y1 = yy(v);
        x.fillStyle = s.color;
        x.globalAlpha = hover >= 0 && hover !== i ? .45 : 1;
        const rr = Math.min(3, bw / 2), top = Math.min(y0, y1), hh = Math.max(1, Math.abs(y1 - y0));
        x.beginPath();
        if (x.roundRect) x.roundRect(bx, top, bw, hh, v >= 0 ? [rr, rr, 0, 0] : [0, 0, rr, rr]);
        else x.rect(bx, top, bw, hh);
        x.fill();
        x.globalAlpha = 1;
      });
    });
  }

  /* áreas e linhas */
  spec.series.filter(s => s.type === 'line' || s.type === 'area').forEach(s => {
    const yy = s.axis === 'r' ? yR : yL;
    const pts = s.data.map((v, i) => v == null || !isFinite(v) ? null : [xAt(i), yy(v)]);
    if (s.type === 'area') {
      const gr = x.createLinearGradient(0, g.pt, 0, g.pt + g.ph);
      gr.addColorStop(0, s.color + '44'); gr.addColorStop(1, s.color + '05');
      x.beginPath(); let open = false, firstX = 0, lastX = 0;
      pts.forEach(p => { if (!p) return; if (!open) { x.moveTo(p[0], p[1]); firstX = p[0]; open = true; } else x.lineTo(p[0], p[1]); lastX = p[0]; });
      if (open) { x.lineTo(lastX, yy(Math.max(0, lmn))); x.lineTo(firstX, yy(Math.max(0, lmn))); x.closePath(); x.fillStyle = gr; x.fill(); }
    }
    x.beginPath(); x.strokeStyle = s.color; x.lineWidth = s.width || 2;
    x.lineJoin = 'round'; x.lineCap = 'round';
    x.setLineDash(s.dash || []);
    let open = false;
    pts.forEach(p => { if (!p) { open = false; return; } open ? x.lineTo(p[0], p[1]) : (x.moveTo(p[0], p[1]), open = true); });
    x.stroke(); x.setLineDash([]);
    for (let i = pts.length - 1; i >= 0; i--) { if (pts[i]) { x.beginPath(); x.arc(pts[i][0], pts[i][1], 3, 0, 7); x.fillStyle = s.color; x.fill(); break; } }
    if (hover >= 0 && pts[hover]) {
      x.beginPath(); x.arc(pts[hover][0], pts[hover][1], 4.5, 0, 7);
      x.fillStyle = cvar('--panel'); x.fill();
      x.lineWidth = 2.4; x.strokeStyle = s.color; x.stroke();
    }
  });
}

/* sparkline sem eixos */
function spark(canvas, data, color, opts) {
  opts = opts || {};
  if (!canvas.dataset.cssH) canvas.dataset.cssH = canvas.getAttribute('height') || '34';
  const w = canvas.clientWidth || 120, h = +canvas.dataset.cssH;
  const ratio = Math.min(devicePixelRatio || 1, 2);
  const nw = Math.round(w * ratio), nh = Math.round(h * ratio);
  if (canvas.width !== nw || canvas.height !== nh) {
    canvas.width = nw; canvas.height = nh;
    canvas.style.height = h + 'px';
  }
  const x = canvas.getContext('2d'); x.setTransform(ratio, 0, 0, ratio, 0, 0);
  x.clearRect(0, 0, w, h);
  const vals = data.filter(v => v != null && isFinite(v));
  if (!vals.length) return;
  let mn = Math.min(...vals), mx = Math.max(...vals);
  if (mx === mn) { mx = mn + 1; }
  const pad = 3;
  const xa = i => (i / Math.max(1, data.length - 1)) * (w - 2) + 1;
  const ya = v => h - pad - ((v - mn) / (mx - mn)) * (h - pad * 2);
  if (opts.bars) {
    const bw = Math.max(1.5, (w / data.length) * .62);
    data.forEach((v, i) => {
      if (v == null) return;
      const y0 = ya(Math.max(0, mn)), y1 = ya(v);
      x.fillStyle = color; x.globalAlpha = .85;
      x.fillRect(xa(i) - bw / 2, Math.min(y0, y1), bw, Math.max(1, Math.abs(y1 - y0)));
    });
    x.globalAlpha = 1; return;
  }
  const gr = x.createLinearGradient(0, 0, 0, h);
  gr.addColorStop(0, color + (opts.fill ? '55' : '3a')); gr.addColorStop(1, color + (opts.fill ? '08' : '00'));
  x.beginPath(); data.forEach((v, i) => { if (v == null) return; i ? x.lineTo(xa(i), ya(v)) : x.moveTo(xa(i), ya(v)); });
  x.lineTo(xa(data.length - 1), h); x.lineTo(xa(0), h); x.closePath(); x.fillStyle = gr; x.fill();
  x.beginPath(); x.lineWidth = 1.8; x.strokeStyle = color; x.lineJoin = 'round';
  let open = false;
  data.forEach((v, i) => { if (v == null) { open = false; return; } open ? x.lineTo(xa(i), ya(v)) : (x.moveTo(xa(i), ya(v)), open = true); });
  x.stroke();
  const li = data.length - 1;
  if (data[li] != null) { x.beginPath(); x.arc(xa(li), ya(data[li]), 2.6, 0, 7); x.fillStyle = color; x.fill(); }
}

/* anel de progresso */
function ring(canvas, frac, color, label, sub) {
  if (!canvas.dataset.cssH) canvas.dataset.cssH = canvas.getAttribute('height') || '152';
  const w = canvas.clientWidth, h = +canvas.dataset.cssH;
  const ratio = Math.min(devicePixelRatio || 1, 2);
  const nw = Math.round(w * ratio), nh = Math.round(h * ratio);
  if (canvas.width !== nw || canvas.height !== nh) {
    canvas.width = nw; canvas.height = nh;
    canvas.style.height = h + 'px';
  }
  const x = canvas.getContext('2d'); x.setTransform(ratio, 0, 0, ratio, 0, 0);
  x.clearRect(0, 0, w, h);
  const cx = w / 2, cy = h / 2 + 4, r = Math.min(w, h * 1.55) / 2 - 16;
  const A0 = Math.PI * 0.75, A1 = Math.PI * 2.25;
  x.lineWidth = 13; x.lineCap = 'round';
  x.beginPath(); x.arc(cx, cy, r, A0, A1); x.strokeStyle = cvar('--panel-3'); x.stroke();
  const f = Math.max(0, Math.min(1.2, frac || 0));
  if (f > 0) { x.beginPath(); x.arc(cx, cy, r, A0, A0 + (A1 - A0) * Math.min(1, f)); x.strokeStyle = color; x.stroke(); }
  x.textAlign = 'center'; x.fillStyle = cvar('--ink');
  x.font = '600 26px ' + cvar('--f-num');
  x.fillText(label, cx, cy + 4);
  if (sub) { x.font = '11px ' + cvar('--f-ui'); x.fillStyle = cvar('--ink-3'); x.fillText(sub, cx, cy + 24); }
}

let rzTimer = null;
let _lastWinW = innerWidth, _lastWinH = innerHeight;
addEventListener('resize', () => {
  if (innerWidth === _lastWinW && innerHeight === _lastWinH) return;
  _lastWinW = innerWidth; _lastWinH = innerHeight;
  clearTimeout(rzTimer); rzTimer = setTimeout(() => { hideTip(); render(); }, 140); 
});

/* ──────────────────────────── DONUT CHART ──────────────────────────── */
function donut(canvas, slices, opts) {
  opts = opts || {};
  if (!canvas.dataset.cssH) canvas.dataset.cssH = canvas.getAttribute('height') || '200';
  const w = canvas.clientWidth || 200, h = +canvas.dataset.cssH;
  const ratio = Math.min(devicePixelRatio || 1, 2);
  const nw = Math.round(w * ratio), nh = Math.round(h * ratio);
  if (canvas.width !== nw || canvas.height !== nh) {
    canvas.width = nw; canvas.height = nh;
    canvas.style.height = h + 'px';
  }
  const x = canvas.getContext('2d'); x.setTransform(ratio, 0, 0, ratio, 0, 0);
  x.clearRect(0, 0, w, h);
  const cx = w / 2, cy = h / 2, r = Math.min(w, h) / 2 - 8, ri = r * .62;
  const total = slices.reduce((s, sl) => s + (sl.v || 0), 0);
  if (!total) return;
  let start = -Math.PI / 2;
  const hov = opts.hover ?? -1;
  slices.forEach((sl, i) => {
    const angle = (sl.v / total) * Math.PI * 2;
    const isHov = i === hov;
    const boost = isHov ? 5 : 0;
    x.beginPath();
    x.arc(cx, cy, r + boost, start, start + angle);
    x.arc(cx, cy, ri - boost, start + angle, start, true);
    x.closePath();
    x.fillStyle = sl.color;
    x.globalAlpha = hov >= 0 && !isHov ? .55 : 1;
    x.fill();
    x.globalAlpha = 1;
    // gap line
    x.beginPath(); x.moveTo(cx, cy);
    x.lineTo(cx + Math.cos(start) * (r + 8), cy + Math.sin(start) * (r + 8));
    x.strokeStyle = cvar('--ground'); x.lineWidth = 2.5; x.stroke();
    start += angle;
  });
  // center text
  if (opts.centerVal) {
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.font = '700 18px ' + cvar('--f-num');
    x.fillStyle = cvar('--ink');
    x.fillText(opts.centerVal, cx, cy - 7);
    x.font = '500 10px ' + cvar('--f-ui');
    x.fillStyle = cvar('--ink-3');
    x.fillText(opts.centerLabel || '', cx, cy + 9);
  }
  CHARTS.set(canvas.id + '_donut', { slices, total, opts, w, h, cx, cy, r, ri });
  canvas.onmousemove = ev => {
    const rect = canvas.getBoundingClientRect();
    const mx = (ev.clientX - rect.left) - cx, my = (ev.clientY - rect.top) - cy;
    const dist = Math.sqrt(mx * mx + my * my);
    if (dist < ri || dist > r + 8) { hideTip(); donut(canvas, slices, { ...opts, hover: -1 }); return; }
    let angle = Math.atan2(my, mx) + Math.PI / 2;
    if (angle < 0) angle += Math.PI * 2;
    let cumAngle = 0, found = -1;
    for (let i = 0; i < slices.length; i++) {
      cumAngle += (slices[i].v / total) * Math.PI * 2;
      if (angle <= cumAngle) { found = i; break; }
    }
    if (found < 0) found = slices.length - 1;
    if (found !== opts.hover) {
      opts.hover = found;
      donut(canvas, slices, { ...opts, hover: found });
      const sl = slices[found];
      tipEl.innerHTML = `<div class="tt">${esc(sl.name)}</div><div class="tr"><b>${sl.fmt ? sl.fmt(sl.v) : brl(sl.v)}</b></div><div class="tr"><span>Share</span><b>${pct(sl.v / total, 1)}</b></div>`;
    }
    tipEl.style.opacity = '1';
    const tw = tipEl.offsetWidth;
    const tipx = Math.max(tw/2+6, Math.min(document.documentElement.clientWidth-tw/2-6, ev.clientX));
    tipEl.style.left = tipx + 'px';
    tipEl.style.top = ev.clientY + 'px';
  };
  canvas.onmouseleave = () => { hideTip(); donut(canvas, slices, { ...opts, hover: -1 }); };
  if (opts.onClick) {
    canvas.style.cursor = 'pointer';
    canvas.onclick = ev => {
      const rect = canvas.getBoundingClientRect();
      const mx = (ev.clientX - rect.left) - cx, my = (ev.clientY - rect.top) - cy;
      const dist = Math.sqrt(mx * mx + my * my);
      if (dist < ri || dist > r + 8) return;
      let angle = Math.atan2(my, mx) + Math.PI / 2;
      if (angle < 0) angle += Math.PI * 2;
      let cumAngle = 0, found = -1;
      for (let i = 0; i < slices.length; i++) {
        cumAngle += (slices[i].v / total) * Math.PI * 2;
        if (angle <= cumAngle) { found = i; break; }
      }
      if (found >= 0) opts.onClick(found, slices[found]);
    };
  }
}

/* ──────────────────────────── RADAR CHART ──────────────────────────── */
function radar(canvas, axes, series, opts) {
  opts = opts || {};
  if (!canvas.dataset.cssH) canvas.dataset.cssH = canvas.getAttribute('height') || '280';
  const w = canvas.clientWidth || 300, h = +canvas.dataset.cssH;
  const ratio = Math.min(devicePixelRatio || 1, 2);
  const nw = Math.round(w * ratio), nh = Math.round(h * ratio);
  if (canvas.width !== nw || canvas.height !== nh) {
    canvas.width = nw; canvas.height = nh;
    canvas.style.height = h + 'px';
  }
  const x = canvas.getContext('2d'); x.setTransform(ratio, 0, 0, ratio, 0, 0);
  x.clearRect(0, 0, w, h);
  const cx = w / 2, cy = h / 2 + 5;
  const r = Math.min(w, h) / 2 - 32;
  const N = axes.length;
  const angle0 = -Math.PI / 2;
  const pt = (i, frac) => {
    const a = angle0 + (i / N) * Math.PI * 2;
    return [cx + Math.cos(a) * r * frac, cy + Math.sin(a) * r * frac];
  };
  // grid rings
  x.strokeStyle = cvar('--grid'); x.lineWidth = 1;
  [.25, .5, .75, 1].forEach(f => {
    x.beginPath();
    for (let i = 0; i <= N; i++) {
      const [px, py] = pt(i % N, f);
      i === 0 ? x.moveTo(px, py) : x.lineTo(px, py);
    }
    x.closePath(); x.stroke();
  });
  // axis lines
  axes.forEach((_, i) => {
    const [px, py] = pt(i, 1);
    x.beginPath(); x.moveTo(cx, cy); x.lineTo(px, py);
    x.strokeStyle = cvar('--grid'); x.lineWidth = 1; x.stroke();
    // label
    const [lx, ly] = pt(i, 1.22);
    x.textAlign = Math.abs(lx - cx) < 5 ? 'center' : lx > cx ? 'left' : 'right';
    x.textBaseline = ly < cy ? 'bottom' : 'top';
    x.font = '600 10px ' + cvar('--f-ui');
    x.fillStyle = cvar('--ink-2');
    x.fillText(axes[i], lx, ly);
  });
  // series
  series.forEach(s => {
    x.beginPath();
    s.data.forEach((v, i) => {
      const [px, py] = pt(i, Math.max(0, Math.min(1, v)));
      i === 0 ? x.moveTo(px, py) : x.lineTo(px, py);
    });
    x.closePath();
    x.fillStyle = s.color + '28'; x.fill();
    x.strokeStyle = s.color; x.lineWidth = 2; x.stroke();
    // dots
    s.data.forEach((v, i) => {
      const [px, py] = pt(i, Math.max(0, Math.min(1, v)));
      x.beginPath(); x.arc(px, py, 3.5, 0, 7);
      x.fillStyle = s.color; x.fill();
    });
  });
}

/* ──────────────────────────── SCATTER PLOT ──────────────────────────── */
function scatter(canvas, points, opts) {
  opts = opts || {};
  if (!canvas.dataset.cssH) canvas.dataset.cssH = canvas.getAttribute('height') || '240';
  const w = canvas.clientWidth || 300, h = +canvas.dataset.cssH;
  const ratio = Math.min(devicePixelRatio || 1, 2);
  const nw = Math.round(w * ratio), nh = Math.round(h * ratio);
  if (canvas.width !== nw || canvas.height !== nh) {
    canvas.width = nw; canvas.height = nh;
    canvas.style.height = h + 'px';
  }
  const x = canvas.getContext('2d'); x.setTransform(ratio, 0, 0, ratio, 0, 0);
  x.clearRect(0, 0, w, h);
  const pl = 52, pr = 20, pt2 = 14, pb = 28;
  const pw = w - pl - pr, ph = h - pt2 - pb;
  const xs = points.map(p => p.x).filter(v => v != null && isFinite(v));
  const ys = points.map(p => p.y).filter(v => v != null && isFinite(v));
  const ss = points.map(p => p.size || 1);
  if (!xs.length) return;
  const xmn = Math.min(...xs) * .85, xmx = Math.max(...xs) * 1.1;
  const ymn = Math.min(...ys) * .85, ymx = Math.max(...ys) * 1.1;
  const smx = Math.max(...ss) || 1;
  const toX = v => pl + ((v - xmn) / (xmx - xmn)) * pw;
  const toY = v => pt2 + ph - ((v - ymn) / (ymx - ymn)) * ph;
  // grid
  x.strokeStyle = cvar('--grid'); x.lineWidth = 1;
  const TICKS = 4;
  for (let t = 0; t <= TICKS; t++) {
    const vy = ymn + (ymx - ymn) * t / TICKS;
    const yy = Math.round(toY(vy)) + .5;
    x.beginPath(); x.moveTo(pl, yy); x.lineTo(w - pr, yy); x.stroke();
    x.font = '10px ' + cvar('--f-num'); x.fillStyle = cvar('--ink-3');
    x.textAlign = 'right'; x.textBaseline = 'middle';
    x.fillText(axisK(vy), pl - 6, yy);
    const vx = xmn + (xmx - xmn) * t / TICKS;
    const xx = Math.round(toX(vx)) + .5;
    x.fillText = x.fillText; // no-op
  }
  // X labels
  x.textAlign = 'center'; x.textBaseline = 'top'; x.font = '10px ' + cvar('--f-num'); x.fillStyle = cvar('--ink-3');
  for (let t = 0; t <= TICKS; t++) {
    const vx = xmn + (xmx - xmn) * t / TICKS;
    x.fillText(opts.xFmt ? opts.xFmt(vx) : axisK(vx), toX(vx), h - pb + 7);
  }
  // X/Y axis labels
  if (opts.xLabel) {
    x.textAlign = 'center'; x.font = '600 10px ' + cvar('--f-ui'); x.fillStyle = cvar('--ink-3');
    x.fillText(opts.xLabel, pl + pw / 2, h - 6);
  }
  // points
  points.forEach(p => {
    if (p.x == null || p.y == null) return;
    const px = toX(p.x), py = toY(p.y);
    const radius = 5 + ((p.size || 1) / smx) * 14;
    x.beginPath(); x.arc(px, py, radius, 0, 7);
    x.fillStyle = p.color + 'bb'; x.fill();
    x.strokeStyle = p.color; x.lineWidth = 1.5; x.stroke();
    if (p.label) {
      x.font = '600 10px ' + cvar('--f-ui'); x.fillStyle = cvar('--ink-2');
      x.textAlign = 'center'; x.textBaseline = 'bottom';
      x.fillText(p.label, px, py - radius - 2);
    }
  });
  // tooltip
  canvas.onmousemove = ev => {
    const rect = canvas.getBoundingClientRect();
    const mx = ev.clientX - rect.left, my = ev.clientY - rect.top;
    let closest = null, minD = Infinity;
    points.forEach(p => {
      if (p.x == null || p.y == null) return;
      const dx = mx - toX(p.x), dy = my - toY(p.y);
      const d = Math.sqrt(dx*dx + dy*dy);
      if (d < minD) { minD = d; closest = p; }
    });
    if (closest && minD < 28) {
      if (canvas._lastHover !== closest) {
        canvas._lastHover = closest;
        tipEl.innerHTML = `<div class="tt">${esc(closest.name || closest.label || '')}</div>
          <div class="tr"><span>${esc(opts.xLabel || 'X')}</span><b>${opts.xFmt ? opts.xFmt(closest.x) : brl(closest.x)}</b></div>
          <div class="tr"><span>${esc(opts.yLabel || 'Y')}</span><b>${opts.yFmt ? opts.yFmt(closest.y) : brl(closest.y)}</b></div>`;
      }
      tipEl.style.opacity = '1';
      const tw = tipEl.offsetWidth;
      tipEl.style.left = Math.max(tw/2+6, Math.min(document.documentElement.clientWidth-tw/2-6, ev.clientX)) + 'px';
      tipEl.style.top = ev.clientY + 'px';
    } else hideTip();
  };
  canvas.onmouseleave = hideTip;
}

/* ──────────────────────────── HEAT CALENDAR ──────────────────────────── */
function heatCalendar(container, dayData, opts) {
  // dayData: Map<iso, value>
  // renders a GitHub-style heat calendar for all DAYS
  opts = opts || {};
  const maxV = Math.max(...Object.values(dayData).filter(v => v > 0), 1);
  const color = opts.color || cvar('--brand');
  // build week columns
  const weeks = [];
  let week = [];
  DAYS.forEach(d => {
    if (week.length === 0 && d.dow !== 0) {
      // fill leading empty cells
      for (let i = 0; i < d.dow; i++) week.push(null);
    }
    week.push(d);
    if (d.dow === 6) { weeks.push(week); week = []; }
  });
  if (week.length) { while (week.length < 7) week.push(null); weeks.push(week); }

  // month header labels
  const monthStarts = {};
  weeks.forEach((w, wi) => {
    const firstReal = w.find(d => d !== null);
    if (firstReal && (wi === 0 || firstReal.d <= 7)) monthStarts[wi] = MON_S[firstReal.m];
  });

  let html = '<div class="heatcal-months">';
  let lastMon = null;
  weeks.forEach((_, wi) => {
    const lbl = monthStarts[wi];
    if (lbl && lbl !== lastMon) { html += `<span style="width:${13+3}px">${lbl}</span>`; lastMon = lbl; }
    else html += `<span style="width:${13+3}px"></span>`;
  });
  html += '</div>';

  const DOW_TINY = ['S','T','Q','Q','S','S','D'];
  html += '<div class="heatcal" style="flex-direction:row;gap:3px">';
  // left labels column
  html += '<div style="display:flex;flex-direction:column;gap:3px;padding-top:0">';
  DOW_TINY.forEach(l => html += `<div class="heatcal-label">${l}</div>`);
  html += '</div>';

  weeks.forEach(w => {
    html += '<div style="display:flex;flex-direction:column;gap:3px">';
    w.forEach(d => {
      if (!d) { html += '<div style="width:13px;height:13px"></div>'; return; }
      const v = dayData[d.iso] || 0;
      const intensity = v ? Math.max(0.1, v / maxV) : 0;
      const alpha = v ? Math.round(intensity * 200 + 40).toString(16).padStart(2,'0') : '00';
      const bg = v ? color + alpha : '';
      const bgStyle = v ? `background:${color}${alpha}` : 'background:var(--panel-3)';
      const title = `${d.long}: ${opts.fmt ? opts.fmt(v) : brl(v)}`;
      html += `<div class="heatcal-cell" title="${title}" data-iso="${d.iso}" data-v="${v}" style="${bgStyle}" onclick="if(typeof setPeriod==='function'){/* noop */}"></div>`;
    });
    html += '</div>';
  });
  html += '</div>';
  container.innerHTML = html;
  // tooltip on cells
  container.querySelectorAll('.heatcal-cell').forEach(el => {
    el.onmouseenter = ev => {
      const v = +el.dataset.v, iso = el.dataset.iso;
      const dayObj = DAYS.find(d => d.iso === iso);
      if (!dayObj) return;
      if (container._lastHover !== iso) {
        container._lastHover = iso;
        tipEl.innerHTML = `<div class="tt">${esc(dayObj.long + ' · ' + DOW_S[dayObj.dow])}</div><div class="tr"><b>${opts.fmt ? opts.fmt(v) : brl(v)}</b></div>`;
      }
      tipEl.style.opacity = '1';
      const tw = tipEl.offsetWidth;
      tipEl.style.left = Math.max(tw/2+6, Math.min(document.documentElement.clientWidth-tw/2-6, ev.clientX)) + 'px';
      tipEl.style.top = ev.clientY + 'px';
    };
    el.onmouseleave = hideTip;
  });
}
