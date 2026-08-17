const fs = require('fs');
const path = require('path');

const BASE = '.';
const SRC = path.join(BASE, 'src');
const OUT = path.join(BASE, 'index.html');
const PARTS_JS = ['03_core.js', '04_charts.js', '05_views_a.js', '06_views_b.js', '07_deck_init.js', '08_shell.js'];

const read = n => fs.readFileSync(path.join(SRC, n), 'utf8');

const data = JSON.parse(fs.readFileSync(path.join(BASE, 'data', 'full_data.json'), 'utf8'));
const dataJson = JSON.stringify(data);

let js = PARTS_JS.map(read).join('\n');
js = js.replace('__DATA_JSON__', dataJson);

const html = [
  '<!doctype html>',
  '<html lang="pt-BR">',
  '<head>',
  '<meta charset="utf-8">',
  '<meta name="viewport" content="width=device-width, initial-scale=1">',
  '<meta name="robots" content="noindex, nofollow">',
  read('01_head.html'),
  '</head>',
  '<body>',
  read('02_body.html'),
  '<script>',
  js,
  '</script>',
  '</body>',
  '</html>',
  ''
].join('\n');

fs.writeFileSync(OUT, html, 'utf8');
console.log('gerado:', OUT, '(' + html.length.toLocaleString() + ' bytes)');
