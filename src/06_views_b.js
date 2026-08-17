/* ============================================================
   SEMANAL
   ============================================================ */
const SEM_METRICS = [
  { id: 'rec', lab: 'Receita', fmt: brl }, { id: 'recPaga', lab: 'Receita paga', fmt: brl },
  { id: 'cval', lab: 'Cancelado', fmt: brl }, { id: 'ped', lab: 'Pedidos', fmt: int }
];
function renderSemanal() {
  const sc = state.scope;
  document.getElementById('semScope').textContent = '· ' + (sc === 'all' ? 'todos os canais' : CH_LABEL[sc]);
  document.getElementById('semSeg').innerHTML = SEM_METRICS.map(m =>
    `<button data-m="${m.id}" aria-pressed="${state.semMetric === m.id}">${m.lab}</button>`).join('');
  document.querySelectorAll('#semSeg button').forEach(b => b.onclick = () => { state.semMetric = b.dataset.m; renderSemanal(); });
  const M = SEM_METRICS.find(m => m.id === state.semMetric);

  const W = WEEKS.map(w => ({ w, a: agg(w.days, sc) }));
  const lastIdx = W.reduce((k, o, i) => o.a.rec > 0 ? i : k, 0);
  chart('cWeekly', {
    type: 'bar', labels: W.map(o => o.w.label), maxXTicks: 18,
    series: [
      { name: M.lab, data: W.map(o => o.a[M.id]), color: seriesColor(0), type: 'bar', fmt: M.fmt },
      { name: 'Média móvel 4 sem.', data: W.map((o, i) => { const s = W.slice(Math.max(0, i - 3), i + 1); return s.reduce((x, y) => x + y.a[M.id], 0) / s.length; }), color: seriesColor(3), type: 'line', width: 1.8, fmt: M.fmt }
    ],
    yFmt: M.id === 'ped' ? (v => int(v)) : axisK,
    tipTitle: k => `Semana ${W[k].w.n} · ${W[k].w.range}`
  });

  const indicators = [
    { id: 'recPaga', name: 'Receita Realizada', fmt: brl, fmtKey: 'brl', inv: false },
    { id: 'vis', name: 'Visitas', fmt: v => v ? int(v) : '<span class="z">—</span>', fmtKey: 'int', inv: false },
    { id: 'conv', name: 'Taxa de Conversão', fmt: v => pct(v, 2), fmtKey: 'pct2', inv: false },
    { id: 'ped', name: 'Pedidos', fmt: v => v ? int(v) : '<span class="z">—</span>', fmtKey: 'int', inv: false },
    { id: 'ticketPago', name: 'Ticket Médio', fmt: brl, fmtKey: 'brl', inv: false },
    { id: 'ads', name: 'Invest. ADS (R$)', fmt: brl, fmtKey: 'brl', inv: true },
    { id: 'recPorAds', name: 'ROAS', fmt: v => v ? v.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + '×' : '<span class="z">—</span>', fmtKey: 'mult', inv: false },
    { id: 'acos', name: 'ACOS', fmt: () => '<span class="z">—</span>' },
    { id: 'tacos', name: 'TACOS', fmt: v => pct(v, 1), fmtKey: 'pct1', inv: true },
    { type: 'wow', ref: 'recPaga', name: 'Var. Receita WoW', inv: false },
    { type: 'wow', ref: 'ped', name: 'Var. Pedidos WoW', inv: false },
    { type: 'wow', ref: 'ads', name: 'Comp ADS', inv: true },
    { type: 'wow', ref: 'vis', name: 'Comp Visitas', inv: false },
    { type: 'sep', name: 'RECEITA POR CANAL' },
    ...CH.map(c => ({ type: 'chan', chId: c.id, name: c.label, fmt: brl, fmtKey: 'brl', inv: false })),
    { type: 'sep', name: 'CANCELAMENTO' },
    { id: 'cval', name: 'Cancelamento (R$)', fmt: brl, fmtKey: 'brl', inv: true },
    { id: 'pctCancel', name: '% Cancelamento', fmt: v => pct(v, 1), fmtKey: 'pct1', inv: true },
    { id: 'cped', name: 'Pedidos Cancelados', fmt: v => v ? int(v) : '<span class="z">—</span>', fmtKey: 'int', inv: true },
    { id: 'rec', name: 'Vendas Brutas (R$)', fmt: brl, fmtKey: 'brl', inv: false }
  ];

  let head = '<thead><tr><th>Indicador</th>' + W.map(o => `<th title="${o.w.range} \u00b7 ${o.w.mon}">${o.w.label}</th>`).join('') + '</tr></thead>';
  
  let tbody = '<tbody>' + indicators.map(ind => {
    return `<tr${ind.type === 'sep' ? ' class="sum"' : ''}><td${ind.type === 'sep' ? ' style="font-weight:800;color:var(--ink)"' : ''}>${esc(ind.name)}</td>` + W.map((o, i) => {
      let v, prevV;
      if (ind.type === 'sep') return `<td></td>`;
      else if (ind.type === 'wow') {
        const curRef = o.a[ind.ref];
        const prevRef = i > 0 ? W[i-1].a[ind.ref] : null;
        v = delta(curRef, prevRef);
        prevV = null;
      } else if (ind.type === 'chan') {
        const curA = agg(o.w.days, ind.chId);
        v = curA.rec;
        const prevA = i > 0 ? agg(W[i-1].w.days, ind.chId) : null;
        prevV = prevA ? prevA.rec : null;
      } else if (ind.id === 'acos') {
        v = null; prevV = null;
      } else {
        v = o.a[ind.id];
        prevV = i > 0 ? W[i-1].a[ind.id] : null;
      }

      let tdHtml = `<td class="sem-cell"`;
      if (ind.type !== 'wow' && ind.id !== 'acos' && ind.type !== 'sep') {
        tdHtml += ` data-lbl="${esc(ind.name)}" data-w="${o.w.label}" data-range="${o.w.range}"`;
        if (v != null && v !== 0) {
          tdHtml += ` data-val="${v}"`;
          if (prevV != null && prevV !== 0) {
            const wdiff = delta(v, prevV);
            if (wdiff != null) {
              tdHtml += ` data-prev="${prevV}" data-wdiff="${wdiff}" data-inv="${ind.inv ? 1 : 0}" data-fmt="${ind.fmtKey || ind.id}"`;
            }
          }
        }
      }

      let valStr;
      if (ind.type === 'wow') {
        if (v == null) valStr = '<span class="z">—</span>';
        else {
          const good = ind.inv ? v < 0 : v > 0;
          const cCls = Math.abs(v) < 0.0001 ? 'z' : (good ? 'up' : 'dn');
          valStr = `<span style="font-weight:600" class="${cCls}">${v > 0 ? '+' : ''}${pct(v, 1)}</span>`;
        }
      } else if (ind.id === 'acos') {
        valStr = '<span class="z">—</span>';
      } else {
        valStr = (v == null || v === 0 && ind.id !== 'pctCancel') ? '<span class="z">—</span>' : ind.fmt(v);
      }
      tdHtml += `>${valStr}</td>`;
      return tdHtml;
    }).join('') + '</tr>';
  }).join('') + '</tbody>';

  document.getElementById('tWeekly').innerHTML = head + tbody;

  document.querySelectorAll('#tWeekly .sem-cell').forEach(td => {
    td.onclick = ev => {
      const wdiff = td.dataset.wdiff;
      if (!wdiff) return;
      const v = +td.dataset.val, p = +td.dataset.prev, wd = +wdiff, inv = td.dataset.inv === '1';
      const isUp = wd >= 0;
      let colorCls = isUp ? (inv ? 'dn' : 'up') : (inv ? 'up' : 'dn');
      let arr = isUp ? '▲' : '▼';
      if (wd === 0) { colorCls = 'z'; arr = '—'; }
      
      const fmap = { brl, int, pct: pct, pct1: v => pct(v, 1), pct2: v => pct(v, 2), mult };
      const fmtFnc = fmap[td.dataset.fmt] || brl;
      
      tipEl.innerHTML = `<div class="tt">${td.dataset.lbl} · ${td.dataset.w}</div>
        <div style="font-size:10.5px;color:var(--ink-3);margin-bottom:6px">${td.dataset.range}</div>
        <div class="tr"><span>Semana atual</span><b>${fmtFnc(v)}</b></div>
        <div class="tr"><span>Semana anterior</span><b>${fmtFnc(p)}</b></div>
        <div class="tr" style="margin-top:6px;padding-top:6px;border-top:1px solid var(--line)">
          <span>WoW</span><b class="${colorCls}">${arr} ${Math.abs(wd * 100).toLocaleString('pt-BR', {maximumFractionDigits:1})}%</b>
        </div>`;
      tipEl.style.opacity = '1';
      const tw = tipEl.offsetWidth;
      tipEl.style.left = Math.max(tw/2+6, Math.min(document.documentElement.clientWidth-tw/2-6, ev.clientX)) + 'px';
      tipEl.style.top = ev.clientY + 'px';
    };
    td.onmouseleave = hideTip;
  });
}

/* ============================================================
   COMPARATIVOS
   ============================================================ */
const CMP_METRICS = [
  { id: 'rec', lab: 'Receita', fmt: brlK, fmtFull: brl }, { id: 'recPaga', lab: 'Receita paga', fmt: brlK, fmtFull: brl },
  { id: 'ped', lab: 'Pedidos', fmt: int, fmtFull: int }, { id: 'cval', lab: 'Valor cancelado', fmt: brlK, fmtFull: brl },
  { id: 'pctCancel', lab: '% cancelamento', fmt: v => pct(v, 1), fmtFull: v => pct(v, 1) },
  { id: 'ticketPago', lab: 'Ticket médio pago', fmt: v => brl(v), fmtFull: v => brl(v) },
  { id: 'vis', lab: 'Visitas', fmt: int, fmtFull: int },
  { id: 'tacos', lab: 'TACOS', fmt: v => pct(v, 1), fmtFull: v => pct(v, 1) }
];
function heatCell(v, mn, mx, fmt, invert, rank, total, prevMonthVal) {
  if (v == null || !isFinite(v) || v === 0) return `<td class="z">—</td>`;
  let t = mx === mn ? .5 : (v - mn) / (mx - mn);
  if (invert) t = 1 - t;
  const a = (0.07 + t * 0.55).toFixed(3);
  let cls = 'hc';
  if (rank === 0) cls += ' hc-best';
  else if (rank === total - 1) cls += ' hc-worst';
  let attrs = ` data-val="${v}"`;
  if (prevMonthVal != null && prevMonthVal !== 0) {
    const d = (v - prevMonthVal) / Math.abs(prevMonthVal);
    attrs += ` data-prev="${prevMonthVal}" data-d="${d}"`;
  }
  if (rank != null) attrs += ` data-rank="${rank + 1}" data-of="${total}"`;
  return `<td class="${cls}" style="background:color-mix(in srgb, var(--brand) ${(a * 100).toFixed(0)}%, transparent); color: ${t > 0.4 ? '#fff' : 'var(--ink)'}; text-shadow: ${t > 0.4 ? '0 1px 2px rgba(0,0,0,0.4)' : 'none'}"${attrs}>${fmt(v)}</td>`;
}
function renderComparativos() {
  const sc = state.scope;
  const pDays = periodDays();
  const pDaysSet = new Set(pDays);
  const validDays = pDays.map(i => DAYS[i]);

  const sel = document.getElementById('cmpMetric');
  if (!sel.options.length) sel.innerHTML = CMP_METRICS.map(m => `<option value="${m.id}">${m.lab}</option>`).join('');
  sel.value = state.cmpMetric;
  sel.onchange = () => { state.cmpMetric = sel.value; renderComparativos(); };
  const M = CMP_METRICS.find(m => m.id === state.cmpMetric);
  const inv = M.id === 'pctCancel' || M.id === 'cval';

  /* ── S1: KPI cards por dia da semana ── */
  const dowAgg = DOW_S.map((_, dw) => {
    const dayIdxs = validDays.filter(d => d.dow === dw).map(d => d.i);
    const a = agg(dayIdxs, sc);
    const nWeeks = dayIdxs.length;
    return { dw, total: a[M.id], avg: nWeeks ? a[M.id] / nWeeks : 0, count: nWeeks };
  });
  const avgs = dowAgg.map(d => d.avg).filter(v => v != null && isFinite(v) && v !== 0);
  const maxAvg = Math.max(...avgs, 0);
  const bestDow = dowAgg.reduce((b, d) => (inv ? (d.avg < b.avg && d.avg > 0) : (d.avg > b.avg)) ? d : b, dowAgg[0]);
  const worstDow = dowAgg.reduce((w, d) => (inv ? (d.avg > w.avg) : (d.avg < w.avg && d.avg > 0)) ? d : w, dowAgg[0]);

  document.getElementById('cmpCards').innerHTML = dowAgg.map(d => {
    const pctBar = maxAvg ? (d.avg / maxAvg * 100).toFixed(1) : 0;
    let badge = '';
    if (d.dw === bestDow.dw) badge = '<div class="cmp-badge best">Melhor</div>';
    else if (d.dw === worstDow.dw) badge = '<div class="cmp-badge worst">Pior</div>';
    return `<div class="cmp-card">
      ${badge}
      <div class="cmp-dow">${DOW_L[d.dw]}</div>
      <div class="cmp-val">${M.fmt(d.avg)}</div>
      <div class="cmp-sub">média por ${DOW_S[d.dw]} · ${d.count} dias</div>
      <div class="cmp-bar-wrap"><div class="cmp-bar-fill" style="width:${pctBar}%"></div></div>
    </div>`;
  }).join('');

  /* ── S2: Gráfico de barras agrupadas ── */
  const activeMonths = MON_S.map((_, m) => m).filter(m => MONTH_DAYS[m].some(i => i <= LAST_ACTIVE && pDaysSet.has(i)));
  const series = activeMonths.map((m, si) => ({
    name: MON_S[m],
    data: DOW_S.map((_, dw) => {
      const d = MONTH_DAYS[m].filter(i => DAYS[i].dow === dw && pDaysSet.has(i));
      return d.length ? agg(d, sc)[M.id] : 0;
    }),
    color: seriesColor(si),
    type: 'bar',
    fmt: M.fmtFull || M.fmt
  }));
  chart('cCmpBars', {
    type: 'bar', labels: DOW_S,
    series,
    yFmt: M.id === 'ped' || M.id === 'vis' ? (v => int(v)) : (M.id === 'pctCancel' || M.id === 'tacos' ? (v => pct(v, 1)) : axisK),
    tipTitle: k => DOW_L[k]
  });

  /* ── S3: Heatmap melhorado ── */
  const cellsA = DOW_S.map((_, dw) => MON_S.map((_, m) => {
    const d = MONTH_DAYS[m].filter(i => DAYS[i].dow === dw && pDaysSet.has(i));
    return d.length ? agg(d, sc)[M.id] : null;
  }));
  const yearRow = DOW_S.map((_, dw) => agg(validDays.filter(d => d.dow === dw).map(d => d.i), sc)[M.id]);
  let head = `<thead><tr><th>Dia</th>${MON_S.map(m => `<th>${m}</th>`).join('')}<th>Ano</th></tr></thead>`;
  let body = '<tbody>' + DOW_S.map((dw, i) => {
    const validVals = cellsA[i].map((v, m) => ({ v, m })).filter(o => o.v != null && isFinite(o.v) && o.v !== 0);
    const sorted = [...validVals].sort((a, b) => inv ? (a.v - b.v) : (b.v - a.v));
    const mn = Math.min(...validVals.map(o => o.v), Infinity), mx = Math.max(...validVals.map(o => o.v), -Infinity);
    return `<tr><td>${DOW_L[i]}</td>${cellsA[i].map((v, m) => {
      const rankIdx = sorted.findIndex(o => o.m === m);
      const prevVal = m > 0 ? cellsA[i][m - 1] : null;
      return heatCell(v, mn, mx, M.fmt, inv, rankIdx >= 0 ? rankIdx : null, sorted.length, prevVal);
    }).join('')}<td style="font-weight:700">${yearRow[i] ? M.fmt(yearRow[i]) : '—'}</td></tr>`;
  }).join('');
  const totRow = MON_S.map((_, m) => agg(MONTH_DAYS[m].filter(i => pDaysSet.has(i)), sc)[M.id]);
  body += `<tr class="sum"><td>Todos os dias</td>${totRow.map(v => `<td>${v ? M.fmt(v) : '—'}</td>`).join('')}<td>${M.fmt(agg(pDays, sc)[M.id])}</td></tr></tbody>`;
  document.getElementById('tDow').innerHTML = head + body;

  /* heatmap tooltips */
  document.querySelectorAll('#tDow td.hc').forEach(td => {
    td.onclick = ev => {
      const v = +td.dataset.val;
      let lines = `<div class="tr"><span>Valor</span><b>${(M.fmtFull || M.fmt)(v)}</b></div>`;
      if (td.dataset.rank) lines += `<div class="tr"><span>Ranking</span><b>${td.dataset.rank}º de ${td.dataset.of}</b></div>`;
      if (td.dataset.d) {
        const d = +td.dataset.d;
        const good = inv ? d < 0 : d > 0;
        const cCls = Math.abs(d) < 0.005 ? 'z' : (good ? 'up' : 'dn');
        lines += `<div class="tr" style="margin-top:4px;padding-top:4px;border-top:1px solid var(--line)"><span>vs. mês anterior</span><b class="${cCls}">${d > 0 ? '+' : ''}${pct(d, 1)}</b></div>`;
      }
      tipEl.innerHTML = `<div class="tt">${M.lab}</div>${lines}`;
      tipEl.style.opacity = '1';
      const tw = tipEl.offsetWidth;
      tipEl.style.left = Math.max(tw/2+6, Math.min(document.documentElement.clientWidth-tw/2-6, ev.clientX)) + 'px';
      tipEl.style.top = ev.clientY + 'px';
    };
    td.onmouseleave = hideTip;
  });

  /* ── S4: Insights 1ª vs última semana + ocorrências ── */
  const firstOcc = DOW_S.map((_, dw) => {
    const days = validDays.filter(d => d.dow === dw && d.occ === 1).map(d => d.i);
    return days.length ? agg(days, sc)[M.id] : 0;
  });
  const lastOccMap = DOW_S.map((_, dw) => {
    const maxOcc = Math.max(...DAYS.filter(d => d.dow === dw).map(d => d.occ), 0);
    const days = validDays.filter(d => d.dow === dw && d.occ === maxOcc).map(d => d.i);
    return days.length ? agg(days, sc)[M.id] : 0;
  });
  const avgFirst = firstOcc.reduce((s, v) => s + v, 0) / firstOcc.filter(v => v).length || 0;
  const avgLast = lastOccMap.reduce((s, v) => s + v, 0) / lastOccMap.filter(v => v).length || 0;
  const diffFL = avgLast ? delta(avgFirst, avgLast) : null;
  const diffGood = diffFL != null ? (inv ? diffFL < 0 : diffFL > 0) : false;

  document.getElementById('cmpInsights').innerHTML = `
    <div class="cmp-insight">
      <div class="ci-label">1ª ocorrência do mês (média)</div>
      <div class="ci-val">${M.fmt(avgFirst)}</div>
      <div class="ci-sub">Média de ${M.lab.toLowerCase()} na 1ª ${DOW_S[0]}–${DOW_S[6]} de cada mês</div>
    </div>
    <div class="cmp-insight">
      <div class="ci-label">Última ocorrência do mês (média)</div>
      <div class="ci-val">${M.fmt(avgLast)}</div>
      <div class="ci-sub">${diffFL != null ? `<span class="${diffGood ? 'up' : 'dn'}" style="font-weight:600">${diffFL > 0 ? '▲ +' : '▼ '}${pct(Math.abs(diffFL), 1)}</span> vs. primeira ocorrência` : ''}</div>
    </div>`;

  /* collapse toggle */
  const togBtn = document.getElementById('cmpToggleOcc');
  const occWrap = document.getElementById('cmpOccWrap');
  togBtn.onclick = () => {
    const open = occWrap.classList.toggle('show');
    togBtn.classList.toggle('open', open);
    const textNodes = Array.from(togBtn.childNodes).filter(n => n.nodeType === 3);
    if (textNodes.length) textNodes[textNodes.length - 1].textContent = open ? ' Ocultar tabela de ocorrências' : ' Ver tabela completa de ocorrências';
  };

  /* tabela de ocorrências (gerada mas oculta por padrão) */
  const rows = [];
  DOW_S.forEach((dw, i) => {
    for (let occ = 1; occ <= 5; occ++) {
      const vals = MON_S.map((_, m) => {
        const d = MONTH_DAYS[m].filter(k => DAYS[k].dow === i && DAYS[k].occ === occ && pDaysSet.has(k));
        return d.length ? agg(d, sc)[M.id] : null;
      });
      if (vals.every(v => v == null)) continue;
      rows.push({ dw: i, occ, vals });
    }
  });
  const flat = rows.flatMap(r => r.vals).filter(v => v != null && isFinite(v) && v !== 0);
  const gmn = Math.min(...flat), gmx = Math.max(...flat);
  document.getElementById('tDowWeek').innerHTML =
    `<thead><tr><th>Dia</th><th>Ocorr.</th>${MON_S.map(m => `<th>${m}</th>`).join('')}</tr></thead><tbody>` +
    rows.map((r, k) => `<tr${(k && rows[k - 1].dw !== r.dw) ? ' style="border-top:2px solid var(--line-2)"' : ''}>
      <td>${r.occ === 1 ? DOW_L[r.dw] : ''}</td><td style="font-family:var(--f-num);text-align:left;color:var(--ink-3)">${r.occ}ª</td>
      ${r.vals.map(v => {
        if (v == null || !isFinite(v) || v === 0) return `<td class="z">—</td>`;
        let t = gmx === gmn ? .5 : (v - gmn) / (gmx - gmn);
        if (inv) t = 1 - t;
        const a = (0.07 + t * 0.55).toFixed(3);
        return `<td class="hc" style="background:color-mix(in srgb, var(--brand) ${(a * 100).toFixed(0)}%, transparent)" data-val="${v}">${M.fmt(v)}</td>`;
      }).join('')}</tr>`).join('') + '</tbody>';

  /* tooltips na tabela de ocorrências */
  document.querySelectorAll('#tDowWeek td.hc').forEach(td => {
    td.onclick = ev => {
      tipEl.innerHTML = `<div class="tt">${M.lab}</div><div class="tr"><span>Valor</span><b>${(M.fmtFull || M.fmt)(+td.dataset.val)}</b></div>`;
      tipEl.style.opacity = '1';
      const tw = tipEl.offsetWidth;
      tipEl.style.left = Math.max(tw/2+6, Math.min(document.documentElement.clientWidth-tw/2-6, ev.clientX)) + 'px';
      tipEl.style.top = ev.clientY + 'px';
    };
    td.onmouseleave = hideTip;
  });
}

/* ============================================================
   LANÇAMENTOS (grade editável)
   ============================================================ */
const ENTRY_COLS = [
  { f: F.VIS, lab: 'Visitas', kind: 'int' },
  { f: F.REC, lab: 'Receita (R$)', kind: 'money' },
  { f: F.PED, lab: 'Pedidos', kind: 'int' },
  { f: F.ADS, lab: 'Inv. ADS (R$)', kind: 'money' },
  { f: F.CPED, lab: 'Ped. cancelados', kind: 'int' },
  { f: F.CVAL, lab: 'Valor cancelado (R$)', kind: 'money' }
];
function renderLancamentos() {
  const ms = document.getElementById('lanMonth'), cs = document.getElementById('lanChannel');
  if (!ms.options.length) {
    ms.innerHTML = MON_L.map((m, i) => `<option value="${i}">${m} 2026</option>`).join('');
    cs.innerHTML = CH_IDS.map(id => `<option value="${id}">${esc(CH_LABEL[id])}</option>`).join('');
    ms.onchange = () => { state.lanMonth = +ms.value; renderLancamentos(); };
    cs.onchange = () => { state.lanChannel = cs.value; renderLancamentos(); };
    document.getElementById('lanReset').onclick = resetMonthEdits;
  }
  ms.value = state.lanMonth; cs.value = state.lanChannel;
  const cid = state.lanChannel, days = MONTH_DAYS[state.lanMonth];
  const chDef = CH.find(c => c.id === cid);
  const cols = ENTRY_COLS.filter(c => chDef.full || (c.f !== F.VIS && c.f !== F.ADS));

  const head = `<thead><tr><th>Data</th><th>Dia</th>${cols.map(c => `<th>${c.lab}</th>`).join('')}
    <th>Receita paga</th><th>Ticket pago</th></tr></thead>`;
  const body = '<tbody>' + days.map(i => {
    const d = DAYS[i];
    const rec = cell(cid, i, F.REC), cval = cell(cid, i, F.CVAL), ped = cell(cid, i, F.PED), cped = cell(cid, i, F.CPED);
    const paga = rec - cval, pp = ped - cped;
    return `<tr>
      <td>${d.d}/${String(d.m + 1).padStart(2, '0')}</td>
      <td class="${d.dow > 4 ? 'wknd' : ''}" style="font-family:var(--f-num);text-align:left">${DOW_S[d.dow]}</td>
      ${cols.map(c => `<td class="ed ${isEdited(cid, i, c.f) ? 'mod' : ''}" data-i="${i}" data-f="${c.f}">
         <input inputmode="decimal" value="${fmtEdit(cell(cid, i, c.f), c.kind)}" data-i="${i}" data-f="${c.f}" data-kind="${c.kind}"></td>`).join('')}
      <td class="${paga < 0 ? 'dn' : ''}">${paga ? brl(paga) : '<span class="z">—</span>'}</td>
      <td>${pp > 0 ? brl(paga / pp) : '<span class="z">—</span>'}</td></tr>`;
  }).join('');
  const A = agg(days, cid);
  const foot = `<tr class="sum"><td>Total</td><td>${days.length}d</td>` +
    cols.map(c => `<td>${c.kind === 'money' ? brl(A[['vis', 'rec', 'ped', 'ads', 'cped', 'cval'][c.f]]) : int(A[['vis', 'rec', 'ped', 'ads', 'cped', 'cval'][c.f]])}</td>`).join('') +
    `<td>${brl(A.recPaga)}</td><td>${brl(A.ticketPago)}</td></tr></tbody>`;
  document.getElementById('tEntry').innerHTML = head + body + foot;

  document.querySelectorAll('#tEntry input').forEach(inp => {
    inp.onfocus = () => inp.select();
    inp.onkeydown = e => {
      if (e.key === 'Enter') { e.preventDefault(); moveCell(inp, 1, 0); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); moveCell(inp, 1, 0); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); moveCell(inp, -1, 0); }
    };
    inp.onchange = () => commitCell(inp);
    inp.onblur = () => commitCell(inp);
  });
  const n = Object.keys(store.edits).filter(k => k.startsWith(cid + '|')).length;
  document.getElementById('lanHint').textContent = n
    ? `${n} dia(s) deste canal com valores alterados — marcados com a barra âmbar.`
    : 'Edite qualquer célula. As alterações são salvas neste navegador automaticamente.';
}
function fmtEdit(v, kind) {
  if (!v) return '';
  return kind === 'money' ? v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : String(Math.round(v));
}
function parseNum(s) {
  if (s == null) return 0;
  s = String(s).trim().replace(/[R$\s]/g, '');
  if (!s) return 0;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  const v = parseFloat(s);
  return isFinite(v) ? v : 0;
}
function commitCell(inp) {
  const i = +inp.dataset.i, f = +inp.dataset.f, cid = state.lanChannel;
  const v = Math.round(parseNum(inp.value) * 100) / 100;
  if (v === cell(cid, i, f)) return;
  setCell(cid, i, f, v);
  renderLancamentos();
  renderFootStamp();
  const next = document.querySelector(`#tEntry input[data-i="${i}"][data-f="${f}"]`);
  if (next && document.activeElement !== next) { /* re-render perdeu foco: ok */ }
}
function moveCell(inp, dr) {
  const i = +inp.dataset.i, f = +inp.dataset.f;
  commitCell(inp);
  const t = document.querySelector(`#tEntry input[data-i="${i + dr}"][data-f="${f}"]`);
  if (t) { t.focus(); t.select(); }
}
function resetMonthEdits() {
  const cid = state.lanChannel;
  const keys = MONTH_DAYS[state.lanMonth].map(i => cid + '|' + i).filter(k => store.edits[k]);
  if (!keys.length) { toast('Nenhuma alteração neste mês.'); return; }
  confirmBox('Descartar alterações?', `${keys.length} dia(s) de ${CH_LABEL[cid]} em ${MON_L[state.lanMonth]} voltarão aos valores originais da planilha.`, () => {
    keys.forEach(k => delete store.edits[k]);
    saveStore(); renderLancamentos(); renderFootStamp(); toast('Valores originais restaurados.');
  });
}

/* ============================================================
   METAS
   ============================================================ */
function renderMetas() {
  const inp = document.getElementById('metaAnual');
  inp.value = store.metaAnual ? store.metaAnual.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '';
  inp.onchange = () => { store.metaAnual = parseNum(inp.value); saveStore(); renderMetas(); };
  document.getElementById('metaSpread').onclick = () => spreadMeta(false);
  document.getElementById('metaSeason').onclick = () => spreadMeta(true);
  document.getElementById('metaClear').onclick = () => confirmBox('Zerar todas as metas?', 'Os valores mensais por canal voltarão a zero.', () => {
    CH_IDS.forEach(id => store.metas[id] = Array(12).fill(0));
    store.metaAnual = 0; saveStore(); renderMetas(); toast('Metas zeradas.');
  });

  const totByMonth = m => CH_IDS.reduce((s, id) => s + (store.metas[id][m] || 0), 0);
  const head = `<thead><tr><th>Canal</th>${MON_S.map(m => `<th>${m}</th>`).join('')}<th>Total</th><th>Real 2026</th></tr></thead>`;
  const body = '<tbody>' + CH_IDS.map(id => {
    const real = agg(ALL_DAYS, id).rec;
    const tot = store.metas[id].reduce((a, b) => a + b, 0);
    return `<tr><td>${esc(CH_LABEL[id])}</td>` +
      MON_S.map((_, m) => `<td class="ed"><input inputmode="decimal" data-meta="${id}" data-m="${m}" value="${store.metas[id][m] ? store.metas[id][m].toLocaleString('pt-BR', { maximumFractionDigits: 0 }) : ''}"></td>`).join('') +
      `<td style="font-weight:700">${tot ? brl(tot) : '<span class="z">—</span>'}</td><td class="z">${brl(real)}</td></tr>`;
  }).join('') +
    `<tr class="sum"><td>Total</td>${MON_S.map((_, m) => `<td>${totByMonth(m) ? brl(totByMonth(m)) : '—'}</td>`).join('')}
     <td>${brl(MON_S.reduce((s, _, m) => s + totByMonth(m), 0))}</td><td>${brl(agg(ALL_DAYS, 'all').rec)}</td></tr></tbody>`;
  document.getElementById('tMetas').innerHTML = head + body;
  document.querySelectorAll('#tMetas input').forEach(el => {
    el.onfocus = () => el.select();
    el.onchange = () => {
      store.metas[el.dataset.meta][+el.dataset.m] = parseNum(el.value);
      saveStore(); renderMetas();
    };
  });
}
function spreadMeta(seasonal) {
  const total = store.metaAnual;
  if (!total) { toast('Informe primeiro a meta anual.'); return; }
  const realByCh = CH_IDS.map(id => agg(ALL_DAYS, id).rec);
  const grand = realByCh.reduce((a, b) => a + b, 0);
  if (!grand) { toast('Sem histórico de receita para distribuir.'); return; }
  CH_IDS.forEach((id, ci) => {
    const chShare = realByCh[ci] / grand;
    const chTotal = total * chShare;
    if (seasonal) {
      const mv = MON_S.map((_, m) => aggMonth(m, id).rec);
      const s = mv.reduce((a, b) => a + b, 0);
      store.metas[id] = s ? mv.map(v => Math.round(chTotal * v / s)) : Array(12).fill(Math.round(chTotal / 12));
    } else {
      store.metas[id] = Array(12).fill(Math.round(chTotal / 12));
    }
  });
  saveStore(); renderMetas();
  toast(seasonal ? 'Metas distribuídas pela sazonalidade de 2026.' : 'Metas distribuídas igualmente pelos 12 meses.');
}

/* ============================================================
   DADOS & BACKUP
   ============================================================ */
function renderDados() {
  const nEdits = Object.keys(store.edits).length;
  const A = agg(ALL_DAYS, 'all');
  const st = [
    ['Período coberto', `01/01/2026 – 31/12/2026 · ${NDAYS} dias`],
    ['Último dia com movimento', DAYS[LAST_ACTIVE].long + ' (' + DOW_L[DAYS[LAST_ACTIVE].dow] + ')'],
    ['Canais cadastrados', CH_IDS.length + ' · ' + CH_IDS.filter(id => agg(ALL_DAYS, id).rec > 0).length + ' com receita'],
    ['Receita realizada no ano', brl(A.rec)],
    ['Receita paga no ano', brl(A.recPaga)],
    ['Dias editados por você', nEdits ? nEdits + ' registro(s)' : 'nenhum — dados originais'],
    ['Armazenamento', MEM_ONLY ? 'Indisponível neste navegador — exporte um backup antes de fechar' : 'Local, neste navegador'],
    ['Última gravação', store.stamp ? new Date(store.stamp).toLocaleString('pt-BR') : '—']
  ];
  document.getElementById('dataStatus').innerHTML = st.map(([l, v]) =>
    `<div style="display:flex;justify-content:space-between;gap:16px;padding:7px 0;border-bottom:1px solid var(--line);font-size:12.7px">
      <span style="color:var(--ink-2)">${l}</span><b style="text-align:right">${v}</b></div>`).join('');

  const LIN = [
    ['Receita, pedidos, cancelamentos, ADS', 'Diário por canal', 'Colunas Q–CM da aba DIÁRIO da planilha, dia a dia, por canal.'],
    ['Receita paga', 'Calculado', 'Receita realizada − receita cancelada, exatamente como a coluna P da planilha.'],
    ['Totais mensais e anuais', 'Calculado', 'Somados a partir do diário — por isso batem com as abas ANUAL e CANAIS.'],
    ['Visitas', 'Mensal', 'Foram lançadas mês a mês na planilha, não dia a dia. O sistema usa o diário quando houver, senão o registro mensal.'],
    ['Semanas', 'Calculado', 'Semana de segunda a domingo; a semana 1 é a que contém 01/01/2026 — mesmo critério da aba SEMANAL.'],
    ['Comparativos por dia da semana', 'Calculado', 'Reagrupamento do diário, substituindo as abas COMPARATIVOS e COMP. DIÁRIO.'],
    ['Metas', 'Você define', 'O que você digitar em Metas alimenta atingimento, GAP e projeção.'],
    ['TACOS (e não ACOS)', 'Calculado', 'A planilha rotula a coluna como ACOS, mas a fórmula dela é Inv. ADS ÷ Receita Total — que é a definição de TACOS no próprio glossário. ACOS verdadeiro exige a receita atribuída aos anúncios, que a planilha não registra em nenhuma coluna. O sistema usa o nome correto.'],
    ['Glossário', 'Planilha', 'Texto integral da aba GLOSSÁRIO, mais as notas do sistema.']
  ];
  document.getElementById('tLineage').innerHTML =
    `<thead><tr><th>Informação</th><th>Origem</th><th>Como é obtida</th></tr></thead><tbody>` +
    LIN.map(r => `<tr><td>${r[0]}</td><td style="text-align:left;font-family:var(--f-ui)">${r[1]}</td>
      <td style="text-align:left;font-family:var(--f-ui);white-space:normal;color:var(--ink-2);max-width:560px">${r[2]}</td></tr>`).join('') + '</tbody>';
}

async function offerFile(filename, text, fallbackExt) {
  if (window.claude && window.claude.downloads) {
    try { await window.claude.downloads.save({ filename, data: text }); toast('Arquivo salvo.'); return; }
    catch (err) {
      const c = err && err.code;
      if (c === 'declined') return;
      if ((c === 'extension_not_enabled' || c === 'rejected_extension') && fallbackExt) {
        try { await window.claude.downloads.save({ filename: filename.replace(/\.[^.]+$/, fallbackExt), data: text }); toast('Salvo como ' + fallbackExt); return; }
        catch (e2) { if (e2 && e2.code === 'declined') return; }
      }
    }
  }
  try {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
    a.download = filename; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    toast('Download iniciado.');
  } catch (e) { toast('Não foi possível baixar o arquivo aqui.'); }
}
function csvEsc(v) { const s = String(v ?? ''); return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
function buildDailyCsv() {
  const head = ['Data', 'Dia', 'Canal', 'Visitas', 'Receita', 'Pedidos', 'InvADS', 'PedidosCancelados', 'ValorCancelado', 'ReceitaPaga'];
  const lines = [head.join(';')];
  DAYS.forEach(d => CH_IDS.forEach(cid => {
    const v = [F.VIS, F.REC, F.PED, F.ADS, F.CPED, F.CVAL].map(f => cell(cid, d.i, f));
    if (v.every(x => !x)) return;
    lines.push([d.iso, DOW_S[d.dow], CH_LABEL[cid], ...v.map(x => String(x).replace('.', ',')), String(v[1] - v[5]).replace('.', ',')].map(csvEsc).join(';'));
  }));
  return lines.join('\n');
}
function buildMonthlyCsv() {
  const head = ['Canal', 'Mes', 'Receita', 'Pedidos', 'PedidosCancelados', 'ValorCancelado', 'ReceitaPaga', 'InvADS', 'Visitas', 'Meta'];
  const lines = [head.join(';')];
  CH_IDS.forEach(cid => MON_L.forEach((mn, m) => {
    const a = aggMonth(m, cid);
    lines.push([CH_LABEL[cid], mn, a.rec, a.ped, a.cped, a.cval, a.recPaga, a.ads, Math.round(a.vis), a.meta]
      .map(x => typeof x === 'number' ? String(Math.round(x * 100) / 100).replace('.', ',') : x).map(csvEsc).join(';'));
  }));
  return lines.join('\n');
}
function wireDados() {
  document.getElementById('expJson').onclick = () =>
    offerFile('bomdecompras-marketplace-2026-backup.json', JSON.stringify({ v: 1, exported: new Date().toISOString(), store }, null, 2));
  document.getElementById('expCsvDaily').onclick = () => offerFile('bomdecompras-diario-2026.csv', buildDailyCsv(), '.txt');
  document.getElementById('expCsvMonthly').onclick = () => offerFile('bomdecompras-mensal-2026.csv', buildMonthlyCsv(), '.txt');
  const fi = document.getElementById('fileIn');
  document.getElementById('impJson').onclick = () => fi.click();
  fi.onchange = () => {
    const f = fi.files[0]; if (!f) return;
    const rd = new FileReader();
    rd.onload = () => {
      try {
        const p = JSON.parse(rd.result);
        const s = p.store || p;
        store.edits = s.edits || {};
        CH_IDS.forEach(id => store.metas[id] = (s.metas && s.metas[id]) || Array(12).fill(0));
        store.metaAnual = s.metaAnual || 0;
        saveStore(); render(); toast('Backup restaurado.');
      } catch (e) { toast('Arquivo inválido.'); }
      fi.value = '';
    };
    rd.readAsText(f);
  };
  document.getElementById('resetAll').onclick = () => confirmBox('Restaurar dados originais?',
    'Todas as suas edições e metas serão apagadas e o sistema volta exatamente aos números da planilha.', () => {
      store.edits = {}; CH_IDS.forEach(id => store.metas[id] = Array(12).fill(0)); store.metaAnual = 0;
      saveStore(); render(); toast('Dados originais restaurados.');
    });
}

/* ============================================================
   GLOSSÁRIO
   ============================================================ */
const GL_EXTRA = [
  ['— NOTAS DESTE SISTEMA —', null, null, null, null],
  ['TACOS (em vez de ACOS)', 'Total Advertising Cost of Sales',
   'Investimento em ADS dividido pela receita total do recorte. É a métrica que os dados da planilha permitem calcular.',
   'A planilha chama essa mesma conta de "ACOS". ACOS de verdade seria o investimento dividido apenas pela receita gerada pelos anúncios — número que não existe em nenhuma coluna da planilha. Por isso o sistema usa o nome correto: TACOS.',
   'Calculado pelo sistema a partir do diário'],
  ['Receita ÷ ADS', 'Retorno sobre o investimento total',
   'Quantas vezes a receita total cobre o investimento em mídia no período.',
   'Não confunda com ROAS: o ROAS clássico usa só a receita vinda dos anúncios. Como esse dado não é registrado, aqui o número é sobre a receita inteira e fica bem mais alto.',
   'Calculado pelo sistema'],
  ['Receita paga', 'Receita líquida de cancelamentos',
   'Receita realizada menos a receita cancelada — é a métrica principal deste sistema.',
   'Foi escolhida como número-herói do dashboard porque é a que mais se aproxima do que vira caixa.',
   'Calculado: receita − cancelamento, igual à coluna P da aba DIÁRIO'],
  ['Visitas', 'Sessões nos anúncios',
   'Acessos às páginas de produto.',
   'Atenção: na planilha as visitas foram lançadas mês a mês, não dia a dia. Quando o registro mensal for maior que a soma do diário, o sistema usa o mensal — senão a taxa de conversão sairia muito distorcida.',
   'Registro mensal por canal, da aba CANAIS']
];
function renderGlossario() {
  const q = (document.getElementById('glSearch').value || '').toLowerCase().trim();
  let html = '', shown = 0, pending = null;
  [...RAW.glossary, ...GL_EXTRA].forEach(r => {
    const isSec = !r[1] && !r[2];
    if (isSec) { pending = String(r[0]).replace(/—/g, '').trim(); return; }
    const hay = r.filter(Boolean).join(' ').toLowerCase();
    if (q && !hay.includes(q)) return;
    if (pending) { html += `<div class="gsec">${esc(pending)}</div>`; pending = null; }
    shown++;
    html += `<div class="g">
      <h4>${esc(r[0])}</h4>
      ${r[1] && r[1] !== r[0] ? `<div class="fn">${esc(r[1])}</div>` : ''}
      <p>${esc(r[2] || '')}</p>
      ${r[3] ? `<div class="rd">${esc(r[3])}</div>` : ''}
      ${r[4] ? `<div class="wh">Onde buscar: ${esc(r[4])}</div>` : ''}
    </div>`;
  });
  document.getElementById('glList').innerHTML = shown ? html : '<div class="blank">Nenhuma métrica encontrada.</div>';
}

/* ============================================================
   INTEGRAÇÕES DE API
   ============================================================ */
const INTEGRATIONS = [
  { id: 'ml',          name: 'Mercado Livre',              icon: '🛒', desc: 'Conta Mercado Livre da Bom de Compras.', status: 'pending', syncNote: 'Sincronização automática de pedidos, receitas e cancelamentos via API do Mercado Livre.' }
];

const STATUS_LABELS = {
  connected: { label: 'Conectado', cls: 'connected' },
  config:    { label: 'Configurando', cls: 'config' },
  pending:   { label: 'Pendente', cls: 'pending' },
  error:     { label: 'Erro', cls: 'error' }
};

function renderIntegracoes() {
  // Load saved states from localStorage
  const saved = JSON.parse(localStorage.getItem('bomdecompras-integrations') || '{}');

  const grid = document.getElementById('intGrid');
  if (!grid) return;

  grid.innerHTML = INTEGRATIONS.map(ch => {
    const st = saved[ch.id] || { status: ch.status, token: '', lastSync: null, autoSync: false };
    const badge = STATUS_LABELS[st.status] || STATUS_LABELS.pending;
    const lastSyncTxt = st.lastSync ? `Última sync: ${new Date(st.lastSync).toLocaleString('pt-BR')}` : 'Sem sync ainda';
    return `
    <div class="c6">
      <div class="integration-card" data-ch="${ch.id}">
        <div class="ilogo">${ch.icon}</div>
        <div class="ibody">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:4px">
            <div class="iname">${esc(ch.name)}</div>
            <div class="api-badge ${badge.cls}"><div class="dot"></div>${badge.label}</div>
          </div>
          <div class="idesc">${esc(ch.desc)}</div>
          <div style="font-size:11px;color:var(--ink-3);margin-top:4px">${esc(ch.syncNote)}</div>
          <div class="iacts">
            <input class="itoken" type="password" id="tok-${ch.id}" placeholder="Token / API Key" value="${esc(st.token || '')}"
              title="Insira o token de autenticação da API deste canal">
            <button class="btn" onclick="testIntegration('${ch.id}')" title="Testar conexão">Testar</button>
            <button class="btn" onclick="saveIntegration('${ch.id}')" title="Salvar token">Salvar</button>
          </div>
          <div style="display:flex;align-items:center;gap:10px;margin-top:8px;font-size:11.5px;color:var(--ink-3)">
            <label style="display:flex;align-items:center;gap:6px;cursor:pointer">
              <input type="checkbox" id="sync-${ch.id}" ${st.autoSync ? 'checked' : ''} onchange="toggleAutoSync('${ch.id}',this.checked)">
              Auto-sync (quando disponível)
            </label>
            <span style="margin-left:auto">${lastSyncTxt}</span>
          </div>
        </div>
      </div>
    </div>`;
  }).join('');
}

function saveIntegration(id) {
  const saved = JSON.parse(localStorage.getItem('bomdecompras-integrations') || '{}');
  const token = document.getElementById('tok-' + id)?.value || '';
  saved[id] = { ...(saved[id] || {}), token, status: token ? 'config' : 'pending' };
  localStorage.setItem('bomdecompras-integrations', JSON.stringify(saved));
  renderIntegracoes();
  // Show brief toast
  const card = document.querySelector(`[data-ch="${id}"]`);
  if (card) {
    const toast = document.createElement('div');
    toast.style.cssText = 'position:fixed;bottom:20px;right:20px;background:var(--up-wash);color:var(--up);border:1px solid var(--up);border-radius:10px;padding:10px 16px;font-size:12.5px;font-weight:600;z-index:999;box-shadow:0 4px 16px rgba(0,0,0,.25)';
    toast.textContent = '✓ Token salvo com segurança no localStorage';
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2500);
  }
}

function testIntegration(id) {
  const token = document.getElementById('tok-' + id)?.value || '';
  if (!token) {
    alert('Insira um token antes de testar.');
    return;
  }
  // Stub: APIs not connected yet
  const toast = document.createElement('div');
  toast.style.cssText = 'position:fixed;bottom:20px;right:20px;background:var(--warn-wash);color:var(--warn);border:1px solid var(--warn);border-radius:10px;padding:10px 16px;font-size:12.5px;font-weight:600;z-index:999;box-shadow:0 4px 16px rgba(0,0,0,.25)';
  toast.textContent = '⚠ API não conectada — integração em desenvolvimento.';
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}

function toggleAutoSync(id, value) {
  const saved = JSON.parse(localStorage.getItem('bomdecompras-integrations') || '{}');
  saved[id] = { ...(saved[id] || {}), autoSync: value };
  localStorage.setItem('bomdecompras-integrations', JSON.stringify(saved));
}
