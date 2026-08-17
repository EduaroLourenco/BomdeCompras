#!/usr/bin/env node
// Funde os dados extraidos pelo extract_ml.ps1 (tools/ml_staging.json) em data/full_data.json.
// Uso:
//   powershell -File tools\extract_ml.ps1
//   node tools\import_ml.js
//   node build.js

const fs = require('fs');
const path = require('path');

const BASE = path.join(__dirname, '..');
const stagingPath = path.join(__dirname, 'ml_staging.json');
const dataPath = path.join(BASE, 'data', 'full_data.json');

function readJson(p) {
  let raw = fs.readFileSync(p, 'utf8');
  if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1); // PowerShell -Encoding utf8 grava BOM
  return JSON.parse(raw);
}
const staging = readJson(stagingPath);
const data = readJson(dataPath);

const CID = 'ml';
if (!data.daily[CID]) throw new Error(`canal ${CID} nao existe em full_data.json`);
if (data.dates.length !== data.daily[CID].length) throw new Error('dates e daily[ml] com tamanhos diferentes');

function round2(n) { return Math.round((n + Number.EPSILON) * 100) / 100; }

// agrupa os dias que tem pedido real por mes, pra distribuir o investimento mensal em ADS
// só nos dias em que ja sabemos que houve alguma outra atividade (evita "gastar ADS" em
// dias fantasma sem nenhum outro dado)
const daysByMonth = {};
for (const iso of Object.keys(staging.daily)) {
  const m = Number(iso.slice(5, 7)) - 1;
  (daysByMonth[m] = daysByMonth[m] || []).push(iso);
}

let daysMatched = 0;
let sumReceita = 0, sumPedidos = 0, sumPedCancel = 0, sumValCancel = 0, sumAds = 0;
const monthsWithOrdersNoVisits = new Set();

for (let i = 0; i < data.dates.length; i++) {
  const iso = data.dates[i];
  const s = staging.daily[iso];
  const m = Number(iso.slice(5, 7)) - 1;
  const monthDays = daysByMonth[m] || [];
  const adsTotalMonth = Number(staging.monthlyAds[String(m)] || 0);
  const adsPerDay = monthDays.length ? adsTotalMonth / monthDays.length : 0;
  const ads = monthDays.indexOf(iso) !== -1 ? adsPerDay : 0;

  if (s) {
    daysMatched++;
    data.daily[CID][i] = [0, round2(s.receita), s.pedidos, round2(ads), s.pedCancel, round2(s.valCancel), 0];
    sumReceita += s.receita; sumPedidos += s.pedidos; sumPedCancel += s.pedCancel; sumValCancel += s.valCancel; sumAds += ads;
    if (s.pedidos > 0 && Number(staging.monthlyVisits[String(m)] || 0) === 0) monthsWithOrdersNoVisits.add(m + 1);
  } else {
    data.daily[CID][i] = [0, 0, 0, round2(ads), 0, 0, 0];
    sumAds += ads;
  }
}

// monthlyVisits + monthlyVisitsTotal (so tem 1 canal hoje, total = o proprio canal)
const mv = Array(12).fill(0);
for (let m = 0; m < 12; m++) mv[m] = Number(staging.monthlyVisits[String(m)] || 0);
data.monthlyVisits[CID] = mv;
data.monthlyVisitsTotal = mv.slice();

// consolidated = espelha o unico canal (soma de 1 canal e ele mesmo)
const F = { VIS: 0, REC: 1, PED: 2, ADS: 3, CPED: 4, CVAL: 5 };
data.consolidated.receita = data.daily[CID].map(r => r[F.REC]);
data.consolidated.pedidos = data.daily[CID].map(r => r[F.PED]);
data.consolidated.cancelPed = data.daily[CID].map(r => r[F.CPED]);
data.consolidated.cancelVal = data.daily[CID].map(r => r[F.CVAL]);
data.consolidated.visitas = data.daily[CID].map(r => r[F.VIS]);
data.consolidated.ads = data.daily[CID].map(r => r[F.ADS]);

fs.writeFileSync(dataPath, JSON.stringify(data));

console.log(`Dias no calendario (data/full_data.json): ${data.dates.length}`);
console.log(`Dias com pedido real importado: ${daysMatched}`);
console.log(`Soma receita: R$ ${sumReceita.toFixed(2)}`);
console.log(`Soma pedidos: ${sumPedidos} (cancelados: ${sumPedCancel})`);
console.log(`Soma valor cancelado: R$ ${sumValCancel.toFixed(2)}`);
console.log(`Soma ADS distribuido pelos dias: R$ ${sumAds.toFixed(2)}`);
console.log(`Visitas mensais (jan..dez): ${JSON.stringify(mv)}`);
if (monthsWithOrdersNoVisits.size) {
  console.log(`AVISO: meses com pedido mas sem nenhum dado de visitas: ${[...monthsWithOrdersNoVisits].sort((a,b)=>a-b).join(', ')}`);
}
console.log('data/full_data.json atualizado. Rode "node build.js" para gerar o index.html.');
