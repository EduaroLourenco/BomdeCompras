/* ============================================================
   MODAL
   ============================================================ */
function confirmBox(title, msg, onYes) {
  const bg = document.createElement('div');
  bg.className = 'veil center';
  bg.innerHTML = `<div class="modal" role="dialog" aria-modal="true">
    <h3>${esc(title)}</h3><p>${esc(msg)}</p>
    <div class="acts"><button class="btn" data-x>Cancelar</button><button class="btn pri" data-y>Confirmar</button></div></div>`;
  document.body.appendChild(bg);
  const close = () => { bg.remove(); removeEventListener('keydown', k); };
  const k = e => { if (e.key === 'Escape') close(); };
  addEventListener('keydown', k);
  bg.querySelector('[data-x]').onclick = close;
  bg.querySelector('[data-y]').onclick = () => { close(); onYes(); };
  bg.onclick = e => { if (e.target === bg) close(); };
  bg.querySelector('[data-y]').focus();
}

/* ============================================================
   NAVEGAÇÃO
   ============================================================ */
const VIEWS = {
  dash:         ['Dashboard',      'Visão consolidada do período',                 1, 1],
  canais:       ['Canais',         'Performance comparada entre marketplaces',     1, 1],
  anual:        ['Anual',          'Todos os indicadores, mês a mês',              0, 1],
  semanal:      ['Semanal',        '53 semanas · segunda a domingo',               0, 1],
  comparativos: ['Comparativos',   'Padrões por dia da semana',                    1, 1],
  lancamentos:  ['Lançamentos',    'Entrada e correção dos dados diários',         0, 0],
  metas:        ['Metas',          'Objetivos de receita por canal e mês',         0, 0],
  dados:        ['Dados & Backup', 'Origem dos números, exportação e restauração', 0, 0],
  apresentacao: ['Apresentação',   'Slides prontos para a reunião',                1, 1],
  glossario:    ['Glossário',      'Guia de referência dos indicadores',           0, 0],
  integracoes:  ['Integrações',   'Hub de conexões de API por canal',             0, 0]
};

function go(v) {
  if (!VIEWS[v]) return;
  state.view = v;
  document.querySelectorAll('#nav button').forEach(b => b.setAttribute('aria-current', String(b.dataset.v === v)));
  document.querySelectorAll('.view').forEach(s => s.classList.toggle('on', s.id === 'v-' + v));
  document.getElementById('vTitle').textContent = VIEWS[v][0];
  const showFilters = VIEWS[v][2] || VIEWS[v][3];
  document.getElementById('filters').style.display = showFilters ? '' : 'none';
  const chips = document.getElementById('filterChips');
  if (chips) chips.style.display = showFilters ? '' : 'none';
  document.querySelector('#filters .fgroup').style.display = VIEWS[v][2] ? '' : 'none';
  document.querySelectorAll('#filters .fgroup')[1].style.display = VIEWS[v][3] ? '' : 'none';
  document.getElementById('rail').classList.remove('open');
  document.querySelector('.scrim')?.remove();
  hideTip();
  render();
  scrollTo({ top: 0, behavior: 'smooth' });
}

function setPeriod(id) {
  if (!PERIODS.some(p => p.id === id)) return;
  state.period = id; autoGran(); syncFilters(); render();
  toast('Período: ' + periodLabel());
}
function setScope(id) {
  state.scope = (state.scope === id) ? 'all' : id;
  syncFilters(); render();
  toast(state.scope === 'all' ? 'Mostrando todos os canais' : 'Filtrado: ' + CH_LABEL[state.scope]);
}

function syncFilters() {
  document.querySelectorAll('#presets button').forEach(b =>
    b.setAttribute('aria-pressed', String(b.dataset.p === state.period)));
  const ps = document.getElementById('periodSel');
  const isPreset = PERIODS.find(p => p.id === state.period)?.preset;
  ps.value = isPreset ? '' : state.period;
  document.querySelectorAll('#chPills .pill').forEach(b =>
    b.setAttribute('aria-pressed', String(b.dataset.ch === state.scope)));
  syncGranSeg();
  renderCrumb();
  renderActiveChips();
}
function renderCrumb() {
  const days = periodDays();
  const chLabel = state.scope === 'all' ? 'Todos os canais' : CH_LABEL[state.scope];
  const chColor = state.scope === 'all' ? null : seriesColor(CH_IDS.indexOf(state.scope));
  const chHtml  = chColor
    ? `<span style="display:inline-flex;align-items:center;gap:4px"><i style="width:7px;height:7px;border-radius:2px;background:${chColor};display:inline-block;flex:0 0 7px"></i>${esc(chLabel)}</span>`
    : esc(chLabel);
  const daysHtml = `<span style="background:var(--brand-wash);color:var(--brand);border-radius:99px;padding:1px 8px;font-size:10.5px;font-weight:700">${days.length} dias</span>`;
  const parts = [
    esc(periodLabel()),
    chHtml,
    daysHtml,
    esc(VIEWS[state.view][1])
  ];
  document.getElementById('crumb').innerHTML = parts.join('<i></i>');
}

function autoGran() {
  const n = periodDays().length;
  state.gran = n <= 62 ? 'd' : n <= 200 ? 'w' : 'm';
}
function syncGranSeg() {
  document.querySelectorAll('#granSeg button').forEach(x =>
    x.setAttribute('aria-pressed', String(x.dataset.g === state.gran)));
}

function render() {
  ({ dash: renderDash, canais: renderCanais, anual: renderAnual, semanal: renderSemanal,
     comparativos: renderComparativos, lancamentos: renderLancamentos, metas: renderMetas,
     dados: renderDados, apresentacao: renderApresentacao, glossario: renderGlossario,
     integracoes: renderIntegracoes })[state.view]();
  renderStatus();
  renderCrumb();
  renderActiveChips();
}
function renderStatus() {
  const n = Object.keys(store.edits).length;
  const dot = document.getElementById('stDot');
  document.getElementById('stMain').textContent = n ? `${n} dia(s) editado(s)` : 'Dados originais';
  document.getElementById('stSub').textContent = MEM_ONLY
    ? 'só nesta sessão — exporte um backup'
    : (n ? 'salvo neste navegador' : 'base zerada');
  dot.style.background = MEM_ONLY ? cvar('--down') : n ? cvar('--warn') : cvar('--up');
}

/* ============================================================
   PALETA DE COMANDOS (⌘K)
   ============================================================ */
let cmdkEl = null, cmdkItems = [], cmdkSel = 0;
function cmdkActions() {
  const A = [];
  Object.keys(VIEWS).forEach((v, i) =>
    A.push({ g: 'Ir para', t: VIEWS[v][0], s: VIEWS[v][1], rt: String((i + 1) % 10), run: () => go(v) }));
  PERIODS.forEach(p => A.push({ g: 'Período', t: p.label, run: () => setPeriod(p.id) }));
  A.push({ g: 'Canal', t: 'Todos os canais', sw: null, run: () => { state.scope = 'all'; syncFilters(); render(); } });
  CH_IDS.forEach((id, i) => A.push({
    g: 'Canal', t: CH_LABEL[id], sw: seriesColor(i),
    run: () => { state.scope = id; syncFilters(); render(); toast('Filtrado: ' + CH_LABEL[id]); }
  }));
  A.push({ g: 'Ação', t: 'Iniciar apresentação', run: () => { go('apresentacao'); setTimeout(openDeck, 120); } });
  A.push({ g: 'Ação', t: 'Baixar backup dos dados', run: () => { go('dados'); setTimeout(() => document.getElementById('expJson').click(), 120); } });
  A.push({ g: 'Ação', t: 'Alternar tema claro/escuro', run: toggleTheme });
  A.push({ g: 'Ação', t: 'Alternar densidade das tabelas', run: toggleDensity });
  return A;
}
function openCmdk() {
  if (cmdkEl) return;
  cmdkEl = document.createElement('div');
  cmdkEl.className = 'veil topish';
  cmdkEl.innerHTML = `<div class="cmdk" role="dialog" aria-modal="true">
      <input id="cmdkIn" placeholder="Buscar tela, período, canal ou ação…" autocomplete="off" spellcheck="false">
      <div class="cmdklist" id="cmdkList"></div>
      <div class="cmdkfoot"><span><kbd>↑</kbd><kbd>↓</kbd> navegar</span><span><kbd>↵</kbd> abrir</span><span><kbd>esc</kbd> fechar</span></div>
    </div>`;
  document.body.appendChild(cmdkEl);
  cmdkEl.onclick = e => { if (e.target === cmdkEl) closeCmdk(); };
  const inp = document.getElementById('cmdkIn');
  inp.oninput = () => paintCmdk(inp.value);
  inp.onkeydown = e => {
    if (e.key === 'Escape') { e.preventDefault(); closeCmdk(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); cmdkSel = Math.min(cmdkItems.length - 1, cmdkSel + 1); paintSel(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); cmdkSel = Math.max(0, cmdkSel - 1); paintSel(); }
    else if (e.key === 'Enter') { e.preventDefault(); const it = cmdkItems[cmdkSel]; if (it) { closeCmdk(); it.run(); } }
  };
  paintCmdk('');
  inp.focus();
}
function closeCmdk() { cmdkEl?.remove(); cmdkEl = null; }
function norm(s) { return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }
function paintCmdk(q) {
  const nq = norm(q.trim());
  cmdkItems = cmdkActions().filter(a => !nq || norm(a.t + ' ' + (a.s || '') + ' ' + a.g).includes(nq));
  cmdkSel = 0;
  const L = document.getElementById('cmdkList');
  if (!cmdkItems.length) { L.innerHTML = '<div class="blank" style="padding:26px"><b>Nada encontrado</b><p>Tente “março”, “vtex” ou “backup”.</p></div>'; return; }
  let html = '', last = null;
  cmdkItems.forEach((a, i) => {
    if (a.g !== last) { html += `<div class="cmdkgrp">${a.g}</div>`; last = a.g; }
    html += `<div class="cmdkit" data-i="${i}" aria-selected="${i === 0}">
      ${a.sw ? `<i class="sw" style="background:${a.sw}"></i>` : ''}
      <span>${esc(a.t)}</span>${a.rt ? `<span class="rt">${a.rt}</span>` : ''}</div>`;
  });
  L.innerHTML = html;
  L.querySelectorAll('.cmdkit').forEach(el => {
    el.onmouseenter = () => { cmdkSel = +el.dataset.i; paintSel(); };
    el.onclick = () => { const it = cmdkItems[+el.dataset.i]; closeCmdk(); it.run(); };
  });
}
function paintSel() {
  document.querySelectorAll('.cmdkit').forEach(el =>
    el.setAttribute('aria-selected', String(+el.dataset.i === cmdkSel)));
  document.querySelector('.cmdkit[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
}

/* ============================================================
   TEMA E DENSIDADE
   ============================================================ */
function toggleTheme() {
  const cur = document.documentElement.dataset.theme;
  const sysDark = matchMedia('(prefers-color-scheme: dark)').matches;
  const next = cur ? (cur === 'dark' ? 'light' : null) : (sysDark ? 'light' : 'dark');
  if (next) document.documentElement.dataset.theme = next; else delete document.documentElement.dataset.theme;
  try { next ? localStorage.setItem('bomdecompras-theme', next) : localStorage.removeItem('bomdecompras-theme'); } catch (e) { }
  render();
}
function toggleDensity() {
  const cur = document.documentElement.dataset.density;
  const next = cur === 'compact' ? '' : 'compact';
  if (next) document.documentElement.dataset.density = next; else delete document.documentElement.dataset.density;
  try { next ? localStorage.setItem('bomdecompras-density', next) : localStorage.removeItem('bomdecompras-density'); } catch (e) { }
  toast(next ? 'Tabelas compactas' : 'Tabelas confortáveis');
}

/* ============================================================
   INIT
   ============================================================ */
function init() {
  /* presets de período */
  document.getElementById('presets').innerHTML = PERIODS.filter(p => p.preset)
    .map(p => `<button data-p="${p.id}">${p.short}</button>`).join('');
  document.querySelectorAll('#presets button').forEach(b => b.onclick = () => setPeriod(b.dataset.p));

  /* select com os recortes específicos */
  const ps = document.getElementById('periodSel');
  ps.innerHTML = '<option value="">Recorte específico…</option>' +
    '<optgroup label="Semanas do mês">' + PERIODS.filter(p => /^occ/.test(p.id)).map(p => `<option value="${p.id}">${p.label}</option>`).join('') + '</optgroup>' +
    '<optgroup label="Trimestres">' + PERIODS.filter(p => p.id[0] === 'q').map(p => `<option value="${p.id}">${p.label}</option>`).join('') + '</optgroup>' +
    '<optgroup label="Meses">' + PERIODS.filter(p => /^m\d/.test(p.id)).map(p => `<option value="${p.id}">${p.label}</option>`).join('') + '</optgroup>';
  ps.onchange = () => { if (ps.value) setPeriod(ps.value); };

  /* pílulas de canal */
  document.getElementById('chPills').innerHTML =
    `<button class="pill" data-ch="all">Todos</button>` +
    CH_IDS.map((id, i) => `<button class="pill" data-ch="${id}"><i class="sw" style="background:${seriesColor(i)}"></i>${esc(CH_LABEL[id])}</button>`).join('');
  document.querySelectorAll('#chPills .pill').forEach(b => b.onclick = () => {
    state.scope = b.dataset.ch; syncFilters(); render();
  });

  document.querySelectorAll('#granSeg button').forEach(b => b.onclick = () => {
    state.gran = b.dataset.g; syncGranSeg(); renderDash();
  });
  document.querySelectorAll('#nav button').forEach(b => b.onclick = () => go(b.dataset.v));
  document.getElementById('glSearch').oninput = renderGlossario;
  document.getElementById('cmdkBtn').onclick = openCmdk;
  document.getElementById('themeBtn').onclick = toggleTheme;
  document.getElementById('densityBtn').onclick = toggleDensity;

  const burger = document.getElementById('burger');
  burger.onclick = () => {
    const rail = document.getElementById('rail');
    rail.classList.toggle('open');
    if (rail.classList.contains('open')) {
      const sc = document.createElement('div'); sc.className = 'scrim';
      sc.onclick = () => { rail.classList.remove('open'); sc.remove(); };
      document.body.appendChild(sc);
    } else document.querySelector('.scrim')?.remove();
  };

  /* sidebar collapse */
  const collapseBtn = document.getElementById('collapseRail');
  if (collapseBtn) {
    collapseBtn.onclick = () => {
      const rail = document.getElementById('rail');
      const collapsed = rail.classList.toggle('collapsed');
      collapseBtn.querySelector('svg path').setAttribute('d', collapsed ? 'M9 18l6-6-6-6' : 'M15 18l-6-6 6-6');
      collapseBtn.title = collapsed ? 'Expandir menu' : 'Colapsar menu';
      try { localStorage.setItem('bomdecompras-rail-collapsed', collapsed ? '1' : '0'); } catch(e) {}
    };
    try {
      if (localStorage.getItem('bomdecompras-rail-collapsed') === '1') {
        document.getElementById('rail').classList.add('collapsed');
        collapseBtn.querySelector('svg path').setAttribute('d', 'M9 18l6-6-6-6');
        collapseBtn.title = 'Expandir menu';
      }
    } catch(e) {}
  }

  /* date range picker */
  const drApply = document.getElementById('drApply');
  if (drApply) {
    drApply.onclick = () => {
      const from = document.getElementById('drFrom').value;
      const to = document.getElementById('drTo').value;
      if (!from || !to || from > to) { toast('Selecione datas válidas (de ≤ até)'); return; }
      // Add or replace custom period
      const id = 'custom_' + from + '_' + to;
      const existing = PERIODS.find(p => p.id === id);
      if (!existing) {
        const fmtDate = d => { const [y,m,dd] = d.split('-'); return dd+'/'+m+'/'+y; };
        PERIODS.push({ id, label: fmtDate(from) + ' – ' + fmtDate(to), short: 'Personalizado',
          preset: false, from, to, custom: true });
      }
      setPeriod(id);
    };
    // pre-fill date inputs with current period range
    const days = periodDays();
    if (days.length) {
      document.getElementById('drFrom').value = DAYS[days[0]].iso;
      document.getElementById('drTo').value = DAYS[days[days.length-1]].iso;
    }
  }

  /* preferências salvas */
  try {
    const t = localStorage.getItem('bomdecompras-theme'); if (t) document.documentElement.dataset.theme = t;
    const d = localStorage.getItem('bomdecompras-density'); if (d) document.documentElement.dataset.density = d;
  } catch (e) { }

  /* portão de senha — bloqueio simples, não é segurança real (senha visível no código-fonte) */
  try {
    const AUTH_KEY = 'bomdecompras-auth', AUTH_PASS = '123456';
    const gate = document.getElementById('authGate');
    if (gate) {
      if (localStorage.getItem(AUTH_KEY) === '1') {
        gate.remove();
      } else {
        document.getElementById('authForm').onsubmit = (e) => {
          e.preventDefault();
          const input = document.getElementById('authPass');
          if (input.value === AUTH_PASS) {
            try { localStorage.setItem(AUTH_KEY, '1'); } catch (e) { }
            gate.remove();
          } else {
            document.getElementById('authErr').classList.add('show');
            input.value = '';
            input.focus();
          }
        };
      }
    }
  } catch (e) { }
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (!document.documentElement.dataset.theme) render();
  });

  /* atalhos */
  addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); cmdkEl ? closeCmdk() : openCmdk(); return; }
    if (cmdkEl || deckEl) return;
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)) return;
    const map = { 1: 'dash', 2: 'canais', 3: 'anual', 4: 'semanal', 5: 'comparativos', 6: 'lancamentos', 7: 'metas', 8: 'dados', 9: 'apresentacao', 0: 'glossario' };
    if (map[e.key]) { e.preventDefault(); go(map[e.key]); }
    else if (e.key === '/') { e.preventDefault(); openCmdk(); }
  });

  wireDados();
  autoGran();
  syncFilters();
  go('dash');
}

/* active filter chips */
function renderActiveChips() {
  const el = document.getElementById('filterChips');
  if (!el) return;
  const chips = [];
  // Period chip (only show if not 'ytd' default)
  if (state.period !== 'ytd') {
    const p = PERIODS.find(px => px.id === state.period);
    const lbl = p ? p.label : state.period;
    chips.push({ label: '📅 ' + lbl, onRemove: () => { setPeriod('ytd'); render(); } });
  }
  // Channel chip
  if (state.scope !== 'all') {
    chips.push({ label: '🛍 ' + CH_LABEL[state.scope], onRemove: () => { state.scope = 'all'; syncFilters(); render(); } });
  }
  if (!chips.length) { el.innerHTML = ''; return; }
  el.innerHTML = chips.map((c, i) =>
    `<div class="fchip" data-ci="${i}">${esc(c.label)}<button aria-label="Remover filtro" data-ci="${i}">×</button></div>`
  ).join('') + `<button class="clear-filters" id="clearAll">Limpar filtros</button>`;
  el.querySelectorAll('.fchip button').forEach(btn => {
    btn.onclick = () => chips[+btn.dataset.ci].onRemove();
  });
  const ca = document.getElementById('clearAll');
  if (ca) ca.onclick = () => {
    state.period = 'ytd'; state.scope = 'all'; autoGran(); syncFilters(); render();
    toast('Filtros limpos');
  };
}

function applyCustomPeriod(from, to) {
  const id = 'custom_' + from + '_' + to;
  const fmtDate = d => { const [y,m,dd] = d.split('-'); return dd+'/'+m+'/'+y; };
  if (!PERIODS.find(p => p.id === id)) {
    PERIODS.push({ id, label: fmtDate(from) + ' – ' + fmtDate(to), short: 'Personalizado', preset: false, from, to, custom: true });
  }
  setPeriod(id);
}

init();

/* global table tooltip */
document.body.addEventListener('click', ev => {
  // If we click on elements that have their own custom tooltips, do not let the global table logic override or hide them.
  if (ev.target.closest('td.hc') || ev.target.closest('td.sem-cell') || ev.target.closest('canvas')) {
    return;
  }

  const td = ev.target.closest('table.t td:not(:first-child):not(.z)');
  if (!td || !td.parentElement.closest('#tAnual, #tSemanal, #tChannelDetail')) {
    hideTip();
    return;
  }
  const tr = td.parentElement;
  const ths = tr.closest('table').querySelectorAll('thead th');
  const tdIdx = Array.from(tr.children).indexOf(td);
  if (tdIdx < 1) return;
  const title = ths[tdIdx]?.textContent || 'Detalhe';
  const valStr = td.textContent.trim();
  if (valStr === '' || valStr === '—') return hideTip();
  const prevTd = tr.children[tdIdx - 1];
  const prevStr = prevTd ? prevTd.textContent.trim() : '';
  const indicator = tr.children[0].textContent.trim();
  let html = `<div class="tt">${indicator} · ${title}</div><div class="tr"><span>Valor</span><b>${valStr}</b></div>`;
  const parseNum = s => {
    if(!s || s==='—') return null;
    let sn = s.replace(/[R$\s%a-zA-Z]/g,'').replace(/\./g,'').replace(',','.');
    let n = parseFloat(sn);
    if (isNaN(n)) return null;
    if (s.includes('mil') || s.includes('k')) n *= 1000;
    if (s.includes('mi') || s.includes('M')) n *= 1000000;
    return n;
  };
  const v = parseNum(valStr), p = parseNum(prevStr);
  if (v != null && p != null && p !== 0 && tdIdx > 1) {
    const d = (v - p) / Math.abs(p);
    const inv = indicator.toLowerCase().includes('cancel');
    const good = inv ? d <= 0 : d >= 0;
    const cCls = Math.abs(d) < 0.005 ? 'z' : (good ? 'up' : 'dn');
    const pLbl = ths[tdIdx-1]?.textContent || 'anterior';
    html += `<div class="tr" style="margin-top:2px;padding-top:2px;border-top:1px solid var(--line-2)">
       <span style="font-size:9.5px;color:var(--ink-3);padding-left:14px">vs. ${pLbl}</span>
       <b class="${cCls}" style="font-size:10px">${d > 0 ? '+' : ''}${pct(d, 1)}</b>
     </div>`;
  }
  tipEl.innerHTML = html;
  tipEl.style.opacity = '1';
  const tw = tipEl.offsetWidth;
  tipEl.style.left = Math.max(tw/2+6, Math.min(document.documentElement.clientWidth-tw/2-6, ev.clientX)) + 'px';
  tipEl.style.top = (ev.clientY + 15) + 'px';
});
