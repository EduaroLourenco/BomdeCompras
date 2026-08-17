/* ============================================================
   DASHBOARD
   ============================================================ */

/* ── Animação de contadores nos KPI cards ── */
function animateCounters() {
  const els = document.querySelectorAll('.kcard .kv.n, .kcard.hero .kv');
  els.forEach(el => {
    const raw = el.textContent.trim();
    if (!raw || raw === '—') return;
    // extract numeric value from formatted string like "R$ 7.832.730" or "5.234" or "2,09%"
    const isReais = raw.includes('R$');
    const isPct   = raw.endsWith('%');
    const numStr  = raw.replace(/R\$\s*/g,'').replace('%','').replace(/\./g,'').replace(',','.');
    const target  = parseFloat(numStr);
    if (!isFinite(target) || target === 0) return;

    const start = performance.now();
    const dur = 680; // ms
    const ease = t => t < .5 ? 2*t*t : -1+(4-2*t)*t; // ease in-out quad

    // store original to restore exactly after animation
    const original = raw;
    const formatVal = v => {
      if (isReais) return 'R$ ' + Math.round(v).toLocaleString('pt-BR');
      if (isPct)   return (v).toLocaleString('pt-BR', {minimumFractionDigits:2,maximumFractionDigits:2}) + '%';
      return Math.round(v).toLocaleString('pt-BR');
    };

    function step(now) {
      const elapsed = now - start;
      const progress = Math.min(1, elapsed / dur);
      el.textContent = formatVal(target * ease(progress));
      if (progress < 1) requestAnimationFrame(step);
      else el.textContent = original; // restore exact format
    }
    requestAnimationFrame(step);
    // pop animation
    el.classList.remove('pop');
    requestAnimationFrame(() => el.classList.add('pop'));
  });
}

function bucketize(days, gran) {
  if (gran === 'm') {
    const ms = [...new Set(days.map(i => DAYS[i].m))].sort((a, b) => a - b);
    return ms.map(m => ({ label: MON_S[m], full: MON_L[m], days: days.filter(i => DAYS[i].m === m), jump: 'm' + m }));
  }
  if (gran === 'w') {
    const set = new Set(days);
    return WEEKS.map(w => ({ label: w.label, full: 'Semana ' + w.n + ' · ' + w.range, days: w.days.filter(i => set.has(i)) }))
      .filter(b => b.days.length);
  }
  return days.map(i => ({ label: DAYS[i].label, full: DOW_L[DAYS[i].dow] + ', ' + DAYS[i].d + ' de ' + MON_L[DAYS[i].m], days: [i] }));
}
function renderDash() {
  const days = periodDays(), prev = prevDays(), sc = state.scope;
  const A = agg(days, sc), P = prev.length ? agg(prev, sc) : null;
  const monthly = Array.from({ length: 12 }, (_, m) => aggMonth(m, sc));
  const spDays = bucketize(days, days.length > 70 ? 'w' : 'd').map(b => agg(b.days, sc));

  /* ---------- faixa de KPI: novos cards premium ---------- */
  const metaTxt = A.meta
    ? `<div class="kmeta"><div class="bar"><i style="width:${Math.min(100, (A.atg || 0) * 100).toFixed(1)}%;background:${A.atg >= 1 ? 'var(--up)' : A.atg >= .85 ? 'var(--warn)' : 'var(--down)'}"></i></div>
       <div style="display:flex;justify-content:space-between;margin-top:6px;font-size:11.6px;color:var(--ink-2)">
         <span>${pct(A.atg, 0)} da meta de ${brlK(A.meta)}</span>
         <b class="n" style="color:${A.rec >= A.meta ? 'var(--up)' : 'var(--down)'}"><br>${A.rec >= A.meta ? '+' : ''}${brlK(A.rec - A.meta)}</b></div></div>`
    : `<div class="kmeta"><button class="btn" style="width:100%;justify-content:center" onclick="go('metas')">Definir metas para ver atingimento</button></div>`;

  const kCards = [
    { lab: 'Receita realizada', val: brl(A.rec), d: delta(A.rec, P && P.rec), foot: `${int(A.ped)} pedidos`, c: 0, key: 'rec', accent: 'var(--brand)' },
    { lab: 'Cancelamento', val: brl(A.cval), d: delta(A.cval, P && P.cval), inv: true, foot: `${pct(A.pctCancel)} da receita`, c: 5, key: 'cval', accent: 'var(--down)', bars: true },
    { lab: 'Pedidos pagos', val: int(A.pedPagos), d: delta(A.pedPagos, P && P.pedPagos), foot: `${int(A.cped)} cancelados`, c: 1, key: 'pedPagos', accent: 'var(--up)' },
    { lab: 'Ticket médio pago', val: brl(A.ticketPago), d: delta(A.ticketPago, P && P.ticketPago), foot: `bruto ${brl(A.ticket)}`, c: 3, key: 'ticketPago', accent: 'var(--s4)' },
    { lab: 'Visitas', val: int(A.vis), d: delta(A.vis, P && P.vis), foot: A.visMonthly ? 'registro mensal' : A.visMixed ? 'mensal + diário' : 'do diário', c: 4, key: 'vis', accent: 'var(--s5)' },
    { lab: 'Conversão', val: pct(A.conv, 2), d: delta(A.conv, P && P.conv), foot: A.ads ? `TACOS ${pct(A.tacos, 2)}` : 'sem ADS no período', c: 6, key: 'conv', accent: 'var(--s2)' }
  ];

  document.getElementById('kstrip').innerHTML = `
    <div class="kcard hero">
      <div class="kl">Receita paga · ${esc(periodLabel())}</div>
      <div class="kv">${brl(A.recPaga)}</div>
      <div class="kf">${deltaTag(delta(A.recPaga, P && P.recPaga))}
        <span>${pct(A.rec ? A.recPaga / A.rec : null)} da receita realizada entrou de fato</span></div>
      ${metaTxt}
      <canvas class="kspark" height="66" data-hs></canvas>
    </div>
    ${kCards.map((k, i) => `
      <div class="kcard" style="--kcard-accent:${k.accent}" data-k="${i}">
        <div class="kl">${k.lab}</div>
        <div class="kv n">${k.val}</div>
        <div class="kf">${deltaTag(k.d, k.inv)}<span>${k.foot}</span></div>
        <canvas class="kspark" height="34" data-sp="${i}"></canvas>
      </div>`).join('')}`;

  spark(document.querySelector('[data-hs]'), spDays.map(a => a.recPaga), seriesColor(0), { fill: true });
  document.querySelectorAll('[data-sp]').forEach(cv => {
    const k = kCards[+cv.dataset.sp];
    spark(cv, spDays.map(a => a[k.key]), seriesColor(k.c), { bars: k.bars });
  });
  /* ---------- animação de contador ---------- */
  animateCounters();

  document.getElementById('trendNote').textContent =
    prev.length ? `variação vs. os ${prev.length} dias anteriores` : 'não há período anterior para comparar';

  /* ---------- tendência (clicável) ---------- */
  const bk = bucketize(days, state.gran);
  const aggs = bk.map(b => agg(b.days, sc));
  const hasMeta = aggs.some(a => a.meta > 0);
  const S = [
    { name: 'Receita realizada', data: aggs.map(a => a.rec), color: seriesColor(0), type: state.gran === 'm' ? 'bar' : 'area', width: 2 },
    { name: 'Receita paga', data: aggs.map(a => a.recPaga), color: seriesColor(1), type: state.gran === 'm' ? 'bar' : 'line', width: 1.9 }
  ];
  if (hasMeta) S.push({ name: 'Meta', data: aggs.map(a => a.meta), color: cvar('--ink-3'), type: 'line', width: 1.5, dash: [5, 4] });
  chart('cTrend', {
    type: state.gran === 'm' ? 'bar' : 'line', labels: bk.map(b => b.label), series: S,
    tipTitle: k => bk[k].full,
    tipExtra: k => `<div class="tr" style="border-top:1px solid var(--line);margin-top:6px;padding-top:6px"><span>Cancelado</span><b>${brl(aggs[k].cval)}</b></div>
                    <div class="tr"><span>Pedidos</span><b>${int(aggs[k].ped)}</b></div>` +
      (bk[k].jump ? '<div class="hint">clique para filtrar por este mês</div>' : ''),
    onPick: k => { if (bk[k].jump) { setPeriod(bk[k].jump); } }
  });
  document.getElementById('trendHint').textContent =
    state.gran === 'm' ? 'clique num mês para filtrar' : 'passe o mouse para ver os valores';
  document.getElementById('lTrend').innerHTML = S.map(s => `<span><i style="background:${s.color}"></i>${s.name}</span>`).join('');

  /* ---------- ritmo vs meta ---------- */
  const elapsed = days.filter(i => i <= LAST_ACTIVE).length || days.length;
  const proj = elapsed ? A.rec / elapsed * days.length : 0;
  const pb = document.getElementById('paceBox');
  if (!A.meta) {
    pb.innerHTML = `<div class="blank"><div class="bg">◎</div>
      <b>Nenhuma meta definida</b>
      <p>Sem meta não há atingimento, GAP nem projeção. Leva menos de um minuto: informe a meta anual e distribua pelos 12 meses.</p>
      <button class="btn pri" onclick="go('metas')">Definir metas</button></div>`;
    document.getElementById('paceNote').textContent = '';
  } else {
    const f = A.rec / A.meta;
    const col = f >= 1 ? cvar('--up') : f >= .85 ? cvar('--warn') : cvar('--down');
    pb.innerHTML = `<canvas id="cRing" height="152"></canvas>
      <div style="margin-top:10px">
        ${[['Meta do período', brl(A.meta)], ['Realizado', brl(A.rec)],
           ['GAP', `<span class="${A.rec - A.meta >= 0 ? 'up' : 'dn'}">${A.rec >= A.meta ? '+' : ''}${brl(A.rec - A.meta)}</span>`],
           ['Projeção no ritmo atual', brl(proj)]]
          .map(([l, v]) => `<div class="kv2"><span>${l}</span><b>${v}</b></div>`).join('')}
      </div>`;
    ring(document.getElementById('cRing'), f, col, pct(f, 0), 'da meta');
    document.getElementById('paceNote').textContent = elapsed < days.length ? `${elapsed} de ${days.length} dias` : '';
  }

  /* ---------- ranking clicável ---------- */
  const rank = CH_IDS.map((id, i) => ({ id, i, v: agg(days, id).rec })).sort((a, b) => b.v - a.v);
  const topRec = Math.max(...rank.map(r => r.v), 1);
  const tot = rank.reduce((s, r) => s + r.v, 0) || 1;
  document.getElementById('chRank').innerHTML = rank.map(r => `
    <button class="rrow" data-ch="${r.id}" title="Filtrar por ${esc(CH_LABEL[r.id])}">
      <span class="rn"><i class="sw" style="background:${seriesColor(r.i)}"></i>${esc(CH_LABEL[r.id])}</span>
      <span class="rt"><i style="width:${Math.max(0, r.v / topRec * 100).toFixed(1)}%;background:${seriesColor(r.i)}"></i></span>
      <span class="rv">${brlK(r.v)}</span><span class="rp">${pct(r.v / tot, 1)}</span>
    </button>`).join('');
  document.querySelectorAll('#chRank .rrow').forEach(b => b.onclick = () => setScope(b.dataset.ch));

  // donut de share dos canais
  const donutCanvas = document.getElementById('cShareDonut');
  if (donutCanvas) {
    const activeRank = rank.filter(r => r.v > 0);
    const donutSlices = activeRank.map(r => ({ name: CH_LABEL[r.id], v: r.v, color: seriesColor(r.i), fmt: brl }));
    donut(donutCanvas, donutSlices, {
      centerVal: brlK(tot), centerLabel: 'total',
      onClick: (i) => { const ch = activeRank[i]; if (ch) setScope(ch.id); }
    });
    document.getElementById('lShareDonut').innerHTML = donutSlices.slice(0,5).map(sl =>
      `<span><i style="background:${sl.color}"></i>${sl.name}</span>`).join('');
  }

  /* ---------- empilhado ---------- */
  chart('cStack', {
    type: 'stack', labels: MON_S,
    series: CH_IDS.map((id, i) => ({ name: CH_LABEL[id], data: MON_S.map((_, m) => aggMonth(m, id).rec), color: seriesColor(i) })),
    tipTitle: k => MON_L[k],
    tipExtra: k => `<div class="tr" style="border-top:1px solid var(--line);margin-top:6px;padding-top:6px"><span>Total</span><b>${brl(monthly[k].rec)}</b></div><div class="hint">clique para filtrar por ${MON_L[k]}</div>`,
    onPick: k => setPeriod('m' + k)
  });
  document.getElementById('lStack').innerHTML = CH_IDS.map((id, i) =>
    `<span><i style="background:${seriesColor(i)}"></i>${CH_LABEL[id]}</span>`).join('');

  /* ---------- cancelamento / ads / ticket ---------- */
  chart('cCancel', {
    type: 'bar', labels: MON_S, padL: 46,
    series: [{ name: 'Cancelado', data: monthly.map(a => a.cval), color: seriesColor(5), type: 'bar' },
             { name: '% da receita', data: monthly.map(a => a.pctCancel), color: cvar('--ink-2'), type: 'line', axis: 'r', width: 1.7, fmt: v => pct(v, 1) }],
    y2Fmt: v => (v * 100).toFixed(0) + '%', tipTitle: k => MON_L[k], onPick: k => setPeriod('m' + k)
  });
  chart('cAds', {
    type: 'bar', labels: MON_S, padL: 46,
    series: [{ name: 'Inv. ADS', data: monthly.map(a => a.ads), color: seriesColor(2), type: 'bar' },
             { name: 'TACOS', data: monthly.map(a => a.tacos), color: seriesColor(0), type: 'line', axis: 'r', width: 1.7, fmt: v => pct(v, 2) }],
    y2Fmt: v => (v * 100).toFixed(1) + '%', tipTitle: k => MON_L[k], onPick: k => setPeriod('m' + k)
  });
  chart('cTicket', {
    type: 'line', labels: MON_S, padL: 48, zeroBase: false,
    series: [{ name: 'Ticket pago', data: monthly.map(a => a.ticketPago), color: seriesColor(3), type: 'area', width: 2 },
             { name: 'Ticket bruto', data: monthly.map(a => a.ticket), color: cvar('--ink-3'), type: 'line', width: 1.4, dash: [4, 3] }],
    tipTitle: k => MON_L[k]
  });

  /* ---------- funil de conversão ---------- */
  renderFunnel(days, sc, A);

  /* ---------- heat calendar ---------- */
  const calEl = document.getElementById('heatCalBox');
  if (calEl) {
    const dayData = {};
    days.forEach(i => { dayData[DAYS[i].iso] = agg([i], sc).recPaga; });
    heatCalendar(calEl, dayData, { fmt: brl, color: cvar('--brand') });
  }

  renderAlerts(days, prev, A, P, monthly);
  renderBestWorst(days, sc);
}

function renderFunnel(days, sc, A) {
  const el = document.getElementById('funnelBox');
  if (!el) return;
  const vis = A.vis || 0, ped = A.ped || 0, pagos = A.pedPagos || 0;
  if (!vis && !ped) {
    el.innerHTML = '<div class="blank"><b>Sem dados de visitas</b><p>Visitas não registradas no período selecionado.</p></div>';
    return;
  }
  const steps = [
    { label: 'Visitas', val: vis, pctVal: null, color: seriesColor(4), fmt: int },
    { label: 'Pedidos', val: ped, pctVal: vis ? ped / vis : null, color: seriesColor(0), fmt: int },
    { label: 'Pagos', val: pagos, pctVal: ped ? pagos / ped : null, color: seriesColor(1), fmt: int }
  ];
  const maxV = Math.max(...steps.map(s => s.val), 1);
  el.innerHTML = `<div class="funnel">
    ${steps.map((s, i) => `
      ${i > 0 ? `<div class="funnel-arrow">↓ <span style="color:${s.color};font-weight:700">${s.pctVal != null ? pct(s.pctVal, 1) : '—'}</span></div>` : ''}
      <div class="funnel-step">
        <div class="fbar" style="width:${(s.val / maxV * 100).toFixed(1)}%;background:${s.color}"></div>
        <div class="flabel" style="color:${s.color}">${s.label}</div>
        <div class="fval">${s.fmt(s.val)}</div>
        <div class="fpct">${s.pctVal != null ? pct(s.pctVal, 1) + ' conv.' : ''}</div>
      </div>`).join('')}
  </div>
  <div class="kv2" style="margin-top:12px;padding-top:10px;border-top:1px solid var(--line)">
    <span>Taxa geral visita→pago</span><b>${vis && pagos ? pct(pagos / vis, 2) : '—'}</b>
  </div>`;
}

function renderAlerts(days, prev, A, P, monthly) {

  const out = [];
  const active = monthly.map((a, m) => ({ m, a })).filter(o => o.a.rec > 0);
  if (active.length) {
    const best = active.reduce((x, o) => o.a.rec > x.a.rec ? o : x);
    out.push(['ok', '▲', `${MON_L[best.m]} foi o melhor mês`,
      `${brl(best.a.rec)} realizados, ${brl(best.a.recPaga)} pagos — ${pct(best.a.rec / (A.rec || 1))} de tudo que entrou no período.`]);
    if (active.length > 1) {
      const worst = active.reduce((x, o) => o.a.rec < x.a.rec ? o : x);
      out.push(['nu', '▼', `${MON_L[worst.m]} foi o mais fraco`,
        `${brl(worst.a.rec)}, ou ${pct(worst.a.rec / best.a.rec)} do melhor mês.`]);
    }
  }
  if (A.pctCancel != null) {
    const p = A.pctCancel;
    out.push([p > .10 ? 'bd' : p > .06 ? 'wr' : 'ok', p > .10 ? '!' : '≈', `Cancelamento em ${pct(p)} da receita`,
      p > .10 ? `São ${brl(A.cval)} que não viraram caixa. O próprio glossário da planilha manda investigar acima de 10%.`
              : `${brl(A.cval)} cancelados — faixa aceitável, mas a média esconde extremos por canal.`]);
  }
  const chs = CH_IDS.map(id => ({ id, a: agg(days, id) })).filter(o => o.a.rec > 20000);
  if (chs.length) {
    const w = chs.reduce((x, o) => (o.a.pctCancel || 0) > (x.a.pctCancel || 0) ? o : x);
    if (w.a.pctCancel > .08) out.push(['wr', '⚑', `${CH_LABEL[w.id]} concentra o cancelamento`,
      `${pct(w.a.pctCancel)} da receita do canal foi cancelada (${brl(w.a.cval)}), contra ${pct(A.pctCancel)} da média geral.`]);
  }
  if (prev.length) {
    const g = CH_IDS.map(id => ({ id, d: delta(agg(days, id).rec, agg(prev, id).rec), v: agg(days, id).rec }))
      .filter(o => o.d != null && o.v > 10000);
    if (g.length) {
      const up = g.reduce((x, o) => o.d > x.d ? o : x), dn = g.reduce((x, o) => o.d < x.d ? o : x);
      if (up.d > .05) out.push(['ok', '↗', `${CH_LABEL[up.id]} cresceu ${pct(up.d)}`, 'Melhor variação entre os canais vs. o período anterior.']);
      if (dn.d < -.05) out.push(['bd', '↘', `${CH_LABEL[dn.id]} caiu ${pct(Math.abs(dn.d))}`, 'Maior retração — investigue ruptura, preço ou queda de investimento.']);
    }
  }
  const dead = CH_IDS.filter(id => agg(ALL_DAYS, id).rec === 0);
  if (dead.length) out.push(['nu', '○', `${dead.length} canal(is) sem lançamento em 2026`,
    dead.map(id => CH_LABEL[id]).join(' · ') + '. Se estão ativos, os dados ainda não foram lançados.']);
  if (A.ads > 0) {
    const ok = A.tacos < .08;
    out.push([ok ? 'ok' : 'wr', '◈', `TACOS de ${pct(A.tacos, 2)}`, ok
      ? `${brl(A.ads)} investidos geraram ${mult(A.recPorAds)} de receita total. Dentro da referência de 5–8% do glossário.`
      : `${brl(A.ads)} de mídia sobre ${brl(A.rec)} de receita. Acima da faixa de 5–8% que o glossário indica para a categoria.`]);
  } else out.push(['nu', '○', 'Sem investimento em ADS no período', 'A receita registrada é orgânica, ou o investimento ainda não foi lançado.']);
  if (!A.meta) out.push(['wr', '◎', 'Metas ainda não definidas', 'Defina em Metas para destravar atingimento, GAP e projeção em todo o sistema.']);

  document.getElementById('alerts').innerHTML = out.map(([c, ic, t, d]) =>
    `<div class="item ${c}"><div class="ic">${ic}</div><div><b>${esc(t)}</b><p>${esc(d)}</p></div></div>`).join('');
}

function renderBestWorst(days, sc) {
  const rows = days.map(i => ({ i, a: agg([i], sc) })).filter(o => o.a.rec > 0);
  const el = document.getElementById('bestWorst');
  if (!rows.length) { el.innerHTML = '<div class="blank"><b>Sem dias com receita</b><p>Nenhum lançamento no recorte selecionado.</p></div>'; return; }
  const s = [...rows].sort((a, b) => b.a.recPaga - a.a.recPaga);
  const mx = Math.max(...s.map(o => o.a.recPaga), 1);
  const blk = (t, list, col) => `<div style="flex:1;min-width:200px">
    <div class="lab" style="margin-bottom:7px">${t}</div>
    ${list.map(o => `<div class="rrow" style="cursor:default;padding:5px 0">
      <span class="rn" style="width:104px;flex-basis:104px">${DAYS[o.i].long} <span class="z">${DOW_S[DAYS[o.i].dow]}</span></span>
      <span class="rt"><i style="width:${Math.max(1, o.a.recPaga / mx * 100).toFixed(1)}%;background:${col}"></i></span>
      <span class="rv" style="width:84px;flex-basis:84px">${brlK(o.a.recPaga)}</span></div>`).join('')}</div>`;
  const avg = rows.reduce((x, o) => x + o.a.recPaga, 0) / rows.length;
  el.innerHTML = `<div style="display:flex;gap:24px;flex-wrap:wrap">
      ${blk('5 melhores dias', s.slice(0, 5), cvar('--up'))}
      ${blk('5 dias mais fracos', s.slice(-5).reverse(), cvar('--down'))}</div>
    <div class="kv2" style="margin-top:14px;border-top:1px solid var(--line);padding-top:11px">
      <span>Média diária de receita paga · ${rows.length} dias com venda</span><b>${brl(avg)}</b></div>`;
}

/* ============================================================
   CANAIS
   ============================================================ */
const CH_METRICS = [
  { id: 'rec', lab: 'Receita', fmt: brl }, { id: 'recPaga', lab: 'Paga', fmt: brl },
  { id: 'ped', lab: 'Pedidos', fmt: int }, { id: 'cval', lab: 'Cancelado', fmt: brl },
  { id: 'ticketPago', lab: 'Ticket', fmt: brl }
];
function renderCanais() {
  const days = periodDays();
  document.getElementById('cmpScope').textContent = periodLabel() + ' · ' + days.length + ' dias';
  document.getElementById('chCompare').innerHTML = CH_IDS.map((id, i) =>
    `<button class="pill" data-ch="${id}" aria-pressed="${state.compare.includes(id)}">
      <i class="sw" style="background:${seriesColor(i)}"></i>${esc(CH_LABEL[id])}</button>`).join('');
  document.querySelectorAll('#chCompare .pill').forEach(b => b.onclick = () => {
    const id = b.dataset.ch;
    state.compare = state.compare.includes(id) ? state.compare.filter(x => x !== id) : [...state.compare, id];
    renderCanais();
  });
  document.getElementById('chMetricSeg').innerHTML = CH_METRICS.map(m =>
    `<button data-m="${m.id}" aria-pressed="${state.chMetric === m.id}">${m.lab}</button>`).join('');
  document.querySelectorAll('#chMetricSeg button').forEach(b => b.onclick = () => { state.chMetric = b.dataset.m; renderCanais(); });

  const M = CH_METRICS.find(m => m.id === state.chMetric);
  const sel = state.compare.length ? state.compare : CH_IDS.slice(0, 3);
  chart('cChannels', {
    type: 'line', labels: MON_S,
    series: sel.map(id => ({ name: CH_LABEL[id], color: seriesColor(CH_IDS.indexOf(id)), type: 'line', width: 2.1,
      data: MON_S.map((_, m) => aggMonth(m, id)[M.id]), fmt: M.fmt })),
    yFmt: M.id === 'ped' ? (v => int(v)) : axisK, tipTitle: k => MON_L[k], onPick: k => setPeriod('m' + k)
  });
  document.getElementById('lChannels').innerHTML = sel.map(id =>
    `<span><i style="background:${seriesColor(CH_IDS.indexOf(id))}"></i>${CH_LABEL[id]}</span>`).join('');

  /* --- radar chart --- */
  const radarCanvas = document.getElementById('cRadar');
  if (radarCanvas) {
    const activeIds = CH_IDS.filter(id => agg(days, id).rec > 0);
    if (activeIds.length >= 2) {
      const radarAxes = ['Receita', 'Pago%', 'Conversão', 'Ticket', 'ATG%'];
      const maxRec2 = Math.max(...activeIds.map(id => agg(days, id).rec), 1);
      const maxTk = Math.max(...activeIds.map(id => agg(days, id).ticketPago || 0), 1);
      const radarSeries = activeIds.slice(0, 5).map(id => {
        const a = agg(days, id);
        return {
          name: CH_LABEL[id],
          color: seriesColor(CH_IDS.indexOf(id)),
          data: [
            a.rec / maxRec2,
            a.rec ? 1 - (a.pctCancel || 0) : 0,
            Math.min(1, (a.conv || 0) * 20),
            (a.ticketPago || 0) / maxTk,
            Math.min(1.2, a.atg || 0)
          ]
        };
      });
      radar(radarCanvas, radarAxes, radarSeries);
      document.getElementById('lRadar').innerHTML = radarSeries.map(s =>
        `<span><i style="background:${s.color}"></i>${s.name}</span>`).join('');
    }
  }

  /* --- scatter: ticket vs volume --- */
  const scatterCanvas = document.getElementById('cScatter');
  if (scatterCanvas) {
    const scPoints = CH_IDS.filter(id => agg(days, id).rec > 0).map(id => {
      const a = agg(days, id);
      return { name: CH_LABEL[id], x: a.pedPagos || 0, y: a.ticketPago || 0,
               size: a.rec, color: seriesColor(CH_IDS.indexOf(id)), label: CH_LABEL[id].split(' — ')[0].split(' ')[0] };
    });
    scatter(scatterCanvas, scPoints, { xLabel: 'Pedidos pagos', yLabel: 'Ticket médio pago',
      xFmt: v => int(v), yFmt: v => brl(v) });
    document.getElementById('lScatter').innerHTML = scPoints.map(p =>
      `<span><i style="background:${p.color}"></i>${p.name}</span>`).join('');
  }

  const rows = CH_IDS.map(id => ({ id, a: agg(days, id) })).sort((a, b) => b.a.rec - a.a.rec);
  const T = agg(days, 'all');
  const maxRec = Math.max(...rows.map(r => r.a.rec), 1);
  const cols = [
    ['Receita', o => bar(o.a.rec, maxRec, brl(o.a.rec))], ['Share', o => pct(T.rec ? o.a.rec / T.rec : null)],
    ['Pedidos', o => int(o.a.ped)], ['Cancelado', o => brl(o.a.cval)],
    ['% canc.', o => o.a.pctCancel > .12 ? `<span class="dn">${pct(o.a.pctCancel)}</span>` : pct(o.a.pctCancel)],
    ['Receita paga', o => brl(o.a.recPaga)], ['Ticket pago', o => brl(o.a.ticketPago)],
    ['Inv. ADS', o => brl(o.a.ads)], ['TACOS', o => pct(o.a.tacos, 2)],
    ['Meta', o => brl(o.a.meta)], ['ATG%', o => pct(o.a.atg)]
  ];
  document.getElementById('tChannels').innerHTML =
    `<thead><tr><th>Canal</th>${cols.map(c => `<th>${c[0]}</th>`).join('')}</tr></thead><tbody>` +
    rows.map(o => `<tr data-ch="${o.id}" style="cursor:pointer" title="Filtrar por ${esc(CH_LABEL[o.id])}">
      <td>${esc(CH_LABEL[o.id])}</td>${cols.map(c => `<td class="${c[0] === 'Receita' ? 'mb' : ''}">${c[1](o)}</td>`).join('')}</tr>`).join('') +
    `<tr class="sum"><td>Total</td>${cols.map(c => `<td>${c[1]({ id: 'all', a: T })}</td>`).join('')}</tr></tbody>`;
  document.querySelectorAll('#tChannels tbody tr[data-ch]').forEach(tr => tr.onclick = () => setScope(tr.dataset.ch));

  const cid = state.scope === 'all' ? sel[0] : state.scope;
  document.getElementById('chDetailName').textContent = CH_LABEL[cid] + ' · use as pílulas de canal no topo para trocar';
  const R = [
    ['Receita realizada', m => brl(aggMonth(m, cid).rec), 1],
    ['Receita cancelada', m => brl(aggMonth(m, cid).cval)],
    ['Receita paga', m => brl(aggMonth(m, cid).recPaga), 1],
    ['Pedidos', m => int(aggMonth(m, cid).ped)],
    ['Pedidos cancelados', m => int(aggMonth(m, cid).cped)],
    ['% cancelamento', m => pct(aggMonth(m, cid).pctCancel)],
    ['Ticket médio pago', m => brl(aggMonth(m, cid).ticketPago)],
    ['Visitas', m => int(aggMonth(m, cid).vis)],
    ['Conversão', m => pct(aggMonth(m, cid).conv, 2)],
    ['Investimento ADS', m => brl(aggMonth(m, cid).ads)],
    ['TACOS', m => pct(aggMonth(m, cid).tacos, 2)],
    ['Receita ÷ ADS', m => mult(aggMonth(m, cid).recPorAds)],
    ['Meta', m => brl(aggMonth(m, cid).meta)],
    ['Atingimento', m => pct(aggMonth(m, cid).atg)]
  ];
  const Y = agg(ALL_DAYS, cid);
  const YV = [brl(Y.rec), brl(Y.cval), brl(Y.recPaga), int(Y.ped), int(Y.cped), pct(Y.pctCancel),
    brl(Y.ticketPago), int(Y.vis), pct(Y.conv, 2), brl(Y.ads), pct(Y.tacos, 2), mult(Y.recPorAds), brl(Y.meta), pct(Y.atg)];
  document.getElementById('tChannelDetail').innerHTML =
    `<thead><tr><th>Indicador</th>${MON_S.map(m => `<th>${m}</th>`).join('')}<th>Ano</th></tr></thead><tbody>` +
    R.map(([lab, f, key], i) => `<tr class="${key ? 'key' : ''}"><td>${lab}</td>${MON_S.map((_, m) => `<td>${f(m)}</td>`).join('')}<td>${YV[i]}</td></tr>`).join('') +
    '</tbody>';
}
function bar(v, mx, txt) {
  return `${txt}<span class="mbf" style="width:${Math.max(0, v / mx * 100).toFixed(1)}%"></span>`;
}

/* ============================================================
   ANUAL
   ============================================================ */
function renderAnual() {
  const sc = state.scope;
  document.getElementById('anualScope').textContent =
    (sc === 'all' ? 'Todos os canais' : CH_LABEL[sc]) + ' · valores em R$ salvo indicação';
  const M = Array.from({ length: 12 }, (_, m) => aggMonth(m, sc));
  const Y = agg(ALL_DAYS, sc);
  let a1 = 0, a2 = 0, a3 = 0;
  const accR = M.map(x => (a1 += x.rec)), accP = M.map(x => (a2 += x.recPaga)), accM = M.map(x => (a3 += x.meta));
  const mxRec = Math.max(...M.map(x => x.rec), 1);

  const R = [
    ['sec', 'Receita'],
    ['', 'Meta de receita', m => brl(M[m].meta), brl(Y.meta)],
    ['key', 'Receita realizada', m => bar(M[m].rec, mxRec, brl(M[m].rec)), brl(Y.rec), 'mb'],
    ['', 'Atingimento vs. meta', m => pct(M[m].atg), pct(Y.atg)],
    ['', 'GAP vs. meta', m => M[m].meta ? sgn(M[m].rec - M[m].meta) : '<span class="z">—</span>', Y.meta ? sgn(Y.rec - Y.meta) : '<span class="z">—</span>'],
    ['', 'Receita acumulada', m => brl(accR[m]), brl(Y.rec)],
    ['', 'Meta acumulada', m => accM[m] ? brl(accM[m]) : '<span class="z">—</span>', brl(Y.meta)],
    ['sec', 'Cancelamento e receita paga'],
    ['', 'Receita cancelada', m => brl(M[m].cval), brl(Y.cval)],
    ['', '% cancelamento', m => M[m].pctCancel > .12 ? `<span class="dn">${pct(M[m].pctCancel)}</span>` : pct(M[m].pctCancel), pct(Y.pctCancel)],
    ['key', 'Receita paga', m => brl(M[m].recPaga), brl(Y.recPaga)],
    ['', 'Receita paga acumulada', m => brl(accP[m]), brl(Y.recPaga)],
    ['sec', 'Volume e conversão'],
    ['', 'Visitas', m => int(M[m].vis), int(Y.vis)],
    ['', 'Pedidos', m => int(M[m].ped), int(Y.ped)],
    ['', 'Pedidos cancelados', m => int(M[m].cped), int(Y.cped)],
    ['', 'Pedidos pagos', m => int(M[m].pedPagos), int(Y.pedPagos)],
    ['', 'Taxa de conversão', m => pct(M[m].conv, 2), pct(Y.conv, 2)],
    ['', 'Ticket médio bruto', m => brl(M[m].ticket), brl(Y.ticket)],
    ['', 'Ticket médio pago', m => brl(M[m].ticketPago), brl(Y.ticketPago)],
    ['sec', 'Mídia paga'],
    ['', 'Investimento ADS', m => brl(M[m].ads), brl(Y.ads)],
    ['', 'TACOS', m => pct(M[m].tacos, 2), pct(Y.tacos, 2)],
    ['', 'Receita ÷ ADS', m => mult(M[m].recPorAds), mult(Y.recPorAds)],
    ['sec', 'Receita por canal'],
    ...CH_IDS.map(id => ['', CH_LABEL[id], m => brl(aggMonth(m, id).rec), brl(agg(ALL_DAYS, id).rec)]),
    ['sec', 'Share por canal'],
    ...CH_IDS.map(id => ['', CH_LABEL[id], m => pct(M[m].rec ? aggMonth(m, id).rec / M[m].rec : null),
      pct(Y.rec ? agg(ALL_DAYS, id).rec / Y.rec : null)])
  ];
  document.getElementById('tAnual').innerHTML =
    `<thead><tr><th>Indicador</th>${MON_S.map((m, i) => `<th${i === LAST_MONTH ? ' style="color:var(--brand)"' : ''}>${m}</th>`).join('')}<th>Ano</th></tr></thead><tbody>` +
    R.map(r => r[0] === 'sec'
      ? `<tr class="sec"><td colspan="14">${r[1]}</td></tr>`
      : `<tr class="${r[0]}"><td>${r[1]}</td>${MON_S.map((_, m) => `<td class="${r[4] || ''}">${r[2](m)}</td>`).join('')}<td>${r[3]}</td></tr>`
    ).join('') + '</tbody>';
}
function sgn(v) { return `<span class="${v >= 0 ? 'up' : 'dn'}">${v >= 0 ? '+' : ''}${brl(v)}</span>`; }
