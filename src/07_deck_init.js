/* ============================================================
   APRESENTAÇÃO EXECUTIVA
   ============================================================ */
let deckMode = 'daily'; // 'daily', 'weekly', 'custom'

function buildSlides() {
  let days = periodDays(), prev = prevDays(), sc = state.scope;
  let subtitle = '';

  if (deckMode === 'daily') {
    const m = DAYS[LAST_ACTIVE].m;
    days = MONTH_DAYS[m].filter(i => i <= LAST_ACTIVE);
    const prevM = m - 1;
    if (prevM >= 0 && MONTH_DAYS[prevM]) {
      const limitDay = DAYS[LAST_ACTIVE].d;
      prev = MONTH_DAYS[prevM].filter(i => DAYS[i].d <= limitDay);
    } else prev = [];
    subtitle = `MTD até ${DAYS[LAST_ACTIVE].label}`;
  } else if (deckMode === 'weekly') {
    const lastWIdx = WEEKS.findIndex(w => w.days.includes(LAST_ACTIVE));
    const lastW = WEEKS[lastWIdx >= 0 ? lastWIdx : WEEKS.length - 1];
    days = lastW.days.filter(i => i <= LAST_ACTIVE);
    if (lastWIdx > 0) prev = WEEKS[lastWIdx - 1].days;
    else prev = [];
    subtitle = `Semana: ${lastW.label} (${lastW.range})`;
  } else {
    subtitle = `Período: ${periodLabel()}`;
  }

  const A = agg(days, sc), P = prev.length ? agg(prev, sc) : null;
  const scopeName = sc === 'all' ? 'Todos os canais' : CH_LABEL[sc];
  const l30 = DAYS.slice(Math.max(0, LAST_ACTIVE - 29), LAST_ACTIVE + 1);
  const l30v = l30.map(d => agg([d.i], sc));
  const wIdx = WEEKS.findIndex(w => w.days.includes(LAST_ACTIVE));
  const w8 = WEEKS.slice(Math.max(0, wIdx - 7), wIdx + 1);

  const S = [];

  // 1. Resumo Executivo
  const kpis = [
    { lab: 'Receita Paga', v: brl(A.recPaga), d: P ? deltaTag(delta(A.recPaga, P.recPaga)) : '', data: l30v.map(a => a.recPaga) },
    { lab: 'Pedidos Pagos', v: int(A.pedPagos), d: P ? deltaTag(delta(A.pedPagos, P.pedPagos)) : '', data: l30v.map(a => a.pedPagos) },
    { lab: 'Ticket Médio', v: brl(A.ticketPago), d: P ? deltaTag(delta(A.ticketPago, P.ticketPago)) : '', data: l30v.map(a => a.ticketPago) },
    { lab: 'Conversão', v: pct(A.conv, 2), d: P ? deltaTag(delta(A.conv, P.conv)) : '', data: l30v.map(a => a.conv) }
  ];
  S.push({
    eye: scopeName, title: 'Resumo Executivo', sub: subtitle,
    body: `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-top:40px;">
        ${kpis.map((k, i) => `
        <div style="background:var(--panel-2);border-radius:16px;padding:32px;">
          <div style="font-size:14px;font-weight:700;color:var(--ink-3);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px">${k.lab}</div>
          <div class="big" style="font-size:64px">${k.v}</div>
          ${k.d ? `<div style="margin-top:14px;font-size:18px">${k.d} vs ant.</div>` : ''}
          <canvas id="deckSpark${i}" height="40" style="width:100%;margin-top:16px"></canvas>
        </div>`).join('')}
      </div>
    `,
    after: () => {
      kpis.forEach((k, i) => {
        const cv = document.getElementById('deckSpark' + i);
        if (cv) spark(cv, k.data, seriesColor(i), { fill: true });
      });
    }
  });

  // 2. Histórico Analítico (Tabela densa dos últimos 7 dias / 4 semanas + mini gráfico)
  let histRows = '';
  let chartFn = null;
  if (deckMode === 'weekly') {
    const w4 = w8.slice(-4).reverse(); // Últimas 4 semanas
    w4.forEach(w => {
      const wa = agg(w.days, sc);
      histRows += `
        <tr style="border-bottom:1px solid var(--line);">
          <td style="padding:12px 16px;font-weight:600;color:var(--ink)">${w.label} <span style="font-size:11px;color:var(--ink-3);font-weight:400;margin-left:6px">${w.range}</span></td>
          <td style="padding:12px 16px;text-align:right;font-family:var(--f-num);font-size:15px">${brl(wa.recPaga)}</td>
          <td style="padding:12px 16px;text-align:right;font-family:var(--f-num)">${int(wa.vis)}</td>
          <td style="padding:12px 16px;text-align:right;font-family:var(--f-num)">${pct(wa.conv, 2)}</td>
          <td style="padding:12px 16px;text-align:right;font-family:var(--f-num)">${brl(wa.ticketPago)}</td>
        </tr>
      `;
    });
    chartFn = () => {
       const data = w8.map(w => agg(w.days, sc).recPaga);
       chart('deckChartTrend', {
         type: 'bar', labels: w8.map(w => w.label),
         series: [{ name: 'Receita', data, color: seriesColor(0), type: 'bar', fmt: brl }],
         yFmt: axisK, tipTitle: k => w8[k].range
       });
    };
  } else {
    const d7 = l30.slice(-7).reverse(); // Últimos 7 dias
    d7.forEach(d => {
      const da = agg([d.i], sc);
      histRows += `
        <tr style="border-bottom:1px solid var(--line);">
          <td style="padding:12px 16px;font-weight:600;color:var(--ink)">${d.long}</td>
          <td style="padding:12px 16px;text-align:right;font-family:var(--f-num);font-size:15px">${brl(da.recPaga)}</td>
          <td style="padding:12px 16px;text-align:right;font-family:var(--f-num)">${int(da.vis)}</td>
          <td style="padding:12px 16px;text-align:right;font-family:var(--f-num)">${pct(da.conv, 2)}</td>
          <td style="padding:12px 16px;text-align:right;font-family:var(--f-num)">${brl(da.ticketPago)}</td>
        </tr>
      `;
    });
    chartFn = () => {
       const data = l30.map(d => agg([d.i], sc).recPaga);
       chart('deckChartTrend', {
         type: 'line', labels: l30.map(d => d.label), maxXTicks: 15,
         series: [{ name: 'Receita', data, color: seriesColor(0), type: 'line', width: 2, fmt: brl }],
         yFmt: axisK, tipTitle: k => l30[k].long
       });
    };
  }

  S.push({
    eye: scopeName, title: 'Histórico Analítico: Desempenho Recente', sub: subtitle,
    body: `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-top:30px;height:400px">
        <div class="tw tall">
          <table style="width:100%;border-collapse:collapse;font-size:13.5px">
            <thead>
              <tr style="border-bottom:2px solid var(--line-2);background:var(--panel-2)">
                <th style="text-align:left;padding:12px 16px;font-weight:700;color:var(--ink-2);text-transform:uppercase;font-size:11px">Período</th>
                <th style="text-align:right;padding:12px 16px;font-weight:700;color:var(--ink-2);text-transform:uppercase;font-size:11px">Receita</th>
                <th style="text-align:right;padding:12px 16px;font-weight:700;color:var(--ink-2);text-transform:uppercase;font-size:11px">Visitas</th>
                <th style="text-align:right;padding:12px 16px;font-weight:700;color:var(--ink-2);text-transform:uppercase;font-size:11px">Conv.</th>
                <th style="text-align:right;padding:12px 16px;font-weight:700;color:var(--ink-2);text-transform:uppercase;font-size:11px">Ticket</th>
              </tr>
            </thead>
            <tbody>${histRows}</tbody>
          </table>
        </div>
        <div style="background:var(--panel-2);border-radius:12px;padding:20px;display:flex;flex-direction:column">
          <div style="font-size:12px;font-weight:700;color:var(--ink-3);text-transform:uppercase;margin-bottom:14px">Gráfico de Receita (${deckMode==='weekly'?'8 sem':'30 dias'})</div>
          <div style="flex:1"><canvas id="deckChartTrend"></canvas></div>
        </div>
      </div>
    `,
    after: chartFn
  });

  // 3. Matriz de Canais (Diagnóstico Completo)
  if (sc === 'all') {
    let rows = '';
    // Ordenar por receita decrescente
    const chData = CH_IDS.map(cid => ({ cid, ac: agg(days, cid) })).sort((a,b) => b.ac.recPaga - a.ac.recPaga);
    chData.forEach(({cid, ac}) => {
      const atg = ac.meta ? ac.rec / ac.meta : null;
      let atgHtml = '—';
      if (atg != null) {
        atgHtml = `<span style="color:${atg >= 1 ? 'var(--up)' : 'var(--warn)'};font-weight:700">${pct(atg, 1)}</span>`;
      }
      const roasStr = ac.recPorAds ? ac.recPorAds.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + '×' : '—';

      rows += `
        <tr style="border-bottom:1px solid var(--line);">
          <td style="padding:14px 16px;font-size:14.5px;font-weight:600;color:var(--ink);min-width:140px">${CH_LABEL[cid]}</td>
          <td style="padding:14px 16px;font-size:15px;font-family:var(--f-num);font-weight:700;text-align:right">${brl(ac.recPaga)}</td>
          <td style="padding:14px 16px;font-size:15px;font-family:var(--f-num);text-align:right">${atgHtml}</td>
          <td style="padding:14px 16px;font-size:14.5px;font-family:var(--f-num);text-align:right;color:var(--ink-2)">${int(ac.vis)}</td>
          <td style="padding:14px 16px;font-size:14.5px;font-family:var(--f-num);text-align:right;color:var(--ink-2)">${pct(ac.conv, 2)}</td>
          <td style="padding:14px 16px;font-size:14.5px;font-family:var(--f-num);text-align:right;color:var(--ink-2)">${brl(ac.ticketPago)}</td>
          <td style="padding:14px 16px;font-size:14.5px;font-family:var(--f-num);text-align:right;color:var(--ink-2)">${roasStr}</td>
          <td style="padding:14px 16px;font-size:14.5px;font-family:var(--f-num);text-align:right;color:var(--ink-2)">${pct(ac.pctCancel, 1)}</td>
        </tr>
      `;
    });

    S.push({
      eye: 'Diagnóstico de Canais', title: 'Matriz Analítica de Desempenho por Canal', sub: subtitle,
      body: `
        <div style="background:var(--panel-2);border-radius:12px;padding:20px;margin-top:24px;height:180px;display:flex;flex-direction:column">
          <div style="font-size:12px;font-weight:700;color:var(--ink-3);text-transform:uppercase;margin-bottom:10px">Receita Paga por Canal</div>
          <div style="flex:1"><canvas id="deckChartChannels"></canvas></div>
        </div>
        <div class="tw tall" style="margin-top:20px;border:1px solid var(--line);border-radius:12px;box-shadow:var(--sh-2)">
          <table style="width:100%;border-collapse:collapse;white-space:nowrap">
            <thead>
              <tr style="border-bottom:2px solid var(--line-2);background:var(--panel-2)">
                <th style="text-align:left;padding:16px;font-weight:700;color:var(--ink-2);text-transform:uppercase;font-size:11px">Canal</th>
                <th style="text-align:right;padding:16px;font-weight:700;color:var(--ink-2);text-transform:uppercase;font-size:11px">Receita Paga</th>
                <th style="text-align:right;padding:16px;font-weight:700;color:var(--ink-2);text-transform:uppercase;font-size:11px">Meta (%)</th>
                <th style="text-align:right;padding:16px;font-weight:700;color:var(--ink-2);text-transform:uppercase;font-size:11px">Visitas</th>
                <th style="text-align:right;padding:16px;font-weight:700;color:var(--ink-2);text-transform:uppercase;font-size:11px">Conversão</th>
                <th style="text-align:right;padding:16px;font-weight:700;color:var(--ink-2);text-transform:uppercase;font-size:11px">Ticket Médio</th>
                <th style="text-align:right;padding:16px;font-weight:700;color:var(--ink-2);text-transform:uppercase;font-size:11px">ROAS</th>
                <th style="text-align:right;padding:16px;font-weight:700;color:var(--ink-2);text-transform:uppercase;font-size:11px">Canceled (%)</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      `,
      after: () => {
        chart('deckChartChannels', {
          type: 'bar', labels: chData.map(d => CH_LABEL[d.cid]),
          series: [{ name: 'Receita Paga', data: chData.map(d => d.ac.recPaga), color: seriesColor(0), type: 'bar', fmt: brl }],
          yFmt: axisK, tipTitle: k => CH_LABEL[chData[k].cid]
        });
      }
    });
  }

  // 4. Funil Global e Saúde
  const dropVisPed = A.vis ? pct(A.ped / A.vis, 2) : '—';
  const dropPedPag = A.ped ? pct(A.pedPagos / A.ped, 1) : '—';

  S.push({
    eye: scopeName, title: 'Saúde da Operação: Funil e Cancelamento', sub: subtitle,
    body: `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:32px;margin-top:30px">
        <div style="background:var(--panel-2);border-radius:16px;padding:32px;display:flex;flex-direction:column;gap:12px">
          <div style="font-size:14px;font-weight:800;color:var(--ink-3);text-transform:uppercase;margin-bottom:12px">Funil de Vendas</div>

          <div style="display:flex;align-items:center;background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:20px;position:relative;overflow:hidden">
            <div style="position:absolute;left:0;top:0;bottom:0;width:100%;background:var(--brand);opacity:0.1"></div>
            <div style="flex:0 0 120px;font-size:16px;font-weight:700">Visitas</div>
            <div style="flex:1;text-align:right;font-family:var(--f-num);font-size:28px;font-weight:700">${int(A.vis)}</div>
          </div>

          <div style="text-align:center;color:var(--ink-3);font-size:24px;margin:-4px 0">↓</div>

          <div style="display:flex;align-items:center;background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:20px;position:relative;overflow:hidden">
            <div style="position:absolute;left:0;top:0;bottom:0;width:60%;background:var(--brand);opacity:0.1"></div>
            <div style="flex:0 0 120px;font-size:16px;font-weight:700">Pedidos</div>
            <div style="flex:1;text-align:right;font-family:var(--f-num);font-size:28px;font-weight:700">${int(A.ped)}</div>
            <div style="margin-left:24px;font-size:14px;color:var(--ink-2);min-width:70px">Conv.<br><b style="color:var(--ink)">${dropVisPed}</b></div>
          </div>

          <div style="text-align:center;color:var(--ink-3);font-size:24px;margin:-4px 0">↓</div>

          <div style="display:flex;align-items:center;background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:20px;position:relative;overflow:hidden">
            <div style="position:absolute;left:0;top:0;bottom:0;width:40%;background:var(--brand);opacity:0.1"></div>
            <div style="flex:0 0 120px;font-size:16px;font-weight:700">Pagos</div>
            <div style="flex:1;text-align:right;font-family:var(--f-num);font-size:28px;font-weight:700">${int(A.pedPagos)}</div>
            <div style="margin-left:24px;font-size:14px;color:var(--ink-2);min-width:70px">Aprov.<br><b style="color:var(--ink)">${dropPedPag}</b></div>
          </div>
        </div>

        <div style="display:flex;flex-direction:column;gap:16px">
          <div style="background:var(--panel-2);border-radius:16px;padding:28px;">
            <div style="font-size:12px;font-weight:700;color:var(--ink-3);text-transform:uppercase;margin-bottom:8px">Cancelamento Global</div>
            <div class="big" style="font-size:48px;color:var(--warn)">${brl(A.cval)}</div>
            <div style="margin-top:8px;font-size:16px;color:var(--ink-2)"><b>${pct(A.pctCancel, 1)}</b> da receita foi cancelada</div>
          </div>

          <div style="background:var(--panel-2);border-radius:16px;padding:28px;display:grid;grid-template-columns:1fr 1fr;gap:20px">
            <div>
              <div style="font-size:12px;font-weight:700;color:var(--ink-3);text-transform:uppercase;margin-bottom:8px">TACOS</div>
              <div class="big" style="font-size:36px">${pct(A.tacos, 2)}</div>
            </div>
            <div>
              <div style="font-size:12px;font-weight:700;color:var(--ink-3);text-transform:uppercase;margin-bottom:8px">Investimento Ads</div>
              <div class="big" style="font-size:36px">${brl(A.ads)}</div>
            </div>
          </div>

          <div style="background:var(--panel-2);border-radius:16px;padding:20px;flex:1;display:flex;flex-direction:column;min-height:150px">
            <div style="font-size:12px;font-weight:700;color:var(--ink-3);text-transform:uppercase;margin-bottom:10px">Cancelamento vs. TACOS · 30 dias</div>
            <div style="flex:1"><canvas id="deckChartHealth"></canvas></div>
          </div>
        </div>
      </div>
    `,
    after: () => {
      chart('deckChartHealth', {
        type: 'line', labels: l30.map(d => d.label), maxXTicks: 10,
        series: [
          { name: 'Cancelamento', data: l30v.map(a => a.pctCancel), color: seriesColor(3), type: 'line', width: 2, fmt: v => pct(v, 1) },
          { name: 'TACOS', data: l30v.map(a => a.tacos), color: seriesColor(6), type: 'line', width: 2, dash: [5, 4], fmt: v => pct(v, 2) }
        ],
        yFmt: v => pct(v, 0), tipTitle: k => l30[k].long
      });
    }
  });

  return S;
}

function renderApresentacao() {
  const segs = document.querySelectorAll('#deckModeSeg button');
  if (segs.length) {
    segs.forEach(b => {
      b.onclick = () => {
        deckMode = b.dataset.m;
        segs.forEach(x => x.setAttribute('aria-pressed', String(x === b)));
        updateDeckPreview();
      };
      b.setAttribute('aria-pressed', String(b.dataset.m === deckMode));
    });
  }

  updateDeckPreview();
  const startBtn = document.getElementById('deckStart');
  if (startBtn) startBtn.onclick = openDeck;
}

function updateDeckPreview() {
  const S = buildSlides();
  const p = document.getElementById('deckPreview');
  if (!p) return;
  p.innerHTML = S.map((s, i) => `
    <div class="panel pad c3">
      <div class="lab">Slide ${i + 1}</div>
      <h3 style="font-family:var(--f-disp);font-size:15px;margin:6px 0 4px;letter-spacing:-.02em">${esc(s.title)}</h3>
    </div>`).join('');

  const note = document.getElementById('deckNote');
  if (note) {
    if (deckMode === 'daily') note.textContent = 'Gerando deck Diário (MTD até o último dia com dados)';
    else if (deckMode === 'weekly') note.textContent = 'Gerando deck Semanal (Focado na última semana fechada)';
    else note.textContent = 'Gerando deck Personalizado com o período selecionado no topo';
  }
}

let deckEl = null, deckIdx = 0, deckSlides = [];
function openDeck() {
  deckSlides = buildSlides(); deckIdx = 0;
  deckEl = document.createElement('div');
  deckEl.className = 'deck';
  deckEl.innerHTML = `<div class="stage" id="deckStage"></div>
    <div class="deckbar">
      <button class="btn" id="dPrev">← Anterior</button>
      <div class="dots" id="dDots"></div>
      <button class="btn" id="dNext">Próximo →</button>
      <button class="btn qui" id="dClose">Sair (Esc)</button>
    </div>`;
  document.body.appendChild(deckEl);
  document.getElementById('dPrev').onclick = () => showSlide(deckIdx - 1);
  document.getElementById('dNext').onclick = () => showSlide(deckIdx + 1);
  document.getElementById('dClose').onclick = closeDeck;
  addEventListener('keydown', deckKeys);
  showSlide(0);
}
function deckKeys(e) {
  if (!deckEl) return;
  if (e.key === 'Escape') closeDeck();
  else if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') { e.preventDefault(); showSlide(deckIdx + 1); }
  else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); showSlide(deckIdx - 1); }
}
function closeDeck() { removeEventListener('keydown', deckKeys); deckEl && deckEl.remove(); deckEl = null; }
function showSlide(i) {
  deckIdx = Math.max(0, Math.min(deckSlides.length - 1, i));
  const s = deckSlides[deckIdx];
  document.getElementById('deckStage').innerHTML =
    `<div class="slide"><div class="eye">${esc(s.eye)}</div><h2>${esc(s.title)}</h2>
     ${s.sub ? `<div class="sub">${esc(s.sub)}</div>` : ''}${s.body}</div>`;
  document.getElementById('dDots').innerHTML = deckSlides.map((_, k) =>
    `<i class="${k === deckIdx ? 'on' : ''}" data-k="${k}"></i>`).join('');
  document.querySelectorAll('#dDots i').forEach(d => d.onclick = () => showSlide(+d.dataset.k));
  if (s.after) requestAnimationFrame(s.after);
}
