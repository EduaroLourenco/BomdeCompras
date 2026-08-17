/* ============================================================
   BOM DE COMPRAS MARKETPLACE OS — núcleo
   ============================================================ */
const RAW = __DATA_JSON__;

const MON_S = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const MON_L = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const DOW_S = ['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'];
const DOW_L = ['Segunda','Terça','Quarta','Quinta','Sexta','Sábado','Domingo'];
const CH = RAW.channels;
const CH_IDS = CH.map(c => c.id);
const CH_LABEL = Object.fromEntries(CH.map(c => [c.id, c.label]));
const NDAYS = RAW.dates.length;
const YEAR = 2026;

/* paleta de séries — lida do design system (--s1…--s10), acompanha o tema */
function cvar(n) { return getComputedStyle(document.documentElement).getPropertyValue(n).trim(); }
let _sc = [], _scKey = null;
function seriesColor(i) {
  const key = (document.documentElement.dataset.theme || '') + matchMedia('(prefers-color-scheme: dark)').matches;
  if (key !== _scKey) {
    _scKey = key;
    _sc = Array.from({ length: 10 }, (_, k) => cvar('--s' + (k + 1)) || '#3b45a3');
  }
  return _sc[i % 10];
}

/* ---------------- date scaffolding ---------------- */
const DAYS = RAW.dates.map((s, i) => {
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const jsDow = dt.getUTCDay();            // 0=Dom
  return {
    i, iso: s, y, m: m - 1, d,
    dow: (jsDow + 6) % 7,                  // 0=Seg … 6=Dom
    label: String(d).padStart(2, '0') + '/' + String(m).padStart(2, '0'),
    long: String(d).padStart(2, '0') + ' ' + MON_S[m - 1],
    t: Date.UTC(y, m - 1, d)
  };
});
/* nth occurrence of this weekday within its month (1..5) */
(() => {
  const seen = {};
  DAYS.forEach(day => {
    const k = day.m + '|' + day.dow;
    seen[k] = (seen[k] || 0) + 1;
    day.occ = seen[k];
  });
})();
const MONTH_DAYS = Array.from({ length: 12 }, (_, m) => DAYS.filter(d => d.m === m).map(d => d.i));
const ALL_DAYS = DAYS.map(d => d.i);

/* weeks: Monday-start, week 1 contains 01/jan */
const WEEKS = (() => {
  const out = [];
  const first = DAYS[0];
  const startT = first.t - first.dow * 864e5;
  let t = startT, n = 0;
  while (t <= DAYS[NDAYS - 1].t) {
    const end = t + 6 * 864e5;
    const sd = new Date(t), ed = new Date(end);
    const idx = DAYS.filter(d => d.t >= t && d.t <= end).map(d => d.i);
    const pad = x => String(x).padStart(2, '0');
    out.push({
      n: ++n, days: idx, startT: t,
      label: 'S' + n,
      range: pad(sd.getUTCDate()) + '/' + pad(sd.getUTCMonth() + 1) + ' – ' + pad(ed.getUTCDate()) + '/' + pad(ed.getUTCMonth() + 1),
      mon: MON_S[sd.getUTCMonth()]
    });
    t = end + 864e5;
  }
  return out;
})();

/* cache de agregações — limpo a cada alteração de dados */
let AGG_VER = 0;
const AGG_CACHE = new Map();
function bumpAgg() { AGG_VER++; AGG_CACHE.clear(); }

/* ---------------- store (user edits) ---------------- */
const SKEY = 'bomdecompras-mkt-os-v1';
let MEM_ONLY = false;
const store = {
  edits: {},                                     // "cid|dayIdx" -> [vis,rec,ped,ads,cped,cval]
  metas: Object.fromEntries(CH_IDS.map(id => [id, Array(12).fill(0)])),
  metaAnual: 0,
  stamp: null
};
function loadStore() {
  try {
    const s = localStorage.getItem(SKEY);
    if (s) {
      const p = JSON.parse(s);
      if (p.edits) store.edits = p.edits;
      if (p.metas) CH_IDS.forEach(id => { if (p.metas[id]) store.metas[id] = p.metas[id]; });
      if (typeof p.metaAnual === 'number') store.metaAnual = p.metaAnual;
      store.stamp = p.stamp || null;
    }
  } catch (e) { MEM_ONLY = true; }
}
let saveTimer = null;
function saveStore(quiet) {
  store.stamp = new Date().toISOString();
  bumpAgg();
  if (MEM_ONLY) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try { localStorage.setItem(SKEY, JSON.stringify(store)); }
    catch (e) { MEM_ONLY = true; toast('Não foi possível salvar neste navegador — exporte um backup.'); }
    if (!quiet) renderFootStamp();
  }, 180);
}
loadStore();

/* ---------------- data access ---------------- */
/* field order: 0 visitas · 1 receita · 2 pedidos · 3 ads · 4 pedCancel · 5 valCancel · 6 metaDiaOriginal */
const F = { VIS: 0, REC: 1, PED: 2, ADS: 3, CPED: 4, CVAL: 5 };

function cell(cid, i, f) {
  const e = store.edits[cid + '|' + i];
  if (e && e[f] !== null && e[f] !== undefined) return e[f];
  return RAW.daily[cid][i][f];
}
function isEdited(cid, i, f) {
  const e = store.edits[cid + '|' + i];
  return !!(e && e[f] !== null && e[f] !== undefined && e[f] !== RAW.daily[cid][i][f]);
}
function setCell(cid, i, f, v) {
  const k = cid + '|' + i;
  if (!store.edits[k]) store.edits[k] = [null, null, null, null, null, null];
  store.edits[k][f] = v;
  if (store.edits[k].every((x, j) => x === null || x === RAW.daily[cid][i][j])) delete store.edits[k];
  saveStore();
}

/* aggregate a set of day indices for a channel scope ('all' or channel id)
   memoizado: as telas recalculam os mesmos recortes muitas vezes */
function agg(dayIdx, scope) {
  let chk = 0;
  for (let k = 0; k < dayIdx.length; k++) chk += dayIdx[k] * (k + 1);
  const key = scope + '#' + dayIdx.length + '#' + (dayIdx[0] ?? -1) + '#' + (dayIdx[dayIdx.length - 1] ?? -1) + '#' + chk;
  const hit = AGG_CACHE.get(key);
  if (hit) return hit;

  const ids = scope === 'all' ? CH_IDS : [scope];
  const o = { rec: 0, ped: 0, ads: 0, cped: 0, cval: 0, vis: 0, meta: 0, days: dayIdx.length };
  /* visitas diárias por canal+mês, para comparar com o registro mensal */
  const dayVis = {}, cover = {};
  for (const i of dayIdx) {
    const m = DAYS[i].m;
    cover[m] = (cover[m] || 0) + 1;
    for (const cid of ids) {
      const r = RAW.daily[cid][i], e = store.edits[cid + '|' + i];
      const g = f => (e && e[f] !== null && e[f] !== undefined) ? e[f] : r[f];
      const v = g(0);
      o.rec += g(1); o.ped += g(2); o.ads += g(3); o.cped += g(4); o.cval += g(5);
      if (v) dayVis[cid + '|' + m] = (dayVis[cid + '|' + m] || 0) + v;
    }
  }
  /* metas são mensais: proporcional aos dias do mês cobertos */
  let visMonthlyUsed = false, visDailyUsed = false;
  for (const m in cover) {
    const frac = cover[m] / MONTH_DAYS[m].length;
    for (const cid of ids) {
      o.meta += (store.metas[cid][+m] || 0) * frac;
      /* Visitas: a planilha registrou visitas mês a mês (relatório da plataforma) e
         só parcialmente no diário. O registro mensal é a fonte autoritativa quando existe. */
      const monthRec = RAW.monthlyVisits[cid] ? (RAW.monthlyVisits[cid][+m] || 0) : 0;
      const daySum = dayVis[cid + '|' + m] || 0;
      if (monthRec > daySum) { o.vis += monthRec * frac; if (monthRec) visMonthlyUsed = true; }
      else { o.vis += daySum; if (daySum) visDailyUsed = true; }
    }
  }
  o.visMonthly = visMonthlyUsed && !visDailyUsed;
  o.visMixed = visMonthlyUsed && visDailyUsed;

  o.recPaga = o.rec - o.cval;
  o.pedPagos = o.ped - o.cped;
  o.ticket = o.ped ? o.rec / o.ped : null;
  o.ticketPago = o.pedPagos ? o.recPaga / o.pedPagos : null;
  o.pctCancel = o.rec ? o.cval / o.rec : null;
  o.pctCancelPed = o.ped ? o.cped / o.ped : null;
  /* A planilha rotula 'ACOS', mas a fórmula usada nela é Inv.ADS ÷ Receita Total —
     que o próprio glossário dela define como TACOS. ACOS de verdade exige a receita
     atribuída aos anúncios, que não existe em nenhuma coluna da planilha. */
  o.tacos = o.rec ? o.ads / o.rec : null;
  o.recPorAds = o.ads ? o.rec / o.ads : null;
  o.conv = o.vis ? o.ped / o.vis : null;
  o.atg = o.meta ? o.rec / o.meta : null;

  AGG_CACHE.set(key, o);
  return o;
}
function aggMonth(m, scope) { return agg(MONTH_DAYS[m], scope); }

/* último dia com movimento */
const LAST_ACTIVE = (() => {
  for (let i = NDAYS - 1; i >= 0; i--) {
    if (CH_IDS.some(cid => cell(cid, i, F.REC) !== 0 || cell(cid, i, F.PED) !== 0)) return i;
  }
  return 0;
})();
const LAST_MONTH = DAYS[LAST_ACTIVE].m;

/* ---------------- period scope ---------------- */
const PERIODS = [
  { id: 'l30', label: 'Últimos 30 dias', short: '30 dias', preset: 1, days: () => DAYS.slice(Math.max(0, LAST_ACTIVE - 29), LAST_ACTIVE + 1).map(d => d.i) },
  { id: 'l60', label: 'Últimos 60 dias', short: '60 dias', preset: 1, days: () => DAYS.slice(Math.max(0, LAST_ACTIVE - 59), LAST_ACTIVE + 1).map(d => d.i) },
  { id: 'l90', label: 'Últimos 90 dias', short: '90 dias', preset: 1, days: () => DAYS.slice(Math.max(0, LAST_ACTIVE - 89), LAST_ACTIVE + 1).map(d => d.i) },
  { id: 'ytd', label: 'Ano até agora', short: 'No ano', preset: 1, days: () => DAYS.slice(0, LAST_ACTIVE + 1).map(d => d.i) },
  { id: 'year', label: 'Ano completo 2026', short: '2026', preset: 1, days: () => ALL_DAYS },
  ...[0, 1, 2, 3].map(q => ({ id: 'q' + (q + 1), label: (q + 1) + 'º trimestre', days: () => [q * 3, q * 3 + 1, q * 3 + 2].flatMap(m => MONTH_DAYS[m]) })),
  ...MON_L.map((m, i) => ({ id: 'm' + i, label: m + ' de 2026', days: () => MONTH_DAYS[i] })),
  ...[1, 2, 3, 4, 5].map(occ => ({ id: 'occ' + occ, label: occ + 'ª semana do mês (todos os meses)', short: occ + 'ª semana', days: () => DAYS.filter(d => d.occ === occ).map(d => d.i) }))
];
const state = {
  view: 'dash',
  period: 'ytd',
  scope: 'all',
  gran: 'd',
  compare: ['ml'],
  chMetric: 'rec',
  semMetric: 'rec',
  cmpMetric: 'rec',
  lanMonth: LAST_MONTH,
  lanChannel: 'ml'
};
function periodDays() { return (PERIODS.find(p => p.id === state.period) || PERIODS[0]).days(); }
function periodLabel() { return (PERIODS.find(p => p.id === state.period) || PERIODS[0]).label; }
/* período anterior de mesmo tamanho, para variações */
function prevDays() {
  const d = periodDays();
  if (!d.length) return [];
  const start = d[0], len = d.length;
  const from = Math.max(0, start - len);
  return DAYS.slice(from, start).map(x => x.i);
}

/* ---------------- formatting ---------------- */
const nfBRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 });
const nfBRL2 = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const nfInt = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
function brl(v, dec) { if (v == null || isNaN(v)) return '—'; return (dec ? nfBRL2 : nfBRL).format(v); }
function brlK(v) {
  if (v == null || isNaN(v)) return '—';
  const a = Math.abs(v), s = v < 0 ? '-' : '';
  if (a >= 1e6) return s + 'R$ ' + (a / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 2 }) + ' mi';
  if (a >= 1e3) return s + 'R$ ' + (a / 1e3).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' mil';
  return s + 'R$ ' + a.toLocaleString('pt-BR', { maximumFractionDigits: 0 });
}
function axisK(v) {
  const a = Math.abs(v), s = v < 0 ? '-' : '';
  if (a >= 1e6) return s + (a / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + 'M';
  if (a >= 1e3) return s + Math.round(a / 1e3) + 'k';
  return s + Math.round(a);
}
function int(v) { return v == null || isNaN(v) ? '—' : nfInt.format(Math.round(v)); }
function pct(v, d) { return v == null || isNaN(v) ? '—' : (v * 100).toLocaleString('pt-BR', { minimumFractionDigits: d ?? 1, maximumFractionDigits: d ?? 1 }) + '%'; }
function mult(v) { return v == null || isNaN(v) ? '—' : v.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + '×'; }
function delta(cur, prev) {
  if (!prev || prev === 0 || cur == null) return null;
  return (cur - prev) / Math.abs(prev);
}
function deltaTag(d, invert) {
  if (d == null || !isFinite(d)) return '';
  const good = invert ? d < 0 : d > 0;
  const cls = Math.abs(d) < 0.005 ? 'flat' : (good ? 'up' : 'down');
  const arrow = d > 0 ? '▲' : d < 0 ? '▼' : '■';
  return `<span class="tag ${cls}">${arrow} ${pct(Math.abs(d), 1)}</span>`;
}
function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

/* ---------------- UI helpers ---------------- */
let lastToast = 0;
function toast(msg) {
  const host = document.getElementById('toasts');
  if (!host) return;
  const now = Date.now();
  if (now - lastToast < 150) host.lastElementChild?.remove();
  lastToast = now;
  while (host.children.length > 1) host.firstElementChild.remove();
  const el = document.createElement('div');
  el.className = 'toast'; el.textContent = msg;
  host.appendChild(el);
  setTimeout(() => { el.style.transition = 'opacity .25s'; el.style.opacity = '0'; setTimeout(() => el.remove(), 260); }, 2300);
}
/* mantido para compatibilidade — o rodapé agora é renderStatus() */
function renderFootStamp() { if (typeof renderStatus === 'function') renderStatus(); }
